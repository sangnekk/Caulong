<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Imports the shop's own catalog from a CSV with one row per SKU. Planning never writes. The
 * commit re-plans against the live database under row locks and refuses to run when anything
 * changed since the preview, so an old stock count can never overwrite a newer order.
 *
 * @phpstan-type Row array{line: int, values: array<string, string>}
 * @phpstan-type Issue array{line: int|null, message: string}
 * @phpstan-type File array{rows: list<Row>, errors: list<Issue>, warnings: list<Issue>}
 * @phpstan-type Options array{publish: bool, update_stock: bool}
 * @phpstan-type Current array{id: int, name: string, price: int, stock: int, is_active: bool}
 * @phpstan-type PlannedVariant array{line: int, sku: string, name: string, price: int, cost_price: int|null, stock: int, is_active: bool, current: Current|null, action: string}
 * @phpstan-type PlannedProduct array{line: int, slug: string, id: int|null, name: string, brand: string|null, category: string|null, attributes: array<string, string>, specs: array<string, string>, is_active: bool, action: string, variants: list<PlannedVariant>}
 * @phpstan-type Summary array{rows: int, products_new: int, products_updated: int, variants_new: int, variants_updated: int, brands_new: list<string>, categories_new: list<string>, images: int}
 * @phpstan-type Plan array{summary: Summary, products: list<PlannedProduct>, errors: list<Issue>, warnings: list<Issue>, fingerprint: string}
 * @phpstan-type Group array{line: int, name: string, fields: array<string, string>, variants: list<array{line: int, sku: string, name: string, price: int, cost: int|null, stock: int, is_active: bool}>}
 * @phpstan-type Counts array{products_new: int, products_updated: int, variants_new: int, variants_updated: int}
 */
class CatalogImporter
{
    public const MAX_ROWS = 2000;

    /** Canonical column => accepted headers (compared after removing accents and punctuation). */
    public const COLUMNS = [
        'ten_san_pham' => ['ten_san_pham', 'san_pham', 'ten', 'product_name', 'name'],
        'duong_dan' => ['duong_dan', 'slug'],
        'hang' => ['hang', 'thuong_hieu', 'brand'],
        'danh_muc' => ['danh_muc', 'loai', 'category'],
        'mo_ta' => ['mo_ta', 'description'],
        'loi_choi' => ['loi_choi', 'play_style', 'style'],
        'trinh_do' => ['trinh_do', 'skill_level', 'level'],
        'trong_luong' => ['trong_luong', 'weight'],
        'diem_can_bang' => ['diem_can_bang', 'can_bang', 'balance'],
        'do_cung' => ['do_cung', 'stiffness'],
        'chat_lieu' => ['chat_lieu', 'material'],
        'suc_cang_toi_da' => ['suc_cang_toi_da', 'suc_cang', 'max_tension'],
        'anh' => ['anh', 'hinh_anh', 'image'],
        'ten_phien_ban' => ['ten_phien_ban', 'phien_ban', 'variant_name', 'variant'],
        'sku' => ['sku', 'ma_sku', 'ma_hang'],
        'gia' => ['gia', 'gia_ban', 'price'],
        'gia_nhap' => ['gia_nhap', 'gia_von', 'cost', 'cost_price'],
        'ton_kho' => ['ton_kho', 'so_luong', 'stock', 'quantity'],
        'dang_ban' => ['dang_ban', 'is_active', 'active'],
    ];

    private const REQUIRED = ['ten_san_pham', 'sku', 'gia', 'ton_kho'];

    private const PRODUCT_FIELDS = ['hang', 'danh_muc', 'mo_ta', 'loi_choi', 'trinh_do', 'trong_luong', 'diem_can_bang', 'do_cung', 'chat_lieu', 'suc_cang_toi_da', 'anh'];

    private const SPECS = ['trong_luong' => 'weight', 'diem_can_bang' => 'balance', 'do_cung' => 'stiffness', 'chat_lieu' => 'material', 'suc_cang_toi_da' => 'max_tension'];

