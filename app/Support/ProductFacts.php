<?php

namespace App\Support;

/**
 * What the recommendation rules compare about a product: read in bulk, without models.
 * `price` is the lowest among the versions on sale (0 when there is none).
 */
final readonly class ProductFacts
{
    public function __construct(
        public int $id,
        public ?int $brandId,
        public ?int $categoryId,
        public string $playStyle,
        public string $skillLevel,
        public int $price,
        public bool $inStock,
        public string $balance = '',
        public string $stiffness = '',
    ) {}
}
