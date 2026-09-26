import { Head, Link, useForm } from '@inertiajs/react';
import { DemoBadge, FormErrors, ProductImage } from '@/layouts/shop-layout';
import {
    playStyles,
    skillLevels,
    vnd,
    type Product as ProductData,
} from '@/types/commerce';

const specLabels = {
    weight: 'Trọng lượng',
    balance: 'Điểm cân bằng',
    stiffness: 'Độ cứng',
    material: 'Vật liệu',
    max_tension: 'Mức căng tối đa',
};

export default function Product({ product }: { product: ProductData }) {
    const variants = product.variants.filter((variant) => variant.is_active);
    const first = variants.find((variant) => variant.stock > 0) ?? variants[0];
    const form = useForm({ variant_id: first?.id ?? 0, quantity: 1 });
    const selected = variants.find(
        (variant) => variant.id === form.data.variant_id,
    );
    const limit = Math.min(20, selected?.stock ?? 0);
    return (
        <>
            <Head title={product.name} />
            <nav className="store-breadcrumb" aria-label="Đường dẫn">
                <Link href="/products">Cửa hàng</Link>
                <span aria-hidden="true">/</span>
                <span>{product.name}</span>
            </nav>
            <div className="store-product-detail">
                <ProductImage
                    src={product.image_url}
                    name={product.name}
                    eager
                />
                <section className="store-product-info">
                    <div className="store-inline">
                        <span className="store-muted">
                            {product.brand?.name ?? product.category?.name}
                        </span>
                        {product.is_demo && <DemoBadge />}
                    </div>
                    <h1>{product.name}</h1>
                    <p className="store-muted">
                        {playStyles[product.play_style]} ·{' '}
                        {skillLevels[product.skill_level]}
                    </p>
                    <p className="store-detail-price">
                        {selected
                            ? vnd(selected.price)
                            : 'Chưa có phiên bản bán'}
                    </p>
                    {product.is_demo && (
                        <p className="store-notice">
                            Sản phẩm mẫu để thử cửa hàng. Tên, giá và tồn kho
                            không đại diện cho hàng bán thực tế. Đơn chứa sản
                            phẩm này được ghi là đơn mẫu.
                        </p>
                    )}
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post('/cart/items', { preserveScroll: true });
                        }}
                    >
                        <FormErrors errors={form.errors} />
                        <fieldset
                            className="store-variants"
                            disabled={form.processing}
                        >
                            <legend>Chọn phiên bản</legend>
                            {variants.length ? (
                                variants.map((variant) => (
                                    <label
                                        key={variant.id}
                                        className={
                                            variant.id === selected?.id
                                                ? 'is-selected'
                                                : ''
                                        }
                                    >
                                        <input
                                            type="radio"
                                            name="variant_id"
                                            value={variant.id}
                                            checked={
                                                form.data.variant_id ===
                                                variant.id
                                            }
                                            disabled={variant.stock < 1}
                                            onChange={() =>
                                                form.setData({
                                                    variant_id: variant.id,
                                                    quantity: 1,
                                                })
                                            }
                                        />
                                        <span>
                                            {variant.name}
                                            <small>
                                                {vnd(variant.price)} ·{' '}
                                                {variant.stock > 0
                                                    ? 'Còn ' + variant.stock
                                                    : 'Hết hàng'}
                                            </small>
                                        </span>
                                    </label>
                                ))
                            ) : (
                                <p>Hiện chưa có phiên bản khả dụng.</p>
                            )}
                        </fieldset>
                        {selected && (
                            <p className="store-muted">
                                Mã hàng: {selected.sku}
                            </p>
                        )}
                        <div className="store-add-row">
                            <div className="store-field">
                                <label htmlFor="quantity">Số lượng</label>
                                <input
                                    id="quantity"
                                    type="number"
                                    min={1}
                                    max={Math.max(1, limit)}
                                    step={1}
                                    required
                                    value={form.data.quantity}
                                    disabled={limit < 1 || form.processing}
                                    aria-invalid={!!form.errors.quantity}
                                    onChange={(event) =>
                                        form.setData(
                                            'quantity',
                                            Number(event.target.value),
                                        )
                                    }
                                />
                            </div>
                            <button
                                className="store-button"
                                disabled={
                                    form.processing ||
                                    limit < 1 ||
                                    !Number.isInteger(form.data.quantity) ||
                                    form.data.quantity < 1 ||
                                    form.data.quantity > limit
                                }
                            >
                                {form.processing
                                    ? 'Đang thêm…'
                                    : limit < 1
                                      ? 'Tạm hết hàng'
                                      : 'Thêm vào giỏ'}
                            </button>
                        </div>
                        {limit > 0 && (
                            <p className="store-hint">
                                Còn {selected?.stock} sản phẩm. Tối đa {limit}{' '}
                                sản phẩm mỗi lần thêm; giỏ hàng được kiểm tra
                                lại.
                            </p>
                        )}
                        {form.wasSuccessful && (
                            <p className="store-notice" role="status">
                                Đã thêm vào giỏ.{' '}
                                <Link href="/cart">Xem giỏ hàng</Link>
                            </p>
                        )}
                    </form>
                </section>
            </div>
            <div className="store-product-description">
                <section>
                    <h2>Thông tin sản phẩm</h2>
                    <p className="store-prose">
                        {product.description || 'Chưa có mô tả chi tiết.'}
                    </p>
                </section>
                <section>
                    <h2>Thông số</h2>
                    <dl className="store-specs">
                        {Object.entries(specLabels).map(([key, label]) => (
                            <div key={key}>
                                <dt>{label}</dt>
                                <dd>
                                    {product.specs?.[
                                        key as keyof typeof specLabels
                                    ] || 'Chưa cập nhật'}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </div>
        </>
    );
}
