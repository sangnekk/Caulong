<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int|null $brand_id
 * @property int|null $category_id
 * @property string $name
 * @property string $slug
 * @property string $description
 * @property string|null $image_path
 * @property array<string, string>|null $specs
 * @property string $play_style
 * @property string $skill_level
 * @property bool $is_active
 * @property bool $is_featured
 * @property bool $is_demo
 * @property-read string $image_url
 * @property-read non-empty-list<string> $gallery_urls
 * @property-read Brand|null $brand
 * @property-read Category|null $category
 * @property-read Collection<int, ProductVariant> $variants
 * @property-read Collection<int, ProductImage> $images
 */
class Product extends Model
{
    protected $fillable = ['brand_id', 'category_id', 'name', 'slug', 'description', 'image_path', 'specs', 'play_style', 'skill_level', 'is_active', 'is_featured', 'is_demo'];

    protected function casts(): array
    {
        return ['specs' => 'array', 'is_active' => 'boolean', 'is_featured' => 'boolean', 'is_demo' => 'boolean'];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return HasMany<ProductVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    /**
     * Further photos, in the order the shop gave them; the main one is image_path.
     *
     * @return HasMany<ProductImage, $this>
     */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<ProductReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    /**
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /** The public URL of a photo stored on the public disk, or null when the path is not one. */
    public static function publicImageUrl(?string $path): ?string
    {
        // ponytail: local image paths only; add a trusted CDN policy if needed.
        if (! is_string($path) || ! preg_match('~\A[a-zA-Z0-9_-]+(?:[a-zA-Z0-9_./-]*[a-zA-Z0-9_-])?\.(?:png|jpe?g|webp|gif)\z~i', $path)
            || in_array('..', explode('/', $path), true) || in_array('.', explode('/', $path), true)) {
            return null;
        }

        return Storage::disk('public')->url($path);
    }

    /** @return Attribute<string, never> */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): string => self::publicImageUrl($this->image_path) ?? '/models/hyper-core-poster.png');
    }

    /**
     * Every photo of the product, the main one first. Reads the `images` relation.
     *
     * @return Attribute<non-empty-list<string>, never>
     */
    protected function galleryUrls(): Attribute
    {
        return Attribute::get(fn (): array => array_values(array_unique([
            $this->image_url,
            ...$this->images->map(fn (ProductImage $image) => $image->url)->filter()->all(),
        ])));
    }
}