    private const STYLES = ['tan-cong' => 'attack', 'attack' => 'attack', 'toc-do' => 'speed', 'speed' => 'speed', 'can-bang' => 'balanced', 'balanced' => 'balanced', 'balance' => 'balanced'];

    private const LEVELS = ['moi-choi' => 'beginner', 'nguoi-moi' => 'beginner', 'beginner' => 'beginner', 'trung-binh' => 'intermediate', 'intermediate' => 'intermediate', 'nang-cao' => 'advanced', 'advanced' => 'advanced', 'moi-trinh-do' => 'all', 'tat-ca' => 'all', 'all' => 'all'];

    /**
     * Hidden real products that now have stock the shop entered: the only ones safe to put on
     * sale in bulk, so nothing appears purchasable without a real count behind it.
     *
     * @return Builder<Product>
     */
    public function stockedHidden(): Builder
    {
        return Product::where('is_demo', false)->where('is_active', false)
            ->whereHas('variants', fn (Builder $query) => $query->where('is_active', true)->where('stock', '>', 0));
    }

    /**
     * @return File
     */
    public function read(string $path): array
    {
        $content = (string) file_get_contents($path);
        $content = str_starts_with($content, "\xEF\xBB\xBF") ? substr($content, 3) : $content;
        if (! mb_check_encoding($content, 'UTF-8')) {
            return $this->failed('File không phải UTF-8. Trong Excel chọn Lưu thành → “CSV UTF-8 (phân tách bằng dấu phẩy)”.');
        }
        $firstLine = strtok($content, "\r\n") ?: '';
        $delimiter = collect([',', ';', "\t"])->sortByDesc(fn ($candidate) => substr_count($firstLine, $candidate))->first();
        $stream = fopen('php://temp', 'r+b');
        if ($stream === false) {
            return $this->failed('Không đọc được file.');
        }
        fwrite($stream, $content);
        rewind($stream);

        $header = fgetcsv($stream, null, $delimiter, '"', '');
        if (! is_array($header) || count(array_filter($header, fn ($cell) => trim((string) $cell) !== '')) === 0) {
            fclose($stream);

            return $this->failed('File trống hoặc thiếu dòng tiêu đề cột.');
        }
        $columns = [];
        $errors = [];
        $warnings = [];
        foreach ($header as $index => $cell) {
            $key = trim((string) preg_replace('/[^a-z0-9]+/', '_', strtolower(Str::ascii((string) $cell))), '_');
            if ($key === '') {
                continue;
            }
            $canonical = collect(self::COLUMNS)->search(fn (array $aliases) => in_array($key, $aliases, true));
            if ($canonical === false) {
                $warnings[] = ['line' => 1, 'message' => 'Bỏ qua cột “'.trim((string) $cell).'” (không dùng).'];
            } elseif (in_array($canonical, $columns, true)) {
                $errors[] = ['line' => 1, 'message' => 'Cột “'.trim((string) $cell).'” bị lặp.'];
            } else {
                $columns[$index] = $canonical;
            }
        }
        foreach (self::REQUIRED as $required) {
            if (! in_array($required, $columns, true)) {
                $errors[] = ['line' => 1, 'message' => 'Thiếu cột bắt buộc “'.$required.'”.'];
            }
        }
        if ($errors) {
            // Without the right columns every row would fail; report the header only.
            fclose($stream);

            return ['rows' => [], 'errors' => $errors, 'warnings' => $warnings];
        }

        $rows = [];
        $line = 1;
        while (($cells = fgetcsv($stream, null, $delimiter, '"', '')) !== false) {
            $line++;
            $values = [];
            foreach ($columns as $index => $column) {
                $values[$column] = trim((string) ($cells[$index] ?? ''));
            }
            if (implode('', $values) === '') {
                continue;
            }
            if (count($rows) === self::MAX_ROWS) {
                $errors[] = ['line' => $line, 'message' => 'File có hơn '.self::MAX_ROWS.' dòng. Chia thành nhiều file.'];
                break;
            }
            $rows[] = ['line' => $line, 'values' => $values];
        }
        fclose($stream);
        if (! $rows && ! $errors) {
            $errors[] = ['line' => null, 'message' => 'File chưa có dòng sản phẩm nào.'];
        }

        return ['rows' => $rows, 'errors' => $errors, 'warnings' => $warnings];
    }

