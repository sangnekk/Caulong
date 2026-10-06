'use client';

import { Head, Link, useForm, usePage } from '@/lib/page';
import { Minus, Phone, Plus } from 'lucide-react';
import { useEffect } from 'react';
import ProductGallery from '@/components/shop-product-gallery';
import { ProductStrip } from '@/components/shop-product-card';
import Recommendations from '@/components/shop-recommendations';
import Reviews, { Stars } from '@/components/shop-reviews';
import WishlistButton from '@/components/shop-wishlist-button';
import { mark, report } from '@/lib/analytics';
import { DemoBadge, FormErrors } from '@/layouts/shop-layout';
import {
    discount,
    playStyles,
    skillLevels,
    vnd,
    type Product as ProductData,
    type ProductCard,
    type ProductReviews,
    type ReviewViewer,
    type ShopSharedProps,
} from '@/types/commerce';

const specLabels = {
    weight: 'Trọng lượng',
    balance: 'Điểm cân bằng',
    stiffness: 'Độ cứng',
    material: 'Vật liệu',
    max_tension: 'Mức căng tối đa',
};

/** At or below this many left, the page says how many. */
const LOW_STOCK = 5;

type Props = {
    product: ProductData;
    /** Units in real orders. */
    sold: number;
    boughtTogether: ProductCard[];
    related: ProductCard[];
    similar: ProductCard[];
    reviews: ProductReviews;
    /** What the signed-in customer saved and may write here; null for a guest. */
    viewer: { wishlisted: boolean; review: NonNullable<ReviewViewer> } | null;
};

