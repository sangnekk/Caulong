<?php

namespace App\Services;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use ZipArchive;

/**
 * Product photos supplied with a catalog import, from an uploaded ZIP or (CLI) a folder.
 * Files are matched by name, never extracted to disk, and read with a size cap so a
 * crafted archive cannot fill the server.
 */
class ImportImages
{
    public const MAX_BYTES = 5 * 1024 * 1024;

    /** Uploaded archives; a folder chosen by the operator on the server may hold more. */
    public const MAX_FILES = 500;

    public const MAX_FOLDER_FILES = 10000;

    private const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    /** @var array<string, string> lowercase file name => ZIP entry or absolute path */
    private array $files = [];

    /** @var array<string, true> names that appear more than once */
    private array $ambiguous = [];

    private ?ZipArchive $zip = null;

    private function __construct(private readonly int $limit) {}

    public static function fromZip(string $path): self
    {
        $images = new self(self::MAX_FILES);
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('Không mở được tệp ZIP ảnh.');
        }
        $images->zip = $zip;
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $name = (string) $zip->getNameIndex($index);
            $images->add($name, $name);
        }

        return $images;
    }

    public static function fromDirectory(string $directory): self
    {
        $root = realpath($directory);
        if ($root === false || ! is_dir($root)) {
            throw new RuntimeException('Không tìm thấy thư mục ảnh: '.$directory);
        }
        $images = new self(self::MAX_FOLDER_FILES);
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($files as $file) {
            if ($file->isFile() && ! $file->isLink()) {
                $images->add(substr($file->getPathname(), strlen($root) + 1), $file->getPathname());
            }
        }

        return $images;
    }

    public function count(): int
    {
        return count($this->files);
    }

    /** Why a referenced photo cannot be used, or null when it is a valid image. */
    public function problem(string $name): ?string
    {
        $key = $this->key($name);
        if (isset($this->ambiguous[$key])) {
            return 'Có nhiều ảnh cùng tên “'.$name.'” trong bộ ảnh.';
        }
        if (! isset($this->files[$key])) {
            return 'Không thấy ảnh “'.$name.'” trong bộ ảnh.';
        }
        try {
            $this->read($name);
        } catch (RuntimeException $exception) {
            return $exception->getMessage();
        }

        return null;
    }

    /**
     * @return array{bytes: string, extension: string}
     */
    public function read(string $name): array
    {
        $source = $this->files[$this->key($name)] ?? throw new RuntimeException('Không thấy ảnh “'.$name.'”.');
        $stream = $this->zip ? $this->zip->getStream($source) : fopen($source, 'rb');
        if (! is_resource($stream)) {
            throw new RuntimeException('Không đọc được ảnh “'.$name.'”.');
        }
        $bytes = stream_get_contents($stream, self::MAX_BYTES + 1);
        fclose($stream);
        if ($bytes === false || $bytes === '') {
            throw new RuntimeException('Ảnh “'.$name.'” rỗng hoặc hỏng.');
        }
        if (strlen($bytes) > self::MAX_BYTES) {
            throw new RuntimeException('Ảnh “'.$name.'” lớn hơn 5 MB.');
        }
        $type = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (! isset(self::TYPES[$type]) || @getimagesizefromstring($bytes) === false) {
            throw new RuntimeException('“'.$name.'” không phải ảnh JPEG, PNG hoặc WebP hợp lệ.');
        }

        return ['bytes' => $bytes, 'extension' => self::TYPES[$type]];
    }

    private function add(string $path, string $source): void
    {
        $path = str_replace('\\', '/', $path);
        $name = basename($path);
        // Skip folders, macOS resource forks and hidden files; keep only photo types.
        if (str_ends_with($path, '/') || str_starts_with($path, '__MACOSX/') || str_starts_with($name, '.')
            || ! in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), self::EXTENSIONS, true)) {
            return;
        }
        $key = $this->key($name);
        if (isset($this->files[$key])) {
            $this->ambiguous[$key] = true;

            return;
        }
        if (count($this->files) >= $this->limit) {
            throw new RuntimeException('Bộ ảnh có quá '.$this->limit.' ảnh. Chia thành nhiều lần nhập.');
        }
        $this->files[$key] = $source;
    }

    private function key(string $name): string
    {
        return mb_strtolower(basename(str_replace('\\', '/', trim($name))));
    }
}