    /**
     * Resolve the file against the database without writing anything.
     *
     * @param  File  $file
     * @param  Options  $options
     * @return Plan
     */
    public function plan(array $file, ?ImportImages $images, array $options): array
    {
        $errors = $file['errors'];
        $warnings = $file['warnings'];
        $groups = $this->group($file['rows'], $errors);

        $products = Product::with(['brand:id,name', 'category:id,name'])->whereIn('slug', array_keys($groups) ?: [''])->get()->keyBy('slug');
        $variants = ProductVariant::with('product:id,name')->whereIn('sku', $this->skus($groups) ?: [''])->get()->keyBy('sku');
        $brands = Brand::all();
        $categories = Category::all();

        $planned = [];
        $newBrands = [];
        $newCategories = [];
        $imageCount = 0;
        foreach ($groups as $slug => $group) {
            $line = $group['line'];
            $fields = $group['fields'];
            $existing = $products->get($slug);
            if ($existing?->is_demo) {
                $errors[] = ['line' => $line, 'message' => 'Đường dẫn “'.$slug.'” đang dùng cho sản phẩm demo. Đặt đường dẫn khác cho hàng thật.'];

                continue;
            }
            $style = $this->style($fields['loi_choi'], $line, $errors);
            $level = $this->level($fields['trinh_do'], $line, $errors);
            if (! $existing) {
                if ($fields['mo_ta'] === '') {
                    $errors[] = ['line' => $line, 'message' => 'Sản phẩm mới “'.$group['name'].'” cần mô tả (cột mo_ta).'];
                }
                if ($fields['loi_choi'] === '') {
                    $errors[] = ['line' => $line, 'message' => 'Sản phẩm mới “'.$group['name'].'” cần lối chơi: tấn công, tốc độ hoặc cân bằng.'];
                }
                if ($fields['trinh_do'] === '') {
                    $warnings[] = ['line' => $line, 'message' => '“'.$group['name'].'” chưa ghi trình độ, sẽ được gợi ý cho mọi trình độ.'];
                }
            }
            if ($fields['anh'] !== '') {
                $problem = $images ? $images->problem($fields['anh']) : 'Dòng có ảnh “'.$fields['anh'].'” nhưng chưa kèm tệp ZIP ảnh.';
                $current = $existing?->image_path && Storage::disk('public')->exists($existing->image_path)
                    ? hash('sha256', (string) Storage::disk('public')->get($existing->image_path)) : null;
                if ($problem !== null) {
                    $errors[] = ['line' => $line, 'message' => $problem];
                } elseif ($images && $current !== null && hash_equals($current, hash('sha256', $images->read($fields['anh'])['bytes']))) {
                    // Same photo as last import: keep the stored file instead of copying it again.
                    $fields['anh'] = '';
                } else {
                    $imageCount++;
                }
            }
            $brand = $this->taxonomy($brands, $fields['hang']);
            if ($fields['hang'] !== '' && ! $brand && ! in_array($fields['hang'], $newBrands, true)) {
                $newBrands[] = $fields['hang'];
            }
            $category = $this->taxonomy($categories, $fields['danh_muc']);
            if ($fields['danh_muc'] !== '' && ! $category && ! in_array($fields['danh_muc'], $newCategories, true)) {
                $newCategories[] = $fields['danh_muc'];
            }

            $rows = [];
            foreach ($group['variants'] as $variant) {
                $current = $variants->get($variant['sku']);
                if ($current && $current->product_id !== $existing?->id) {
                    $errors[] = ['line' => $variant['line'], 'message' => 'SKU “'.$variant['sku'].'” đang thuộc sản phẩm “'.$current->product->name.'”.'];

                    continue;
                }
                $stock = $current && ! $options['update_stock'] ? $current->stock : $variant['stock'];
                $cost = $variant['cost'] ?? $current?->cost_price;
                $rows[] = [
                    'line' => $variant['line'],
                    'sku' => $variant['sku'],
                    'name' => $variant['name'],
                    'price' => $variant['price'],
                    'cost_price' => $cost,
                    'stock' => $stock,
                    'is_active' => $variant['is_active'],
                    'current' => $current ? ['id' => $current->id, 'name' => $current->name, 'price' => $current->price, 'stock' => $current->stock, 'is_active' => $current->is_active] : null,
                    'action' => ! $current ? 'create' : ($current->name === $variant['name'] && $current->price === $variant['price']
                        && $current->cost_price === $cost && $current->stock === $stock && $current->is_active === $variant['is_active'] ? 'unchanged' : 'update'),
                ];
            }

            $attributes = array_filter([
                'name' => $group['name'],
                'description' => $fields['mo_ta'],
                'play_style' => $style,
                'skill_level' => $level ?? ($existing ? null : 'all'),
                'brand' => $fields['hang'],
                'category' => $fields['danh_muc'],
                'image' => $fields['anh'],
            ], fn ($value) => $value !== null && $value !== '');
            $specs = array_filter(collect(self::SPECS)->mapWithKeys(fn ($key, $column) => [$key => $fields[$column]])->all(), fn ($value) => $value !== '');
            $changed = ! $existing
                || $existing->name !== $group['name']
                || collect(['description' => 'description', 'play_style' => 'play_style', 'skill_level' => 'skill_level'])
                    ->contains(fn ($column, $key) => isset($attributes[$key]) && $existing->{$column} !== $attributes[$key])
                || ($brand?->id !== null && $brand->id !== $existing->brand_id) || ($fields['hang'] !== '' && ! $brand)
                || ($category?->id !== null && $category->id !== $existing->category_id) || ($fields['danh_muc'] !== '' && ! $category)
                || $fields['anh'] !== ''
                || array_diff_assoc($specs, $existing->specs ?? []) !== [];

            $planned[] = [
                'line' => $line,
                'slug' => $slug,
                'id' => $existing?->id,
                'name' => $group['name'],
                'brand' => $fields['hang'] ?: $existing?->brand?->name,
                'category' => $fields['danh_muc'] ?: $existing?->category?->name,
                'attributes' => $attributes,
                'specs' => $specs,
                'is_active' => $existing ? $existing->is_active : $options['publish'],
                'action' => ! $existing ? 'create' : ($changed ? 'update' : 'unchanged'),
                'variants' => $rows,
            ];
        }

        $allVariants = collect($planned)->flatMap(fn ($product) => $product['variants']);

        return [
            'summary' => [
                'rows' => count($file['rows']),
                'products_new' => collect($planned)->where('action', 'create')->count(),
                'products_updated' => collect($planned)->where('action', 'update')->count(),
                'variants_new' => $allVariants->where('action', 'create')->count(),
                'variants_updated' => $allVariants->where('action', 'update')->count(),
                'brands_new' => $newBrands,
                'categories_new' => $newCategories,
                'images' => $imageCount,
            ],
            'products' => $planned,
            'errors' => $errors,
            'warnings' => $warnings,
            // Any order, stock edit or product edit after the preview changes this.
            'fingerprint' => hash('sha256', json_encode([
                $options,
                $products->map(fn (Product $product) => [$product->id, $product->updated_at?->toJSON()])->all(),
                $variants->map(fn (ProductVariant $variant) => [$variant->id, $variant->product_id, $variant->price, $variant->stock, $variant->is_active, $variant->updated_at?->toJSON()])->all(),
                $brands->pluck('id')->all(),
                $categories->pluck('id')->all(),
            ], JSON_THROW_ON_ERROR)),
        ];
    }

