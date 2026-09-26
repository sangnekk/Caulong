<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'image_url' => $this->image_url,
            'play_style' => $this->play_style,
            'skill_level' => $this->skill_level,
            'specs' => $this->specs,
            'is_demo' => $this->is_demo,
            'is_featured' => $this->is_featured,
            'brand' => $this->brand?->only(['id', 'name', 'slug']),
            'category' => $this->category?->only(['id', 'name', 'slug']),
            'variants' => $this->variants->where('is_active', true)->values()->map(fn ($variant) => $variant->only(['id', 'sku', 'name', 'price', 'stock', 'is_active']))->all(),
        ];
    }
}