export default function Product({
    product,
    sold,
    boughtTogether,
    related,
    similar,
    reviews,
    viewer,
}: Props) {
    const variants = product.variants.filter((variant) => variant.is_active);
    const first = variants.find((variant) => variant.stock > 0) ?? variants[0];
    const form = useForm({ variant_id: first?.id ?? 0, quantity: 1 });
    const selected = variants.find(
        (variant) => variant.id === form.data.variant_id,
    );
    const limit = Math.min(20, selected?.stock ?? 0);
    const available = variants.some((variant) => variant.stock > 0);
    const hotline = usePage<ShopSharedProps>().props.shop?.contact?.hotline;
    const quantity = form.data.quantity;
    const setQuantity = (value: number) =>
        form.setData('quantity', Math.min(Math.max(1, value), limit));
    // Reported from here, not counted in Laravel: Next.js also asks for this page when it
    // prefetches a link, and a prefetch is not a visit.
    useEffect(() => {
        report({ name: 'product_view', product: product.id });
    }, [product.id]);
    return (
        <>
            <Head title={product.name} />
            <nav className="store-breadcrumb" aria-label="Đường dẫn">
                <Link href="/products">Cửa hàng</Link>
                <span aria-hidden="true">/</span>
                <span>{product.name}</span>
            </nav>
            <div className="store-product-detail">
                <ProductGallery
                    images={product.images ?? [product.image_url]}
                    name={product.name}
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
                    {reviews.average !== null && (
                        <p className="store-detail-rating">
                            <Stars rating={reviews.average} />
                            <a href="#danh-gia">
                                {reviews.average.toLocaleString('vi-VN', {
                                    minimumFractionDigits: 1,
                                })}{' '}
                                · {reviews.count} đánh giá
                            </a>
                        </p>
                    )}
                    {selected ? (
                        <>
                            <p className="store-detail-price">
                                <strong>{vnd(selected.price)}</strong>
                                {selected.compare_at_price !== null && (
                                    <>
                                        <del>
                                            <span className="store-sr-only">
                                                Giá niêm yết{' '}
                                            </span>
                                            {vnd(selected.compare_at_price)}
                                        </del>
                                        <span className="store-discount">
                                            {discount(
                                                selected.price,
                                                selected.compare_at_price,
                                            )}
                                        </span>
                                    </>
                                )}
                            </p>
                            <p className="store-detail-status">
                                <span
                                    className={
                                        selected.stock > LOW_STOCK
                                            ? 'store-stock'
                                            : selected.stock > 0
                                              ? 'store-low'
                                              : 'store-out'
                                    }
                                >
                                    {selected.stock > LOW_STOCK
                                        ? 'Còn hàng'
                                        : selected.stock > 0
                                          ? 'Sắp hết, còn ' + selected.stock
                                          : 'Hết hàng'}
                                </span>
                                {sold > 0 && (
                                    <span>
                                        Đã bán {sold.toLocaleString('vi-VN')}
                                    </span>
                                )}
                            </p>
                        </>
                    ) : (
                        <p className="store-detail-price">
                            <strong>Chưa có phiên bản bán</strong>
                        </p>
                    )}
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
                            form.post('/cart/items', {
                                preserveScroll: true,
                                onSuccess: () => mark('add_to_cart'),
                            });
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
                        {available ? (
                            <div className="store-add-row">
                                <div className="store-field">
                                    <label htmlFor="quantity">Số lượng</label>
                                    <div className="store-stepper">
                                        <button
                                            type="button"
                                            aria-label="Bớt một"
                                            disabled={
                                                quantity <= 1 || form.processing
                                            }
                                            onClick={() =>
                                                setQuantity(quantity - 1)
                                            }
                                        >
                                            <Minus
                                                size={18}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        <input
                                            id="quantity"
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={Math.max(1, limit)}
                                            step={1}
                                            required
                                            value={quantity}
                                            disabled={form.processing}
                                            aria-invalid={
                                                !!form.errors.quantity
                                            }
                                            onChange={(event) =>
                                                form.setData(
                                                    'quantity',
                                                    Number(event.target.value),
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            aria-label="Thêm một"
                                            disabled={
                                                quantity >= limit ||
                                                form.processing
                                            }
                                            onClick={() =>
                                                setQuantity(quantity + 1)
                                            }
                                        >
                                            <Plus
                                                size={18}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </div>
                                </div>
                                <button
                                    className="store-button store-add-button"
                                    disabled={
                                        form.processing ||
                                        limit < 1 ||
                                        !Number.isInteger(quantity) ||
                                        quantity < 1 ||
                                        quantity > limit
                                    }
                                >
                                    {form.processing
                                        ? 'Đang thêm…'
                                        : 'Thêm vào giỏ'}
                                </button>
                            </div>
                        ) : (
                            <div className="store-soldout" role="status">
                                <strong>Tạm hết hàng</strong>
                                <p>
                                    {hotline
                                        ? 'Gọi cửa hàng để đặt trước hoặc hỏi ngày có hàng, hoặc xem các cây cùng lối chơi đang có sẵn.'
                                        : 'Cây vợt này tạm hết. Xem các cây cùng lối chơi đang có sẵn.'}
                                </p>
                                <div className="store-soldout-actions">
                                    {hotline && (
                                        <a
                                            className="store-button"
                                            href={
                                                'tel:' +
                                                hotline.replace(/[^0-9+]/g, '')
                                            }
                                        >
                                            <Phone
                                                size={17}
                                                aria-hidden="true"
                                            />
                                            Gọi {hotline}
                                        </a>
                                    )}
                                    <Link
                                        className={
                                            hotline
                                                ? 'store-button store-button-secondary'
                                                : 'store-button'
                                        }
                                        href={
                                            '/products?stock=in&style=' +
                                            product.play_style
                                        }
                                    >
                                        Vợt{' '}
                                        {playStyles[
                                            product.play_style
                                        ].toLowerCase()}{' '}
                                        còn hàng
                                    </Link>
                                </div>
                            </div>
                        )}
                        {limit > 0 && (
                            <p className="store-hint">
                                Tối đa {limit} sản phẩm mỗi lần thêm; giỏ hàng
                                được kiểm tra lại khi đặt.
                            </p>
                        )}
                        {form.wasSuccessful && (
                            <p className="store-notice" role="status">
                                Đã thêm vào giỏ.{' '}
                                <Link href="/cart">Xem giỏ hàng</Link>
                            </p>
                        )}
                    </form>
                    <WishlistButton
                        slug={product.slug}
                        saved={viewer ? viewer.wishlisted : null}
                    />
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
            <Reviews
                slug={product.slug}
                reviews={reviews}
                viewer={viewer ? viewer.review : null}
            />
            <ProductStrip
                id="store-bought-together"
                title="Thường mua cùng"
                note="Khách đặt cây vợt này cũng đã đặt những sản phẩm sau."
                cards={boughtTogether}
            />
            <ProductStrip
                id="store-similar"
                title="Vợt tương tự"
                note={
                    'Cùng lối chơi ' +
                    playStyles[product.play_style].toLowerCase() +
                    (product.brand ? ', từ hãng khác.' : '.')
                }
                cards={similar}
            />
            <ProductStrip
                id="store-related"
                title={
                    product.brand
                        ? 'Cùng hãng ' + product.brand.name
                        : 'Sản phẩm liên quan'
                }
                cards={related}
            />
            <Recommendations productId={product.id} />
        </>
    );
}
