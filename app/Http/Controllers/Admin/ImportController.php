<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\CatalogImporter;
use App\Services\ImportImages;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Upload -> preview -> commit. The upload is parked on the private disk so the preview and
 * the commit read the same file; both re-plan against the live database.
 */
class ImportController extends Controller
{
    public function __construct(private readonly CatalogImporter $importer) {}

    public function index(): Response
    {
        return Inertia::render('admin/import', [
            'columns' => array_keys(CatalogImporter::COLUMNS),
            'demoActive' => Product::where('is_demo', true)->where('is_active', true)->count(),
            'hidden' => Product::where('is_demo', false)->where('is_active', false)->count(),
            'stockedHidden' => $this->importer->stockedHidden()->count(),
            'uploadLimit' => $this->uploadLimit(),
        ]);
    }

    public function publishStocked(): RedirectResponse
    {
        $count = $this->importer->stockedHidden()->update(['is_active' => true]);

        return redirect()->route('admin.imports.index')->with('success', 'Đã mở bán '.$count.' sản phẩm có tồn kho.');
    }

    public function template(): StreamedResponse
    {
        // BOM so Excel opens the Vietnamese headers as UTF-8.
        return response()->streamDownload(function () {
            echo "\xEF\xBB\xBF".implode(',', array_keys(CatalogImporter::COLUMNS))."\r\n";
        }, 'mau-nhap-hang.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function store(Request $request): RedirectResponse
    {
        $limit = (int) floor($this->uploadLimit() / 1024);
        $data = $request->validate([
            'catalog' => ['required', 'file', 'max:2048', 'extensions:csv,txt'],
            'images' => ['nullable', 'file', 'max:'.$limit, 'extensions:zip'],
            'update_stock' => ['required', 'boolean'],
            'publish' => ['required', 'boolean'],
        ], [
            'catalog.required' => 'Chọn file CSV sản phẩm.',
            'catalog.extensions' => 'File sản phẩm phải là .csv.',
            'catalog.max' => 'File CSV tối đa 2 MB.',
            'images.extensions' => 'Bộ ảnh phải là tệp .zip.',
            'images.max' => 'Tệp ảnh vượt giới hạn tải lên của máy chủ. Chia nhỏ hoặc dùng lệnh shop:import-catalog.',
            'images.uploaded' => 'Tệp ảnh vượt giới hạn tải lên của máy chủ. Chia nhỏ hoặc dùng lệnh shop:import-catalog.',
        ]);
        $this->prune();
        $id = (string) Str::uuid();
        $disk = Storage::disk('local');
        $request->file('catalog')->storeAs('imports/'.$id, 'catalog.csv', 'local');
        if ($request->hasFile('images')) {
            $request->file('images')->storeAs('imports/'.$id, 'images.zip', 'local');
        }
        $disk->put('imports/'.$id.'/options.json', json_encode([
            'publish' => (bool) $data['publish'],
            'update_stock' => (bool) $data['update_stock'],
            'name' => $request->file('catalog')->getClientOriginalName(),
        ], JSON_THROW_ON_ERROR));

        return redirect()->route('admin.imports.show', $id);
    }

    public function show(string $import): Response
    {
        [$file, $images, $options] = $this->load($import);

        return Inertia::render('admin/import-preview', [
            'import' => $import,
            'fileName' => $options['name'],
            'options' => ['publish' => $options['publish'], 'update_stock' => $options['update_stock']],
            'plan' => $this->importer->plan($file, $images, $this->options($options)),
        ]);
    }

    public function commit(Request $request, string $import): RedirectResponse
    {
        $fingerprint = $request->validate(['fingerprint' => ['required', 'string', 'size:64']])['fingerprint'];
        [$file, $images, $options] = $this->load($import);
        try {
            $result = $this->importer->commit($file, $images, $this->options($options), $fingerprint);
        } catch (ValidationException $exception) {
            return redirect()->route('admin.imports.show', $import)->withErrors($exception->errors());
        }
        Storage::disk('local')->deleteDirectory('imports/'.$import);

        return redirect()->route('admin.products.index')->with('success', sprintf(
            'Đã nhập: %d sản phẩm mới, %d sản phẩm cập nhật, %d SKU mới, %d SKU cập nhật.%s',
            $result['products_new'], $result['products_updated'], $result['variants_new'], $result['variants_updated'],
            $result['products_new'] && ! $options['publish'] ? ' Sản phẩm mới đang ẩn, kiểm tra rồi bật “Đang bán”.' : '',
        ));
    }

    public function retireDemo(): RedirectResponse
    {
        // Demo rows may be referenced by demo orders, so they are hidden rather than deleted.
        $count = Product::where('is_demo', true)->where('is_active', true)->update(['is_active' => false]);

        return redirect()->route('admin.imports.index')->with('success', 'Đã ẩn '.$count.' sản phẩm demo khỏi cửa hàng.');
    }

    /**
     * @return array{0: array{rows: list<array{line: int, values: array<string, string>}>, errors: list<array{line: int|null, message: string}>, warnings: list<array{line: int|null, message: string}>}, 1: ImportImages|null, 2: array{publish: bool, update_stock: bool, name: string}}
     */
    private function load(string $import): array
    {
        $disk = Storage::disk('local');
        $base = 'imports/'.$import;
        abort_unless($disk->exists($base.'/catalog.csv') && $disk->exists($base.'/options.json'), 404);
        $file = $this->importer->read($disk->path($base.'/catalog.csv'));
        $images = null;
        if ($disk->exists($base.'/images.zip')) {
            try {
                $images = ImportImages::fromZip($disk->path($base.'/images.zip'));
            } catch (RuntimeException $exception) {
                $file['errors'][] = ['line' => null, 'message' => $exception->getMessage()];
            }
        }

        return [$file, $images, json_decode((string) $disk->get($base.'/options.json'), true, 512, JSON_THROW_ON_ERROR)];
    }

    /**
     * @param  array{publish: bool, update_stock: bool}  $options
     * @return array{publish: bool, update_stock: bool}
     */
    private function options(array $options): array
    {
        return ['publish' => (bool) $options['publish'], 'update_stock' => (bool) $options['update_stock']];
    }

    /** Uploads left from abandoned previews are removed after a day. */
    private function prune(): void
    {
        $disk = Storage::disk('local');
        foreach ($disk->directories('imports') as $directory) {
            $marker = $directory.'/options.json';
            if (! $disk->exists($marker) || $disk->lastModified($marker) < now()->subDay()->getTimestamp()) {
                $disk->deleteDirectory($directory);
            }
        }
    }

    /** Effective upload ceiling in bytes: PHP's per-file and whole-request limits. */
    private function uploadLimit(): int
    {
        $bytes = function (string $value): int {
            $number = (int) $value;

            return match (strtolower(substr(trim($value), -1))) {
                'g' => $number * 1024 ** 3,
                'm' => $number * 1024 ** 2,
                'k' => $number * 1024,
                default => $number,
            };
        };
        $limits = array_filter([$bytes((string) ini_get('upload_max_filesize')), $bytes((string) ini_get('post_max_size'))]);

        return $limits ? min($limits) : 2 * 1024 ** 2;
    }
}