    /**
     * @param  File  $file
     * @param  Options  $options
     * @return Counts
     */
    public function commit(array $file, ?ImportImages $images, array $options, string $fingerprint): array
    {
        $stored = [];
        try {
            return DB::transaction(function () use ($file, $images, $options, $fingerprint, &$stored) {
                // Lock what the plan reads, variants in id order like checkout, then plan again.
                $ignored = [];
                $groups = $this->group($file['rows'], $ignored);
                Product::whereIn('slug', array_keys($groups) ?: [''])->orderBy('id')->lockForUpdate()->get();
                ProductVariant::whereIn('sku', $this->skus($groups) ?: [''])->orderBy('id')->lockForUpdate()->get();
                $plan = $this->plan($file, $images, $options);
                if ($plan['errors']) {
                    throw ValidationException::withMessages(['import' => 'File còn lỗi. Sửa theo danh sách rồi tải lên lại.']);
                }
                if (! hash_equals($plan['fingerprint'], $fingerprint)) {
                    throw ValidationException::withMessages(['import' => 'Sản phẩm hoặc tồn kho vừa thay đổi (có thể do đơn mới). Xem lại bản xem trước rồi nhập.']);
                }

                $brands = Brand::all();
                $categories = Category::all();
                foreach ($plan['products'] as $item) {
                    $attributes = $item['attributes'];
                    $product = $item['id'] ? Product::findOrFail($item['id']) : new Product(['slug' => $item['slug'], 'is_active' => $options['publish'], 'is_featured' => false, 'is_demo' => false]);
                    $product->fill(array_intersect_key($attributes, array_flip(['name', 'description', 'play_style', 'skill_level'])));
                    if (isset($attributes['brand'])) {
                        $brand = $this->taxonomy($brands, $attributes['brand']);
                        if (! $brand) {
                            $brand = Brand::create(['name' => $attributes['brand'], 'slug' => $this->freeSlug(Brand::class, $attributes['brand'])]);
                            $brands->push($brand);
                        }
                        $product->brand_id = $brand->id;
                    }
                    if (isset($attributes['category'])) {
                        $category = $this->taxonomy($categories, $attributes['category']);
                        if (! $category) {
                            $category = Category::create(['name' => $attributes['category'], 'slug' => $this->freeSlug(Category::class, $attributes['category'])]);
                            $categories->push($category);
                        }
                        $product->category_id = $category->id;
                    }
                    if ($item['specs']) {
                        $product->specs = [...($product->specs ?? []), ...$item['specs']];
                    }
                    if (isset($attributes['image']) && $images) {
                        $image = $images->read($attributes['image']);
                        $path = 'products/'.Str::random(40).'.'.$image['extension'];
                        if (! Storage::disk('public')->put($path, $image['bytes'])) {
                            throw ValidationException::withMessages(['import' => 'Không lưu được ảnh “'.$attributes['image'].'”.']);
                        }
                        $stored[] = $path;
                        $product->image_path = $path;
                    }
                    $product->save();
                    foreach ($item['variants'] as $variant) {
                        if ($variant['action'] === 'unchanged') {
                            continue;
                        }
                        $row = $variant['current'] ? ProductVariant::findOrFail($variant['current']['id']) : new ProductVariant(['product_id' => $product->id, 'sku' => $variant['sku']]);
                        $row->fill(['name' => $variant['name'], 'price' => $variant['price'], 'cost_price' => $variant['cost_price'], 'stock' => $variant['stock'], 'is_active' => $variant['is_active']])->save();
                    }
                }

                $summary = $plan['summary'];

                return [
                    'products_new' => $summary['products_new'],
                    'products_updated' => $summary['products_updated'],
                    'variants_new' => $summary['variants_new'],
                    'variants_updated' => $summary['variants_updated'],
                ];
            });
        } catch (Throwable $exception) {
            // ponytail: photos replaced by an import stay on disk, like the product form.
            Storage::disk('public')->delete($stored);
            throw $exception;
        }
    }

