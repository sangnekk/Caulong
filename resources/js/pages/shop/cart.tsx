import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    DemoBadge,
    FormErrors,
    OrderTotals,
    ProductImage,
} from '@/layouts/shop-layout';
import { vnd, type Cart as CartData, type CartItem } from '@/types/commerce';

function CartRow({
    item,
    onChange,
}: {
    item: CartItem;
    onChange: (id: number, dirty: boolean) => void;
}) {
    const form = useForm({ quantity: item.quantity });
    const unavailable = item.is_available === false || item.stock < 1;
    const invalid =
        !Number.isInteger(form.data.quantity) ||
        form.data.quantity < 1 ||
        form.data.quantity > Math.min(20, item.stock);
    return (
        <article className="store-cart-row">
            <ProductImage src={item.image_url} name={item.name} />
            <div className="store-cart-info">
                <h2>
                    {unavailable ? (
                        item.name
                    ) : (
                        <Link href={'/products/' + item.slug}>{item.name}</Link>
                    )}
                </h2>
                <p>
                    {item.variant_name} · {item.sku}
                </p>
                {item.is_demo && <DemoBadge />}
                <p>{vnd(item.price)} / sản phẩm</p>
                {unavailable ? (
                    <p className="store-field-error">
                        Sản phẩm không còn khả dụng. Vui lòng xóa khỏi giỏ.
                    </p>
                ) : (
                    item.quantity > item.stock && (
                        <p className="store-field-error">
                            Chỉ còn {item.stock} sản phẩm. Vui lòng giảm số
                            lượng.
                        </p>
                    )
                )}
                <form
                    className="store-cart-controls"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onChange(item.variant_id, true);
                        form.patch('/cart/items/' + item.variant_id, {
                            preserveScroll: true,
                            onSuccess: () => onChange(item.variant_id, false),
                        });
                    }}
                >
                    <div className="store-field">
                        <label htmlFor={'quantity-' + item.variant_id}>
                            Số lượng
                        </label>
                        <input
                            id={'quantity-' + item.variant_id}
                            type="number"
                            required
                            min={1}
                            max={Math.max(1, Math.min(20, item.stock))}
                            step={1}
                            disabled={unavailable || form.processing}
                            value={form.data.quantity}
                            aria-invalid={!!form.errors.quantity}
                            onChange={(event) => {
                                form.setData(
                                    'quantity',
                                    Number(event.target.value),
                                );
                                onChange(
                                    item.variant_id,
                                    Number(event.target.value) !==
                                        item.quantity,
                                );
                            }}
                        />
                    </div>
                    <button
                        className="store-button store-button-secondary"
                        disabled={
                            form.processing ||
                            unavailable ||
                            invalid ||
                            form.data.quantity === item.quantity
                        }
                    >
                        Cập nhật
                    </button>
                    <button
                        className="store-remove"
                        type="button"
                        disabled={form.processing}
                        onClick={() => {
                            onChange(item.variant_id, true);
                            form.delete('/cart/items/' + item.variant_id, {
                                preserveScroll: true,
                                onSuccess: () =>
                                    onChange(item.variant_id, false),
                                onError: () =>
                                    onChange(
                                        item.variant_id,
                                        form.data.quantity !== item.quantity,
                                    ),
                            });
                        }}
                        aria-label={'Xóa ' + item.name}
                    >
                        Xóa
                    </button>
                </form>
                <FormErrors errors={form.errors} />
                {form.processing && <p role="status">Đang cập nhật giỏ…</p>}
            </div>
            <strong className="store-line-total">{vnd(item.line_total)}</strong>
        </article>
    );
}

export default function Cart({ cart }: { cart: CartData }) {
    const { errors } = usePage().props;
    const [changed, setChanged] = useState<number[]>([]);
    const unavailable = cart.items.some(
        (item) => item.is_available === false || item.stock < item.quantity,
    );
    const pending = changed.some((id) =>
        cart.items.some((item) => item.variant_id === id),
    );
    const onChange = (id: number, dirty: boolean) =>
        setChanged((current) =>
            dirty
                ? [...new Set([...current, id])]
                : current.filter((value) => value !== id),
        );
    return (
        <>
            <Head title="Giỏ hàng">
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <header className="store-page-heading">
                <div>
                    <h1>Giỏ hàng của bạn</h1>
                    <p>
                        {cart.count} sản phẩm · Kiểm tra phiên bản và số lượng
                        trước khi đặt.
                    </p>
                </div>
                <Link href="/products" className="store-text-link">
                    Tiếp tục mua sắm
                </Link>
            </header>
            <FormErrors errors={errors} />
            {cart.items.length ? (
                <div className="store-two-column">
                    <section aria-label="Sản phẩm trong giỏ">
                        {cart.items.map((item) => (
                            <CartRow
                                key={
                                    item.variant_id +
                                    ':' +
                                    item.quantity +
                                    ':' +
                                    item.stock
                                }
                                item={item}
                                onChange={onChange}
                            />
                        ))}
                    </section>
                    <aside className="store-summary">
                        <h2>Tóm tắt giỏ hàng</h2>
                        <OrderTotals totals={cart} />
                        <p className="store-hint">
                            Phí giao hàng được tính cho giỏ hàng hiện tại.
                        </p>
                        {cart.items.some((item) => item.is_demo) && (
                            <p className="store-notice">
                                Giỏ có dữ liệu mẫu. Đơn đặt sẽ được ghi là đơn
                                mẫu.
                            </p>
                        )}
                        {unavailable && (
                            <p className="store-field-error" role="status">
                                Cập nhật số lượng hoặc xóa sản phẩm không khả
                                dụng để tiếp tục.
                            </p>
                        )}
                        {pending && (
                            <p className="store-hint" role="status">
                                Hãy cập nhật số lượng đã sửa trước khi đặt hàng.
                            </p>
                        )}
                        {unavailable || pending ? (
                            <button
                                className="store-button store-full"
                                disabled
                            >
                                Tiến hành đặt hàng
                            </button>
                        ) : (
                            <Link
                                href="/checkout"
                                className="store-button store-full"
                            >
                                Tiến hành đặt hàng
                            </Link>
                        )}
                        <p className="store-hint">
                            Mua không cần tài khoản. Thanh toán khi nhận hàng.
                        </p>
                    </aside>
                </div>
            ) : (
                <section className="store-empty">
                    <h2>Giỏ hàng đang trống</h2>
                    <p>Chọn sản phẩm, phiên bản và số lượng phù hợp với bạn.</p>
                    <Link href="/products" className="store-button">
                        Khám phá cửa hàng
                    </Link>
                </section>
            )}
        </>
    );
}
