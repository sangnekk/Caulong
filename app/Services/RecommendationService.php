<?php

namespace App\Services;

use App\Models\CustomerEvent;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\ProductFacts;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as Rows;
use Illuminate\Support\Facades\Cache;

/**
 * Rule-based product recommendations. A candidate earns points for what it shares with the
 * product on screen (or with what the customer bought and looked at); the best totals win.
 *
 * Sales signals count real orders only: not demo, not cancelled. Where the shop has too few
 * of them the rules run on product attributes alone. Nothing is ever shown as popular or
 * bought together without the orders behind it.
 */
class RecommendationService
{
    /** Points per signal. */
    public const WEIGHTS = [
        'same_category' => 5,
        'same_brand' => 3,
        'same_style' => 4,
        'same_level' => 2,
        // Within NEAR_PRICE of the other product's price.
        'near_price' => 3,
        // Each of balance point and shaft stiffness stated the same way.
        'same_spec' => 1,
        'in_stock' => 4,
        // The best seller of the period earns all of it, the others in proportion.
        'popular' => 10,
        'bought_together' => 8,
        // Resembles something the customer bought, saved for later, or only looked at.
        'purchased' => 5,
        'wishlisted' => 4,
        'viewed' => 2,
    ];

    private const NEAR_PRICE = 0.2;

    /** Sales older than this say little about what sells now. */
    private const SALES_DAYS = 90;

    /** Orders two products must share before they are called "bought together". */
    private const MIN_TOGETHER = 2;

    /** How many of a customer's purchases and views shape their suggestions. */
    private const SEEDS = 8;

    /**
     * Units sold per product over the last SALES_DAYS, best seller first.
     *
     * @return array<int, int>
     */
    public function sales(): array
    {
        return Cache::remember('recommendations:sales', now()->addMinutes(15), fn (): array => $this->sold()
            ->where('orders.created_at', '>=', now()->subDays(self::SALES_DAYS))
            ->groupBy('product_variants.product_id')
            ->orderByDesc('units')->orderBy('product_variants.product_id')->limit(200)
            ->selectRaw('product_variants.product_id as product_id, sum(order_items.quantity) as units')
            ->pluck('units', 'product_id')->map(fn ($units) => (int) $units)->all());
    }

    /** Units of the product in every real order that was not cancelled. */
    public function soldCount(Product $product): int
    {
        return (int) $this->sold()->where('product_variants.product_id', $product->id)->sum('order_items.quantity');
    }

    /**
     * What sells: only products with real sales behind them, so it may be shorter than asked.
     *
     * @param  list<int>  $except
     * @return Collection<int, Product>
     */
    public function popular(int $limit = 8, array $except = []): Collection
    {
        return $this->products(array_slice(array_values(array_diff(array_keys($this->sales()), $except)), 0, $limit * 2), false)->take($limit)->values();
    }

    /**
     * More of the same family: the product's brand (its category when it has no brand).
     *
     * @param  list<int>  $except
     * @return Collection<int, Product>
     */
    public function related(Product $product, int $limit = 4, array $except = []): Collection
    {
        if ($product->brand_id === null && $product->category_id === null) {
            return (new Product)->newCollection();
        }

        return $this->alike($product, $limit, $except, fn (Builder $query) => $product->brand_id !== null
            ? $query->where('brand_id', $product->brand_id)
            : $query->where('category_id', $product->category_id));
    }

