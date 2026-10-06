<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Coupons: whether a code may be used on a cart, what it takes off, and the record of its use.
 *
 * The figure the customer sees (cart, checkout) and the one the order is saved with both come
 * from quote(); nothing from the browser but the code itself is trusted. Sample products are
 * left out: a coupon never applies to them and a sample order never uses one up.
 */
class CouponService
{
    /**
     * Said whenever the true reason would tell a stranger that a code exists or whose it is:
     * unknown code, switched off, someone else's, another customer group's.
     */
    public const UNUSABLE = 'Mã giảm giá không hợp lệ. Nếu đây là mã dành riêng cho bạn, hãy đăng nhập đúng tài khoản được tặng mã.';

    /** Letters and digits that are not mistaken for one another when read or typed. */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(private CustomerSegmentation $segments) {}

    /**
     * What the code takes off these cart lines for this customer.
     *
     * @param  list<array{product_id: int|null, category_id: int|null, line_total: int, is_demo: bool}>  $lines
     * @param  string|null  $phone  the order's phone number once known: a guest's limit is counted by it
     * @param  bool  $lock  inside the checkout transaction: holds the coupon until the order is saved
     * @return array{coupon: Coupon, discount: int}
     *
     * @throws ValidationException under "coupon", in words for the customer
     */
    public function quote(string $code, ?User $user, array $lines, ?string $phone = null, bool $lock = false): array
    {
        $coupon = Coupon::query()->where('code', Coupon::normalize($code))
            ->when($lock, fn (Builder $query) => $query->lockForUpdate())->first();
        if (! $coupon || ! $coupon->is_active || ! $this->mayUse($coupon, $user)) {
            $this->reject(self::UNUSABLE);
        }
        if ($coupon->starts_at?->isFuture()) {
            $this->reject('Mã giảm giá chưa đến ngày áp dụng.');
        }
        if ($coupon->expires_at?->isPast()) {
            $this->reject('Mã giảm giá đã hết hạn.');
        }
        if ($coupon->usage_limit !== null && $coupon->redemptions()->count() >= $coupon->usage_limit) {
            $this->reject('Mã giảm giá đã hết lượt sử dụng.');
        }
        if ($coupon->per_customer_limit !== null && $this->usedBy($coupon, $user, $phone) >= $coupon->per_customer_limit) {
            $this->reject('Bạn đã dùng hết lượt của mã giảm giá này.');
        }

        $real = array_values(array_filter($lines, fn (array $line) => ! $line['is_demo']));
        $goods = array_sum(array_column($real, 'line_total'));
        if ($goods === 0) {
            $this->reject('Mã giảm giá không áp dụng cho sản phẩm mẫu.');
        }
        $eligible = $this->eligible($coupon, $real);
        if ($eligible === 0) {
            $this->reject('Mã này không áp dụng cho sản phẩm trong giỏ.');
        }
        if ($goods < $coupon->min_order) {
            $this->reject('Mã này áp dụng cho đơn có tiền hàng từ '.number_format($coupon->min_order, 0, ',', '.').' ₫.');
        }

        $discount = $coupon->type === 'percent' ? intdiv($eligible * $coupon->value, 100) : $coupon->value;
        if ($coupon->max_discount !== null) {
            $discount = min($discount, $coupon->max_discount);
        }

        // Never more than the goods it applies to.
        return ['coupon' => $coupon, 'discount' => min($discount, $eligible)];
    }

    /** Counts the order as one use. Called inside the transaction that creates the order. */
    public function redeem(Coupon $coupon, Order $order, int $amount): CouponRedemption
    {
        return $coupon->redemptions()->create(['user_id' => $order->user_id, 'order_id' => $order->id, 'amount' => $amount]);
    }

    /** A cancelled order gives its use back; the order keeps the code it was placed with. */
    public function release(Order $order): void
    {
        $order->redemption()->delete();
    }

