<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Product;
use App\Models\User;
use App\Services\CouponService;
use App\Services\CustomerSegmentation;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Discount codes: for everyone, for one customer, or for a customer group. Dates are whole
 * days in the shop's time zone: a coupon starts with its first day and ends with its last.
 */
class CouponController extends Controller
{
    private const STATES = ['active', 'scheduled', 'ended', 'off'];

    /** True for a coupon whose every allowed use has been taken. */
    private const USED_UP = '(coupons.usage_limit is not null and (select count(*) from coupon_redemptions where coupon_redemptions.coupon_id = coupons.id) >= coupons.usage_limit)';

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'state' => ['nullable', Rule::in(self::STATES)],
            'q' => ['nullable', 'string', 'max:40'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $filters = ['state' => $validated['state'] ?? '', 'q' => trim($validated['q'] ?? '')];
        $base = fn (): Builder => Coupon::query()->when($filters['q'] !== '', fn (Builder $query) => $query
            ->where(fn (Builder $query) => $query->where('code', 'like', '%'.Coupon::normalize($filters['q']).'%')
                ->orWhere('name', 'like', '%'.$filters['q'].'%')->orWhere('campaign', 'like', '%'.$filters['q'].'%')));

        return Inertia::render('admin/coupons', [
            'coupons' => $base()->when($filters['state'], fn (Builder $query, string $state) => $this->inState($query, $state))
                ->with('user:id,name,email')->withCount('redemptions')->withSum('redemptions as discounted', 'amount')
                ->latest('id')->paginate(25)->withQueryString()
                ->through(fn (Coupon $coupon) => [
                    ...$coupon->only(['id', 'code', 'name', 'type', 'value', 'min_order', 'max_discount', 'usage_limit', 'per_customer_limit', 'segment', 'campaign']),
                    'starts_at' => $coupon->starts_at,
                    'expires_at' => $coupon->expires_at,
                    'customer' => $coupon->user?->only(['id', 'name', 'email']),
                    'used' => (int) $coupon->getAttribute('redemptions_count'),
                    'discounted' => (int) $coupon->getAttribute('discounted'),
                    'state' => $coupon->state((int) $coupon->getAttribute('redemptions_count')),
                ]),
            'filters' => $filters,
            'counts' => ['all' => $base()->count()] + array_combine(self::STATES, array_map(
                fn (string $state) => $this->inState($base(), $state)->count(), self::STATES,
            )),
        ]);
    }

    public function create(Request $request, CouponService $coupons): Response
    {
        $validated = $request->validate(['customer' => ['nullable', 'integer', 'min:1']]);
        $customer = isset($validated['customer']) ? User::query()->where('is_admin', false)->whereKey((int) $validated['customer'])->first() : null;

        return $this->form(null, $customer, $coupons->newCode());
    }

    public function store(Request $request): RedirectResponse
    {
        $coupon = $this->save(new Coupon, $request);

        return redirect()->route('admin.coupons.edit', $coupon)->with('success', 'Đã tạo mã '.$coupon->code.'.');
    }

    public function edit(Coupon $coupon): Response
    {
        return $this->form($coupon->load(['user:id,name,email', 'products:id,name', 'categories:id']), null, null);
    }

    public function update(Request $request, Coupon $coupon): RedirectResponse
    {
        $this->save($coupon, $request);

        return back()->with('success', 'Đã lưu mã giảm giá.');
    }

    /** Only a coupon no order has used can go; one that was used is switched off instead. */
    public function destroy(Coupon $coupon): RedirectResponse
    {
        if ($coupon->redemptions()->exists()) {
            throw ValidationException::withMessages(['coupon' => 'Mã này đã được dùng trong đơn hàng nên không xóa được. Hãy tắt mã để khách không dùng tiếp.']);
        }
        $coupon->delete();

        return redirect()->route('admin.coupons.index')->with('success', 'Đã xóa mã '.$coupon->code.'.');
    }

    /** Products for the form's "only these products" picker, by name or SKU. */
    public function products(Request $request): JsonResponse
    {
        $validated = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);
        $q = trim($validated['q']);

