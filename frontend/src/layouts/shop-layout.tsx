import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    LayoutDashboard,
    LogOut,
    ReceiptText,
    ShoppingBag,
    UserRound,
} from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react';
import BrandMark from '@/components/brand-mark';
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

/** Money lines of a cart or order. `hint` adds how much more earns free delivery (cart only). */
export function OrderTotals({
    totals,
    hint = false,
}: {
    totals: Totals;
    hint?: boolean;
}) {
    const freeFrom =
        usePage<ShopSharedProps>().props.shop?.free_shipping_from ?? 0;
    const missing = freeFrom - totals.subtotal;
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
            {hint && totals.shipping_fee > 0 && freeFrom > 0 && missing > 0 && (
                <div className="store-free-hint">
                    <dt className="store-sr-only">Miễn phí giao hàng</dt>
                    <dd>Mua thêm {vnd(missing)} để được miễn phí giao hàng.</dd>
                </div>
            )}
        </dl>
    );
}

/** Hotline and email from the admin settings; nothing renders until the owner fills them in. */
export function ShopContact() {
    const contact = usePage<ShopSharedProps>().props.shop?.contact;
    if (!contact?.hotline && !contact?.email) return null;
    return (
        <p className="store-contact">
            Cần hỗ trợ?{' '}
            {contact.hotline && (
                <a href={'tel:' + contact.hotline.replace(/[^0-9+]/g, '')}>
                    Gọi {contact.hotline}
                </a>
            )}
            {contact.hotline && contact.email && ' · '}
            {contact.email && (
                <a href={'mailto:' + contact.email}>{contact.email}</a>
            )}
        </p>
    );
}

type Viewer = { name: string; email: string } | null;

/** Signed-in: a menu with the account, orders, admin (for admins) and sign-out. Guest: sign in. */
function AccountMenu({ user, isAdmin }: { user: Viewer; isAdmin: boolean }) {
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const wrapper = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => router.on('start', () => setOpen(false)), []);
    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!wrapper.current?.contains(event.target as Node))
                setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            button.current?.focus();
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    // Keep the panel on screen when the header wraps on a phone.
    useLayoutEffect(() => {
        const element = panel.current;
        if (!open || !element) return;
        element.style.translate = '';
        const { left, right } = element.getBoundingClientRect();
        const overflowLeft = 10 - left;
        const overflowRight = right - (window.innerWidth - 10);
        if (overflowLeft > 0) element.style.translate = overflowLeft + 'px 0';
        else if (overflowRight > 0)
            element.style.translate = -overflowRight + 'px 0';
    }, [open]);

    if (!user)
        return (
            <Link href="/login" className="store-account-link">
                <UserRound size={20} aria-hidden="true" />
                <span className="store-account-login">Đăng nhập</span>
            </Link>
        );

    const firstName = user.name.trim().split(/\s+/).pop() ?? user.name;
    const initials = user.name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return (
        <div className="store-account" ref={wrapper}>
            <button
                ref={button}
                type="button"
                className="store-account-button"
                aria-expanded={open}
                aria-controls="store-account-menu"
                onClick={() => setOpen((value) => !value)}
            >
                <span className="store-avatar" aria-hidden="true">
                    {initials}
                </span>
                <span className="store-account-name">{firstName}</span>
                <ChevronDown size={16} aria-hidden="true" />
                <span className="sr-only">: menu tài khoản</span>
            </button>
            {open && (
                <div
                    ref={panel}
                    id="store-account-menu"
                    className="store-account-panel"
                >
                    <p className="store-account-who">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                    </p>
                    <Link href="/account">
                        <UserRound size={17} aria-hidden="true" />
                        Tài khoản của tôi
                    </Link>
                    <Link href="/account#don-hang">
                        <ReceiptText size={17} aria-hidden="true" />
                        Đơn hàng của tôi
                    </Link>
                    {isAdmin && (
                        <Link href="/admin">
                            <LayoutDashboard size={17} aria-hidden="true" />
                            Quản trị cửa hàng
                        </Link>
                    )}
                    <button
                        type="button"
                        className="store-account-signout"
                        disabled={signingOut}
                        onClick={() => {
                            setSigningOut(true);
                            router.post(
                                '/logout',
                                {},
                                { onFinish: () => setSigningOut(false) },
                            );
                        }}
                    >
                        <LogOut size={17} aria-hidden="true" />
                        {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ShopLayout({ children }: PropsWithChildren) {
    const { props, url } = usePage<
        ShopSharedProps & { auth: { user: Viewer } }
    >();
    const path = url.split('?')[0];
    const current = (active: boolean) => (active ? 'page' : undefined);
    const cartCount = props.shop?.cart_count ?? 0;
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
                        <BrandMark size={30} />
                        <span>
                            Shop <strong>Cầu Lông</strong>
                        </span>
                    </Link>
                    <nav className="store-nav" aria-label="Điều hướng cửa hàng">
                        <Link
                            href="/products"
                            prefetch="hover"
                            aria-current={current(path.startsWith('/products'))}
                        >
                            Cửa hàng
                        </Link>
                        <Link
                            href="/advisor"
                            prefetch="hover"
                            aria-current={current(path === '/advisor')}
                        >
                            Gợi ý chọn vợt
                        </Link>
                        <Link href="/" prefetch="hover" viewTransition>
                            Tìm hiểu vợt
                        </Link>
                    </nav>
                    <div className="store-tools">
                        <Link
                            href="/cart"
                            className="store-cart-link"
                            aria-label={
                                cartCount > 0
                                    ? `Giỏ hàng, ${cartCount} sản phẩm`
                                    : 'Giỏ hàng'
                            }
                            aria-current={current(path === '/cart')}
                        >
                            <ShoppingBag size={20} aria-hidden="true" />
                            <span className="store-cart-label">Giỏ hàng</span>
                            {cartCount > 0 && (
                                <span className="store-cart-count">
                                    {cartCount}
                                </span>
                            )}
                        </Link>
                        <AccountMenu
                            user={props.auth?.user ?? null}
                            isAdmin={!!props.shop?.is_admin}
                        />
                    </div>
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
                    <ShopContact />
                    <Link href="/products">Tiếp tục xem sản phẩm</Link>
                </div>
            </footer>
        </div>
    );
}