    /**
     * Alternatives that play the same way, from other brands, so the two lists never repeat
     * each other.
     *
     * @param  list<int>  $except
     * @return Collection<int, Product>
     */
    public function similar(Product $product, int $limit = 4, array $except = []): Collection
    {
        return $this->alike($product, $limit, $except, fn (Builder $query) => $query->where('play_style', $product->play_style)
            ->when($product->brand_id !== null, fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereNull('brand_id')->orWhere('brand_id', '!=', $product->brand_id))));
    }

    /**
     * Products that real orders hold together with this one, most often first.
     *
     * @return Collection<int, Product>
     */
    public function boughtTogether(Product $product, int $limit = 4): Collection
    {
        $orders = $this->sold()->where('product_variants.product_id', $product->id)->select('order_items.order_id');
        $ids = OrderItem::query()
            ->join('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            ->whereIn('order_items.order_id', $orders)
            ->where('product_variants.product_id', '!=', $product->id)
            ->groupBy('product_variants.product_id')
            ->havingRaw('count(distinct order_items.order_id) >= ?', [self::MIN_TOGETHER])
            ->orderByDesc('together')->orderBy('product_variants.product_id')->limit($limit * 2)
            ->selectRaw('product_variants.product_id as product_id, count(distinct order_items.order_id) as together')
            ->pluck('product_id')->map(fn ($id) => (int) $id)->all();

        return $this->products(array_values($ids), (bool) $product->is_demo)->take($limit)->values();
    }

    /**
     * Suggestions for one customer, from what they bought and saved (their account) and what
     * they looked at (ids kept by their browser, plus the account's own history). With nothing
     * to go on, what sells; with no sales either, nothing: the caller shows no list rather than
     * a made-up one.
     *
     * @param  list<int>  $viewed  most recent first
     * @param  list<int>  $except
     * @return array{basis: 'personal'|'popular'|null, products: Collection<int, Product>}
     */
    public function personalized(?User $user, array $viewed, int $limit = 8, array $except = []): array
    {
        $purchased = $user ? $this->purchasedBy($user) : [];
        $wished = $user ? array_values(array_diff($this->wishedBy($user), $purchased)) : [];
        // This browser's list first, then what the account looked at on other devices.
        $viewed = array_slice(array_values(array_unique(array_diff(
            [...$viewed, ...($user ? $this->viewedBy($user) : [])], $purchased, $wished,
        ))), 0, self::SEEDS);
        $known = [...$purchased, ...$wished, ...$viewed];
        // A racket no longer on sale still says what the customer likes; sample data does not.
        $seeds = $known ? $this->facts(fn (Builder $query) => $query->whereKey($known)->where('is_demo', false), false, false) : new Rows;

        if ($seeds->isNotEmpty()) {
            $sales = $this->sales();
            $top = max([1, ...$sales]);
            $pool = $this->facts(fn (Builder $query) => $query->where('is_demo', false)->whereKeyNot([...$known, ...$except])
                ->where(fn (Builder $query) => $query->whereIn('brand_id', $seeds->pluck('brandId')->filter()->unique()->all())
                    ->orWhereIn('play_style', $seeds->pluck('playStyle')->unique()->all())), false);
            $scores = [];
            foreach ($pool as $candidate) {
                $best = 0;
                foreach ($seeds as $seed) {
                    $best = max($best, $this->points($candidate, $seed) + self::WEIGHTS[match (true) {
                        in_array($seed->id, $purchased, true) => 'purchased',
                        in_array($seed->id, $wished, true) => 'wishlisted',
                        default => 'viewed',
                    }]);
                }
                $scores[$candidate->id] = [$best + $this->popularity($candidate->id, $sales, $top), $candidate->id];
            }
            $products = $this->products($this->best($scores, $limit), false);
            if ($products->count() >= min(4, $limit)) {
                return ['basis' => 'personal', 'products' => $products];
            }
        }
        $popular = $this->popular($limit, [...$known, ...$except]);

        return $popular->count() >= min(4, $limit)
            ? ['basis' => 'popular', 'products' => $popular]
            : ['basis' => null, 'products' => (new Product)->newCollection()];
    }

    /**
     * Products on sale for the given ids, in that order, ready to be shown as cards.
     *
     * @param  list<int>  $ids
     * @return Collection<int, Product>
     */
    public function products(array $ids, ?bool $demo = null): Collection
    {
        if ($ids === []) {
            return (new Product)->newCollection();
        }
        $order = array_flip($ids);

        return Product::query()->active()->whereKey($ids)
            ->when($demo !== null, fn (Builder $query) => $query->where('is_demo', $demo))
            ->whereHas('variants', fn (Builder $query) => $query->where('is_active', true))
            ->with(['brand:id,name,slug', 'variants' => fn ($query) => $query->active()->orderBy('id')])
            ->get()->sortBy(fn (Product $product) => $order[$product->id])->values();
    }

    /**
     * The best-scoring products of a pool, compared with one product.
     *
     * @param  list<int>  $except
     * @param  callable(Builder<Product>): mixed  $pool
     * @return Collection<int, Product>
     */
    private function alike(Product $product, int $limit, array $except, callable $pool): Collection
    {
        $seed = $this->facts(fn (Builder $query) => $query->whereKey($product->id), true, false)->first();
        if ($seed === null) {
            return (new Product)->newCollection();
        }
        $sales = $this->sales();
        $top = max([1, ...$sales]);
        $scores = [];
        // Demo rackets stay among themselves: a real product never points at sample data.
        foreach ($this->facts(fn (Builder $query) => $pool($query->where('is_demo', (bool) $product->is_demo)->whereKeyNot([$product->id, ...$except]))) as $candidate) {
            $scores[$candidate->id] = [
                $this->points($candidate, $seed) + $this->popularity($candidate->id, $sales, $top),
                // Equal scores: the closer price first, then the newer product.
                -abs($candidate->price - $seed->price),
                $candidate->id,
            ];
        }

        return $this->products($this->best($scores, $limit), (bool) $product->is_demo);
    }

    /** What two products share, in points. */
    private function points(ProductFacts $candidate, ProductFacts $seed): int
    {
        $points = 0;
        if ($seed->categoryId !== null && $candidate->categoryId === $seed->categoryId) {
            $points += self::WEIGHTS['same_category'];
        }
        if ($seed->brandId !== null && $candidate->brandId === $seed->brandId) {
            $points += self::WEIGHTS['same_brand'];
        }
        if ($candidate->playStyle === $seed->playStyle) {
            $points += self::WEIGHTS['same_style'];
        }
        if ($candidate->skillLevel === $seed->skillLevel || $candidate->skillLevel === 'all') {
            $points += self::WEIGHTS['same_level'];
        }
        if ($seed->price > 0 && abs($candidate->price - $seed->price) <= $seed->price * self::NEAR_PRICE) {
            $points += self::WEIGHTS['near_price'];
        }
        if ($seed->balance !== '' && $candidate->balance === $seed->balance) {
            $points += self::WEIGHTS['same_spec'];
        }
        if ($seed->stiffness !== '' && $candidate->stiffness === $seed->stiffness) {
            $points += self::WEIGHTS['same_spec'];
        }
        if ($candidate->inStock) {
            $points += self::WEIGHTS['in_stock'];
        }

        return $points;
    }

    /** @param  array<int, int>  $sales */
    private function popularity(int $id, array $sales, int $top): int
    {
        return (int) round(self::WEIGHTS['popular'] * ($sales[$id] ?? 0) / $top);
    }

    /**
     * Ids of the highest scores. Each score is a list compared item by item, highest first.
     *
     * @param  array<int, list<int>>  $scores
     * @return list<int>
     */
    private function best(array $scores, int $limit): array
    {
        uasort($scores, fn (array $a, array $b) => $b <=> $a);

        return array_slice(array_keys($scores), 0, $limit);
    }

    /**
     * The facts the rules compare, for products on sale that have a price: one light query, no
     * models. `$onSale` off reads the product whatever its state (the one being compared with).
     *
     * @param  callable(Builder<Product>): mixed  $scope
     * @return Rows<int, ProductFacts>
     */
    private function facts(callable $scope, bool $specs = true, bool $onSale = true): Rows
    {
        $query = Product::query()->when($onSale, fn (Builder $query) => $query->active());
        $scope($query);
        $variants = fn (): Builder => ProductVariant::query()->whereColumn('product_id', 'products.id')->where('is_active', true);

        return $query->toBase()
            ->select(['products.id', 'brand_id', 'category_id', 'play_style', 'skill_level', ...($specs ? ['specs'] : [])])
            ->selectSub($variants()->selectRaw('min(price)'), 'price')
            ->selectSub($variants()->where('stock', '>', 0)->selectRaw('count(*)'), 'stocked')
            ->get()
            ->filter(fn (object $row) => $row->price !== null || ! $onSale)
            ->map(function (object $row) use ($specs): ProductFacts {
                $stated = $specs ? (array) json_decode((string) ($row->specs ?? ''), true) : [];

                return new ProductFacts(
                    id: (int) $row->id,
                    brandId: $row->brand_id === null ? null : (int) $row->brand_id,
                    categoryId: $row->category_id === null ? null : (int) $row->category_id,
                    playStyle: (string) $row->play_style,
                    skillLevel: (string) $row->skill_level,
                    price: (int) $row->price,
                    inStock: (int) $row->stocked > 0,
                    balance: mb_strtolower(trim((string) ($stated['balance'] ?? ''))),
                    stiffness: mb_strtolower(trim((string) ($stated['stiffness'] ?? ''))),
                );
            })->values();
    }

    /**
     * Products the customer bought in real orders, most recent first.
     *
     * @return list<int>
     */
    private function purchasedBy(User $user): array
    {
        return array_values($this->sold()->where('orders.user_id', $user->id)
            ->groupBy('product_variants.product_id')
            ->orderByRaw('max(orders.created_at) desc')->limit(self::SEEDS)
            ->pluck('product_variants.product_id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * Products the customer saved for later, the latest first.
     *
     * @return list<int>
     */
    private function wishedBy(User $user): array
    {
        return array_values($user->wishlist()->limit(self::SEEDS)->pluck('products.id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * Products the account looked at or put in the cart, most recent first (customer_events).
     *
     * @return list<int>
     */
    private function viewedBy(User $user): array
    {
        return array_values(CustomerEvent::query()->where('user_id', $user->id)
            ->whereIn('name', ['product_view', 'add_to_cart'])->whereNotNull('product_id')
            ->groupBy('product_id')->orderByRaw('max(created_at) desc')->limit(self::SEEDS)
            ->pluck('product_id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * Order lines of real orders that were not cancelled, joined to their order and variant.
     *
     * @return Builder<OrderItem>
     */
    private function sold(): Builder
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            ->where('orders.is_demo', false)->where('orders.status', '!=', 'cancelled');
    }
}