        return response()->json(Product::query()->where('is_demo', false)
            ->where(fn (Builder $query) => $query->where('name', 'like', '%'.$q.'%')
                ->orWhereHas('variants', fn (Builder $query) => $query->where('sku', 'like', $q.'%')))
            ->orderBy('name')->limit(10)->get(['id', 'name']));
    }

    private function form(?Coupon $coupon, ?User $customer, ?string $suggestedCode): Response
    {
        $day = fn (?CarbonImmutable $moment): string => $moment?->setTimezone((string) config('shop.timezone'))->format('Y-m-d') ?? '';

        return Inertia::render('admin/coupon-form', [
            'coupon' => $coupon ? [
                ...$coupon->only(['id', 'code', 'name', 'type', 'value', 'min_order', 'max_discount', 'usage_limit', 'per_customer_limit', 'segment', 'campaign', 'is_active']),
                'starts_on' => $day($coupon->starts_at?->toImmutable()),
                'expires_on' => $day($coupon->expires_at?->toImmutable()),
                'customer' => $coupon->user?->only(['id', 'name', 'email']),
                'products' => $coupon->products->map(fn (Product $product) => $product->only(['id', 'name']))->all(),
                'category_ids' => $coupon->categories->modelKeys(),
                'used' => $coupon->redemptions()->count(),
            ] : null,
            'customer' => $customer?->only(['id', 'name', 'email']),
            'suggestedCode' => $suggestedCode,
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
            'segments' => CustomerSegmentation::SEGMENTS,
        ]);
    }

    private function save(Coupon $coupon, Request $request): Coupon
    {
        $request->merge(['code' => Coupon::normalize((string) $request->input('code'))]);
        $percent = $request->input('type') === 'percent';
        $data = $request->validate([
            'code' => ['required', 'string', 'max:40', 'regex:/\A[A-Z0-9_-]+\z/', Rule::unique('coupons', 'code')->ignore($coupon->id)],
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(Coupon::TYPES)],
            'value' => ['required', 'integer', 'min:1', $percent ? 'max:100' : 'max:1000000000'],
            'min_order' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'max_discount' => ['nullable', 'integer', 'min:1000', 'max:1000000000'],
            'starts_on' => ['nullable', 'date_format:Y-m-d'],
            'expires_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'audience' => ['required', Rule::in(['all', 'customer', 'segment'])],
            // Staff accounts are not customers.
            'customer_email' => ['exclude_unless:audience,customer', 'required', 'email', Rule::exists('users', 'email')->where(fn ($query) => $query->where('is_admin', false))],
            'segment' => ['exclude_unless:audience,segment', 'required', Rule::in(CustomerSegmentation::SEGMENTS)],
            'campaign' => ['nullable', 'string', 'max:80'],
            'category_ids' => ['array', 'max:100'],
            'category_ids.*' => ['integer', Rule::exists('categories', 'id')],
            'product_ids' => ['array', 'max:200'],
            'product_ids.*' => ['integer', Rule::exists('products', 'id')],
            'is_active' => ['required', 'boolean'],
        ], [
            'code.required' => 'Nhập mã giảm giá.',
            'code.regex' => 'Mã chỉ gồm chữ không dấu, số, dấu gạch ngang và gạch dưới, không có khoảng trắng.',
            'code.unique' => 'Mã này đã có. Chọn mã khác.',
            'code.*' => 'Mã giảm giá tối đa 40 ký tự.',
            'name.*' => 'Nhập tên hiển thị cho khách, tối đa 120 ký tự.',
            'type.*' => 'Chọn giảm theo phần trăm hoặc số tiền.',
            'value.*' => $percent ? 'Phần trăm giảm phải từ 1 đến 100.' : 'Số tiền giảm phải từ 1 ₫.',
            'min_order.*' => 'Giá trị đơn tối thiểu phải là số tiền hợp lệ.',
            'max_discount.*' => 'Mức giảm tối đa phải từ 1.000 ₫, hoặc để trống.',
            'starts_on.*' => 'Ngày bắt đầu không hợp lệ.',
            'expires_on.*' => 'Ngày hết hạn không được trước ngày bắt đầu.',
            'usage_limit.*' => 'Tổng lượt dùng phải từ 1, hoặc để trống nếu không giới hạn.',
            'per_customer_limit.*' => 'Lượt dùng mỗi khách phải từ 1, hoặc để trống nếu không giới hạn.',
            'audience.*' => 'Chọn ai được dùng mã.',
            'customer_email.*' => 'Không có tài khoản khách hàng nào dùng email này.',
            'segment.*' => 'Chọn một nhóm khách hàng.',
            'campaign.*' => 'Tên chiến dịch tối đa 80 ký tự.',
            'category_ids.*' => 'Danh mục không hợp lệ.',
            'product_ids.*' => 'Sản phẩm không hợp lệ.',
        ]);
        $zone = (string) config('shop.timezone');
        $day = fn (?string $value): ?CarbonImmutable => $value === null ? null : CarbonImmutable::createFromFormat('Y-m-d', $value, $zone);

        return DB::transaction(function () use ($coupon, $data, $percent, $day): Coupon {
            $coupon->fill([
                ...array_intersect_key($data, array_flip(['code', 'name', 'type', 'value', 'usage_limit', 'per_customer_limit', 'is_active'])),
                'min_order' => (int) ($data['min_order'] ?? 0),
                // A ceiling only means something for a percentage.
                'max_discount' => $percent ? ($data['max_discount'] ?? null) : null,
                'starts_at' => $day($data['starts_on'] ?? null)?->startOfDay()->utc(),
                'expires_at' => $day($data['expires_on'] ?? null)?->endOfDay()->utc(),
                'user_id' => $data['audience'] === 'customer' ? User::query()->where('email', $data['customer_email'])->value('id') : null,
                'segment' => $data['audience'] === 'segment' ? $data['segment'] : null,
                'campaign' => $data['campaign'] ?? null,
            ])->save();
            $coupon->products()->sync($data['product_ids'] ?? []);
            $coupon->categories()->sync($data['category_ids'] ?? []);

            return $coupon;
        });
    }

    /**
     * @param  Builder<Coupon>  $query
     * @return Builder<Coupon>
     */
    private function inState(Builder $query, string $state): Builder
    {
        $now = now();
        $open = fn (Builder $query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', $now);

        return match ($state) {
            'off' => $query->where('is_active', false),
            'ended' => $query->where('is_active', true)
                ->where(fn (Builder $query) => $query->where('expires_at', '<=', $now)->orWhereRaw(self::USED_UP)),
            'scheduled' => $query->where('is_active', true)->where('starts_at', '>', $now)->where($open)->whereRaw('not '.self::USED_UP),
            default => $query->where('is_active', true)->where($open)->whereRaw('not '.self::USED_UP)
                ->where(fn (Builder $query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now)),
        };
    }
}
