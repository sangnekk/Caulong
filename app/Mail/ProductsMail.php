<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\RecommendationService;
use App\Support\Frontend;
use Illuminate\Database\Eloquent\Collection;

/**
 * A promotional email built around products: the ones a customer put in a cart and did not
 * order, or, a while after a delivery, an invitation to review what they received with a
 * few rackets that go with it. Prices and stock are read when the email is sent.
 */
class ProductsMail extends ShopMail
{
    public const REASONS = ['abandoned_cart', 'post_purchase'];

    /**
     * @param  value-of<self::REASONS>  $reason
     * @param  list<int>  $productIds  left in the cart, or received
     * @param  list<int>  $suggestedIds  what goes with them (post_purchase)
     */
    public function __construct(
        public User $user,
        public string $reason,
        public array $productIds,
        public array $suggestedIds = [],
        public ?Order $order = null,
    ) {}

    public function title(): string
    {
        return $this->reason === 'abandoned_cart'
            ? 'Bạn còn để quên vợt trong giỏ hàng'
            : 'Cây vợt mới của bạn thế nào?';
    }

    protected function subscriber(): ?User
    {
        return $this->user;
    }

    protected function body(): array
    {
        $catalog = app(RecommendationService::class);

        return ['emails.products', [
            'name' => $this->user->name,
            'reason' => $this->reason,
            'order' => $this->order,
            'products' => $this->cards($catalog->products($this->productIds), $this->reason === 'post_purchase' ? 'danh-gia' : ''),
            'suggested' => $this->cards($catalog->products($this->suggestedIds, false)),
            'cart' => Frontend::url('/cart'),
            'shop' => Frontend::url('/products'),
        ]];
    }

    /**
     * @param  Collection<int, Product>  $products  on sale, with their versions on sale
     * @return list<array{name: string, url: string, price: int|null}>
     */
    private function cards(Collection $products, string $fragment = ''): array
    {
        return array_values($products->map(fn (Product $product) => [
            'name' => $product->name,
            'url' => Frontend::product($product, $fragment),
            'price' => $product->variants->min('price') === null ? null : (int) $product->variants->min('price'),
        ])->all());
    }
}