    /**
     * Rows grouped by product slug; product fields must agree across a product's rows.
     *
     * @param  list<Row>  $rows
     * @param  list<Issue>  $errors
     * @return array<string, Group>
     */
    private function group(array $rows, array &$errors): array
    {
        $groups = [];
        $seenSkus = [];
        foreach ($rows as ['line' => $line, 'values' => $values]) {
            $value = fn (string $column) => (string) preg_replace('/\s+/u', ' ', $values[$column] ?? '');
            $name = $value('ten_san_pham');
            $slug = $value('duong_dan') ?: Str::slug($name);
            $sku = strtolower($value('sku'));
            $problems = [];
            if ($name === '' || mb_strlen($name) > 160) {
                $problems[] = $name === '' ? 'Thiếu tên sản phẩm.' : 'Tên sản phẩm quá 160 ký tự.';
            }
            if (! preg_match('/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/', $slug) || strlen($slug) > 180) {
                $problems[] = 'Đường dẫn “'.$slug.'” chỉ được dùng chữ thường không dấu, số và dấu gạch nối.';
            }
            if (! preg_match('/\A[a-z0-9][a-z0-9._-]*\z/', $sku) || strlen($sku) > 80) {
                $problems[] = $sku === '' ? 'Thiếu SKU.' : 'SKU “'.$value('sku').'” chỉ được dùng chữ, số, dấu chấm, gạch nối, gạch dưới.';
            } elseif (isset($seenSkus[$sku])) {
                $problems[] = 'SKU “'.$value('sku').'” lặp với dòng '.$seenSkus[$sku].'.';
            }
            $price = $this->number($value('gia'), true);
            if ($price === null || $price < 1 || $price > 1_000_000_000) {
                $problems[] = 'Giá “'.$value('gia').'” không hợp lệ. Ghi số đồng, ví dụ 1290000 hoặc 1.290.000.';
            }
            $cost = $value('gia_nhap') === '' ? null : $this->number($value('gia_nhap'), true);
            if ($value('gia_nhap') !== '' && ($cost === null || $cost > 1_000_000_000)) {
                $problems[] = 'Giá nhập “'.$value('gia_nhap').'” không hợp lệ. Ghi số đồng hoặc để trống.';
            }
            $stock = $this->number($value('ton_kho'), false);
            if ($stock === null || $stock > 1_000_000) {
                $problems[] = 'Tồn kho “'.$value('ton_kho').'” phải là số nguyên từ 0.';
            }
            $active = $this->flag($value('dang_ban'));
            if ($active === null) {
                $problems[] = 'Cột dang_ban chỉ nhận có/không.';
            }
            $variantName = $value('ten_phien_ban') ?: 'Tiêu chuẩn';
            if (mb_strlen($variantName) > 120) {
                $problems[] = 'Tên phiên bản quá 120 ký tự.';
            }
            foreach (self::PRODUCT_FIELDS as $field) {
                $limit = match ($field) {
                    'mo_ta' => 20000,
                    'hang', 'danh_muc' => 120,
                    default => 200,
                };
                if (mb_strlen($value($field)) > $limit) {
                    $problems[] = 'Cột '.$field.' quá '.$limit.' ký tự.';
                }
            }
            if ($problems) {
                array_push($errors, ...array_map(fn ($message) => ['line' => $line, 'message' => $message], $problems));

                continue;
            }
            $seenSkus[$sku] = $line;
            $fields = collect(self::PRODUCT_FIELDS)->mapWithKeys(fn ($field) => [$field => $field === 'mo_ta' ? trim($values['mo_ta'] ?? '') : $value($field)])->all();
            if (! isset($groups[$slug])) {
                $groups[$slug] = ['line' => $line, 'name' => $name, 'fields' => $fields, 'variants' => []];
            } else {
                foreach ($fields as $field => $fieldValue) {
                    $known = $groups[$slug]['fields'][$field];
                    if ($fieldValue !== '' && $known !== '' && mb_strtolower($fieldValue) !== mb_strtolower($known)) {
                        $errors[] = ['line' => $line, 'message' => 'Cột '.$field.' khác với dòng '.$groups[$slug]['line'].' của cùng sản phẩm.'];
                    } elseif ($known === '') {
                        $groups[$slug]['fields'][$field] = $fieldValue;
                    }
                }
            }
            $groups[$slug]['variants'][] = ['line' => $line, 'sku' => $sku, 'name' => $variantName, 'price' => (int) $price, 'cost' => $cost === null ? null : (int) $cost, 'stock' => (int) $stock, 'is_active' => (bool) $active];
        }

        return $groups;
    }

