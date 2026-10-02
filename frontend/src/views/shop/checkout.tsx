import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { DemoBadge, FormErrors, OrderTotals } from '@/layouts/shop-layout';
import { vnd, type Cart } from '@/types/commerce';

type Props = {
    cart: Cart;
    checkoutToken: string;
    paymentMethods: { id: 'cod'; label: string }[];
};
type CheckoutFields = {
    checkout_token: string;
    name: string;
    phone: string;
    address: string;
    email: string;
    notes: string;
    payment_method: 'cod';
    accept_terms: boolean;
};

export default function Checkout({
    cart,
    checkoutToken,
    paymentMethods,
}: Props) {
    // A signed-in customer starts from their account's name and email; both stay editable.
    const { user } = usePage().props.auth;
    const form = useForm<CheckoutFields>({
        checkout_token: checkoutToken,
        name: user?.name ?? '',
        phone: '',
        address: '',
        email: user?.email ?? '',
        notes: '',
        payment_method: 'cod',
        accept_terms: false,
    });
    const unavailable = cart.items.some(
        (item) => item.is_available === false || item.stock < item.quantity,
    );
    const cod = paymentMethods.find((method) => method.id === 'cod');
    const fieldErrors = form.errors as Record<string, string | undefined>;
    return (
        <>
            <Head title="Đặt hàng">
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <header className="store-page-heading">
                <div>
                    <h1>Thông tin đặt hàng</h1>
                    <p>
                        Không cần đăng nhập. Kiểm tra thông tin trước khi xác
                        nhận.
                    </p>
                </div>
                <Link href="/cart" className="store-text-link">
                    Quay lại giỏ hàng
                </Link>
            </header>
            {!cart.items.length ? (
                <section className="store-empty">
                    <h2>Chưa có sản phẩm để đặt</h2>
                    <Link href="/products" className="store-button">
                        Xem sản phẩm
                    </Link>
                </section>
            ) : (
                <form
                    className="store-two-column"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/checkout', { preserveScroll: true });
                    }}
                >
                    <div className="store-checkout-fields">
                        <FormErrors errors={form.errors} />
                        {form.errors.checkout_token && (
                            <p>
                                <Link
                                    href="/checkout"
                                    className="store-text-link"
                                >
                                    Tải lại trang để lấy mã đặt hàng hợp lệ
                                </Link>
                            </p>
                        )}
                        {(unavailable || fieldErrors.cart) && (
                            <p className="store-error">
                                Giỏ hàng cần được kiểm tra lại.{' '}
                                <Link href="/cart">
                                    Về giỏ hàng để cập nhật
                                </Link>
                                .
                            </p>
                        )}
                        <fieldset disabled={form.processing}>
                            <legend>Người nhận hàng</legend>
                            <div className="store-field">
                                <label htmlFor="name">
                                    Họ và tên <span>(bắt buộc)</span>
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    autoComplete="name"
                                    required
                                    maxLength={120}
                                    value={form.data.name}
                                    aria-invalid={!!form.errors.name}
                                    aria-describedby={
                                        form.errors.name
                                            ? 'name-error'
                                            : undefined
                                    }
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                />
                                {form.errors.name && (
                                    <p
                                        id="name-error"
                                        className="store-field-error"
                                    >
                                        {form.errors.name}
                                    </p>
                                )}
                            </div>
                            <div className="store-field">
                                <label htmlFor="phone">
                                    Số điện thoại <span>(bắt buộc)</span>
                                </label>
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    autoComplete="tel"
                                    required
                                    maxLength={20}
                                    placeholder="Ví dụ: 0912345678"
                                    value={form.data.phone}
                                    aria-invalid={!!form.errors.phone}
                                    aria-describedby={
                                        form.errors.phone
                                            ? 'phone-error'
                                            : undefined
                                    }
                                    onChange={(event) =>
                                        form.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                />
                                {form.errors.phone && (
                                    <p
                                        id="phone-error"
                                        className="store-field-error"
                                    >
                                        {form.errors.phone}
                                    </p>
                                )}
                            </div>
                            <div className="store-field">
                                <label htmlFor="address">
                                    Địa chỉ nhận hàng <span>(bắt buộc)</span>
                                </label>
                                <textarea
                                    id="address"
                                    name="address"
                                    autoComplete="street-address"
                                    required
                                    maxLength={500}
                                    rows={3}
                                    placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố"
                                    value={form.data.address}
                                    aria-invalid={!!form.errors.address}
                                    aria-describedby={
                                        form.errors.address
                                            ? 'address-error'
                                            : undefined
                                    }
                                    onChange={(event) =>
                                        form.setData(
                                            'address',
                                            event.target.value,
                                        )
                                    }
                                />
                                {form.errors.address && (
                                    <p
                                        id="address-error"
                                        className="store-field-error"
                                    >
                                        {form.errors.address}
                                    </p>
                                )}
                            </div>
                            <div className="store-field">
                                <label htmlFor="email">
                                    Email <span>(không bắt buộc)</span>
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    maxLength={190}
                                    value={form.data.email}
                                    aria-invalid={!!form.errors.email}
                                    aria-describedby={
                                        form.errors.email
                                            ? 'email-error'
                                            : undefined
                                    }
                                    onChange={(event) =>
                                        form.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                />
                                {form.errors.email && (
                                    <p
                                        id="email-error"
                                        className="store-field-error"
                                    >
                                        {form.errors.email}
                                    </p>
                                )}
                            </div>
                            <div className="store-field">
                                <label htmlFor="notes">
                                    Ghi chú <span>(không bắt buộc)</span>
                                </label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    maxLength={1000}
                                    rows={3}
                                    value={form.data.notes}
                                    aria-invalid={!!form.errors.notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                        </fieldset>
                        <fieldset disabled={form.processing}>
                            <legend>Thanh toán</legend>
                            {cod ? (
                                <label className="store-payment">
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="cod"
                                        checked
                                        readOnly
                                    />
                                    <span>
                                        {cod.label}
                                        <small>
                                            Không cần chuyển khoản trước.
                                        </small>
                                    </span>
                                </label>
                            ) : (
                                <p className="store-error">
                                    Hiện chưa có phương thức thanh toán khả
                                    dụng.
                                </p>
                            )}
                        </fieldset>
                        <section
                            className="store-terms"
                            aria-labelledby="terms-heading"
                        >
                            <h2 id="terms-heading">Trước khi đặt hàng</h2>
                            <p>
                                Kiểm tra tên người nhận, số điện thoại, địa chỉ
                                và tổng tiền. Bạn thanh toán số tiền hiển thị
                                khi nhận hàng. Thông tin người nhận được dùng để
                                xử lý đơn.
                            </p>
                            <label className="store-check">
                                <input
                                    type="checkbox"
                                    required
                                    checked={form.data.accept_terms}
                                    disabled={form.processing}
                                    aria-invalid={!!form.errors.accept_terms}
                                    onChange={(event) =>
                                        form.setData(
                                            'accept_terms',
                                            event.target.checked,
                                        )
                                    }
                                />
                                <span>
                                    Tôi đã kiểm tra thông tin và đồng ý với nội
                                    dung đặt hàng ở trên.
                                </span>
                            </label>
                        </section>
                    </div>
                    <aside className="store-summary">
                        <h2>Đơn hàng của bạn</h2>
                        <ul className="store-order-items">
                            {cart.items.map((item) => (
                                <li key={item.variant_id}>
                                    <div>
                                        <strong>{item.name}</strong>
                                        <p>
                                            {item.variant_name} · Số lượng{' '}
                                            {item.quantity}
                                        </p>
                                        {item.is_demo && <DemoBadge />}
                                    </div>
                                    <span>{vnd(item.line_total)}</span>
                                </li>
                            ))}
                        </ul>
                        <OrderTotals totals={cart} hint />
                        {cart.items.some((item) => item.is_demo) && (
                            <p className="store-notice">
                                Đây sẽ là đơn mẫu vì có sản phẩm mẫu; không phải
                                giao dịch hàng thực tế.
                            </p>
                        )}
                        <button
                            className="store-button store-full"
                            disabled={
                                form.processing ||
                                unavailable ||
                                !cod ||
                                !form.data.accept_terms
                            }
                        >
                            {form.processing
                                ? 'Đang gửi đơn…'
                                : 'Xác nhận đặt hàng'}
                        </button>
                        <p className="store-hint" role="status">
                            {form.processing
                                ? 'Vui lòng chờ. Không đóng trang trong khi gửi đơn.'
                                : 'Tổng tiền đã bao gồm phí giao hàng hiển thị ở trên.'}
                        </p>
                    </aside>
                </form>
            )}
        </>
    );
}
