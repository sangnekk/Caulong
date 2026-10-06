<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A product as a card in a list of suggestions: what the card shows and nothing else. Reads
 * the `brand` and (active) `variants` relations.
 *
 * @mixin Product
 */
class ProductCardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $variants = $this->variants->where('is_active', true);
        $cheapest = $variants->sortBy('price')->first();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'image_url' => $this->image_url,
            'play_style' => $this->play_style,
            'is_demo' => $this->is_demo,
            'brand' => $this->brand?->name,
            'price' => $cheapest?->price,
            'compare_at_price' => $cheapest?->list_price,
            'in_stock' => $variants->contains(fn ($variant) => $variant->stock > 0),
        ];
    }
}