    /**
     * @param  array<string, Group>  $groups
     * @return list<string>
     */
    private function skus(array $groups): array
    {
        $skus = [];
        foreach ($groups as $group) {
            foreach ($group['variants'] as $variant) {
                $skus[] = $variant['sku'];
            }
        }

        return $skus;
    }

    /** Whole đồng: "1290000", "1.290.000", "1,290,000 đ". Never guesses at decimals. */
    private function number(string $value, bool $money): ?int
    {
        $value = (string) preg_replace($money ? '/(vnđ|vnd|đ|₫|\s)/iu' : '/\s/u', '', $value);
        if (preg_match('/\A\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*\z/', $value)) {
            $value = str_replace(['.', ','], '', $value);
        }

        return preg_match('/\A\d{1,10}\z/', $value) ? (int) $value : null;
    }

    private function flag(string $value): ?bool
    {
        return match (Str::slug($value)) {
            '', '1', 'co', 'x', 'yes', 'true', 'dang-ban' => true,
            '0', 'khong', 'no', 'false', 'ngung-ban', 'an' => false,
            default => null,
        };
    }

    /** @param  list<Issue>  $errors */
    private function style(string $value, int $line, array &$errors): ?string
    {
        $style = $value === '' ? null : (self::STYLES[Str::slug($value)] ?? null);
        if ($value !== '' && $style === null) {
            $errors[] = ['line' => $line, 'message' => 'Lối chơi “'.$value.'” không hợp lệ. Dùng: tấn công, tốc độ, cân bằng.'];
        }

        return $style;
    }

