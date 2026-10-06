<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A further photo of a product, shown after its main one (products.image_path).
 *
 * @property int $id
 * @property int $product_id
 * @property string $path
 * @property string $hash
 * @property int $position
 * @property-read string|null $url
 * @property-read Product $product
 */
class ProductImage extends Model
{
    /** Photos a product may have besides its main one. */
    public const MAX_PER_PRODUCT = 12;

    protected $fillable = ['product_id', 'path', 'hash', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return Attribute<string|null, never> */
    protected function url(): Attribute
    {
        return Attribute::get(fn (): ?string => Product::publicImageUrl($this->path));
    }
}
