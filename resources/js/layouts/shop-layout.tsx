import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useState, type PropsWithChildren } from 'react';
import { vnd, type ShopSharedProps, type Totals } from '@/types/commerce';
import '../../css/shop.css';

const poster = '/models/hyper-core-poster.png';

export function ProductImage({
    src,
    name,
    eager = false,
}: {
    src: string;
    name: string;
    eager?: boolean;
}) {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    const fallback = !src || src === poster || failedSource === src;
    return (
        <figure className="store-image">
            <img
                src={fallback ? poster : src}
                alt={
                    fallback
                        ? 'Hình vợt minh họa, không phải ảnh sản phẩm'
                        : name
                }
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                width="640"
                height="640"
                onError={fallback ? undefined : () => setFailedSource(src)}
            />
            {fallback && <figcaption>Hình minh họa</figcaption>}
        </figure>
    );
}

export function DemoBadge() {
    return <span className="store-demo">Dữ liệu mẫu</span>;
}

export function FormErrors({
    errors,
}: {
    errors: Record<string, string | undefined>;
}) {
    const messages = [...new Set(Object.values(errors).filter(Boolean))];
    return messages.length > 0 ? (
        <div className="store-error" role="alert">
            <strong>Vui lòng kiểm tra lại</strong>
            <ul>
                {messages.map((message) => (
                    <li key={message}>{message}</li>
                ))}
            </ul>
        </div>
    ) : null;
}

export function OrderTotals({ totals }: { totals: Totals }) {
    return (
        <dl className="store-totals">
            <div>
                <dt>Tiền hàng</dt>
                <dd>{vnd(totals.subtotal)}</dd>
            </div>
            <div>
                <dt>Phí giao hàng</dt>
                <dd>
                    {totals.shipping_fee === 0
                        ? 'Miễn phí'
                        : vnd(totals.shipping_fee)}
                </dd>
            </div>
            <div className="store-total">
                <dt>Tổng cộng</dt>
                <dd>{vnd(totals.total)}</dd>
            </div>
        </dl>
    );
}

export default function ShopLayout({ children }: PropsWithChildren) {
    const { props, url } = usePage<ShopSharedProps>();
    const path = url.split('?')[0];
    return (
        <div className="storefront" lang="vi">
            <a href="#store-main" className="store-skip">
                Đến nội dung chính
            </a>
            <header className="store-header">
                <div className="store-container store-header-inner">
                    <Link
                        href="/"
                        className="store-brand"
                        prefetch="hover"
                        viewTransition
                    >
                        <ArrowUpRight aria-hidden="true" size={30} />
                        <span>
                            Shop <strong>Cầu Lông</strong>
                        </span>
                    </Link>
                    <nav aria-label="Điều hướng cửa hàng">
                        <Link href="/" prefetch="hover" viewTransition>
                            Khám phá
                        </Link>
                        <Link
                            href="/products"
                            aria-current={
                                path.startsWith('/products')
                                    ? 'page'
                                    : undefined
                            }
                        >
                            Cửa hàng
                        </Link>
                        <Link href="/advisor">Gợi ý chọn vợt</Link>
                        {props.shop?.is_admin && (
                            <Link href="/admin">Quản trị</Link>
                        )}
                        <Link
                            href="/cart"
                            className="store-cart-link"
                            aria-current={path === '/cart' ? 'page' : undefined}
                        >
                            <ShoppingBag size={19} aria-hidden="true" /> Giỏ
                            hàng <span>{props.shop?.cart_count ?? 0}</span>
                        </Link>
                    </nav>
                </div>
            </header>
            <main
                id="store-main"
                className="store-container store-main"
                tabIndex={-1}
            >
                {props.flash?.success && (
                    <div className="store-notice" role="status">
                        {props.flash.success}
                    </div>
                )}
                {props.flash?.error && (
                    <div className="store-error" role="alert">
                        {props.flash.error}
                    </div>
                )}
                {children}
            </main>
            <footer className="store-footer">
                <div className="store-container">
                    <strong>Shop Cầu Lông</strong>
                    <p>
                        Chọn vợt theo nhu cầu. Kiểm tra phiên bản, giá và số
                        lượng trước khi đặt.
                    </p>
                    <Link href="/products">Tiếp tục xem sản phẩm</Link>
                </div>
            </footer>
        </div>
    );
}