    /**
     * A coupon for one customer alone, usable once, under a code nobody can guess.
     *
     * @param  array{name: string, type: string, value: int, min_order?: int, max_discount?: int|null, starts_at?: mixed, expires_at?: mixed, campaign?: string|null}  $terms
     */
    public function issue(User $user, array $terms): Coupon
    {
        return Coupon::create([
            ...$terms,
            'code' => $this->newCode(),
            'user_id' => $user->id,
            'segment' => null,
            'usage_limit' => 1,
            'per_customer_limit' => 1,
            'is_active' => true,
        ]);
    }

    /** Ten random characters: about 10^15 possibilities, checked against the codes in use. */
    public function newCode(): string
    {
        do {
            $code = '';
            for ($i = 0; $i < 10; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
        } while (Coupon::query()->where('code', $code)->exists());

        return $code;
    }

    /**
     * The coupons a customer was given: their own and the ones for their group, the latest
     * first, each with where it stands for them. Switched-off coupons are not listed.
     *
     * @return list<array{code: string, name: string, type: string, value: int, min_order: int, max_discount: int|null, starts_at: string|null, expires_at: string|null, personal: bool, state: 'usable'|'scheduled'|'expired'|'used'}>
     */
    public function givenTo(User $user): array
    {
        $coupons = Coupon::query()->where('is_active', true)
            ->where(fn (Builder $query) => $query->where('user_id', $user->id)
                ->when($user->segment !== null, fn (Builder $query) => $query->orWhere(fn (Builder $query) => $query
                    ->whereNull('user_id')->where('segment', $user->segment))))
            ->withCount(['redemptions', 'redemptions as mine_count' => fn (Builder $query) => $query->where('user_id', $user->id)])
            ->latest('id')->limit(30)->get();

        return array_values($coupons->map(function (Coupon $coupon): array {
            $used = (int) $coupon->getAttribute('redemptions_count');
            $mine = (int) $coupon->getAttribute('mine_count');
            $state = match ($coupon->state($used)) {
                'expired' => 'expired',
                'scheduled' => 'scheduled',
                'used_up' => 'used',
                default => $coupon->per_customer_limit !== null && $mine >= $coupon->per_customer_limit ? 'used' : 'usable',
            };

            return [
                ...$coupon->only(['code', 'name', 'type', 'value', 'min_order', 'max_discount']),
                'starts_at' => $coupon->starts_at?->toIso8601String(),
                'expires_at' => $coupon->expires_at?->toIso8601String(),
                'personal' => $coupon->user_id !== null,
                'state' => $state,
            ];
        })->all());
    }

    private function mayUse(Coupon $coupon, ?User $user): bool
    {
        if ($coupon->user_id !== null) {
            return $user !== null && $user->id === $coupon->user_id;
        }
        if ($coupon->segment !== null) {
            // The group as it is right now, not as the nightly run left it.
            return $user !== null && $this->segments->refresh($user) === $coupon->segment;
        }

        return true;
    }

    /** Orders that stand in which this customer (their account, or the same phone) used the coupon. */
    private function usedBy(Coupon $coupon, ?User $user, ?string $phone): int
    {
        if ($user === null && $phone === null) {
            return 0;
        }

        return $coupon->redemptions()->where(function (Builder $query) use ($user, $phone): void {
            if ($user !== null) {
                $query->where('coupon_redemptions.user_id', $user->id);
            }
            if ($phone !== null) {
                $query->orWhereHas('order', fn (Builder $query) => $query->where('phone', $phone));
            }
        })->count();
    }

    /**
     * The value of the lines the coupon counts: all of them, or only the listed products and
     * categories when it lists any.
     *
     * @param  list<array{product_id: int|null, category_id: int|null, line_total: int, is_demo: bool}>  $lines
     */
    private function eligible(Coupon $coupon, array $lines): int
    {
        $products = $coupon->products()->pluck('products.id')->map(fn ($id) => (int) $id)->all();
        $categories = $coupon->categories()->pluck('categories.id')->map(fn ($id) => (int) $id)->all();
        if ($products !== [] || $categories !== []) {
            $lines = array_filter($lines, fn (array $line) => in_array($line['product_id'], $products, true)
                || in_array($line['category_id'], $categories, true));
        }

        return array_sum(array_column($lines, 'line_total'));
    }

    private function reject(string $message): never
    {
        throw ValidationException::withMessages(['coupon' => $message]);
    }
}