    /** @param  list<Issue>  $errors */
    private function level(string $value, int $line, array &$errors): ?string
    {
        $level = $value === '' ? null : (self::LEVELS[Str::slug($value)] ?? null);
        if ($value !== '' && $level === null) {
            $errors[] = ['line' => $line, 'message' => 'Trình độ “'.$value.'” không hợp lệ. Dùng: mới chơi, trung bình, nâng cao, mọi trình độ.'];
        }

        return $level;
    }

    /**
     * @template T of Brand|Category
     *
     * @param  iterable<T>  $items
     * @return T|null
     */
    private function taxonomy(iterable $items, string $name): Brand|Category|null
    {
        if ($name === '') {
            return null;
        }
        foreach ($items as $item) {
            if (mb_strtolower($item->name) === mb_strtolower($name) || $item->slug === Str::slug($name)) {
                return $item;
            }
        }

        return null;
    }

    /** @param  class-string<Brand|Category>  $model */
    private function freeSlug(string $model, string $name): string
    {
        $base = Str::slug($name) ?: 'muc';
        $slug = $base;
        for ($suffix = 2; $model::where('slug', $slug)->exists(); $suffix++) {
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }

    /** @return File */
    private function failed(string $message): array
    {
        return ['rows' => [], 'errors' => [['line' => null, 'message' => $message]], 'warnings' => []];
    }
}
