import { Link, router, usePage } from '@inertiajs/react';
import {
    ChartColumn,
    CircleAlert,
    CircleCheck,
    FileUp,
    LayoutDashboard,
    LogOut,
    Menu,
    MessageCircle,
    Package,
    ReceiptText,
    Settings,
    Store,
    Tags,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import BrandMark from '@/components/brand-mark';
import type { ShopSharedProps } from '@/types/commerce';
import '../../css/admin.css';

type AdminPageProps = ShopSharedProps & {
    auth: { user: { name: string; email: string } | null };
};

const workNav = [
    { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/admin/reports', label: 'Báo cáo', icon: ChartColumn },
    { href: '/admin/orders', label: 'Đơn hàng', icon: ReceiptText },
    { href: '/admin/support-chat', label: 'Chat hỗ trợ', icon: MessageCircle },
    { href: '/admin/products', label: 'Sản phẩm', icon: Package },
    { href: '/admin/imports', label: 'Nhập hàng', icon: FileUp },
    { href: '/admin/taxonomies', label: 'Hãng & danh mục', icon: Tags },
    { href: '/admin/customers', label: 'Khách hàng', icon: Users },
    { href: '/admin/settings', label: 'Cài đặt', icon: Settings },
];

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

export default function AdminLayout({ children }: PropsWithChildren) {
    const { url, props } = usePage<AdminPageProps>();
    const path = url.split('?')[0];
    const user = props.auth.user;
    const pending = props.shop?.pending_orders ?? 0;
    const pendingSupportChats = props.shop?.pending_support_chats ?? 0;
    const [menuOpen, setMenuOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const menuButton = useRef<HTMLButtonElement>(null);
    const previousSupportChats = useRef(0);
    const previousSupportCount = useRef(pendingSupportChats);

    // A visit closes the drawer; Escape closes it and gives focus back to the menu button.
    useEffect(() => router.on('start', () => setMenuOpen(false)), []);
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setMenuOpen(false);
            menuButton.current?.focus();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    useEffect(() => {
        if (!user || path === '/admin/support-chat') return;
        const interval = window.setInterval(() => {
            router.reload({ only: ['shop'] });
        }, 5000);
        return () => window.clearInterval(interval);
    }, [path, user]);

    useEffect(() => {
        if (
            pendingSupportChats > previousSupportChats.current &&
            path !== '/admin/support-chat'
        ) {
            router.visit('/admin/support-chat?status=open');
        }
        previousSupportChats.current = pendingSupportChats;
    }, [path, pendingSupportChats]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            router.reload({ only: ['shop'] });
        }, 5000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (
            pendingSupportChats > previousSupportCount.current &&
            path !== '/admin/support-chat'
        ) {
            router.visit('/admin/support-chat?status=open');
        }
        previousSupportCount.current = pendingSupportChats;
    }, [path, pendingSupportChats]);

    const isCurrent = (href: string) =>
        href === '/admin' ? path === href : path.startsWith(href);
    const signOut = () => {
        setSigningOut(true);
        router.post('/logout', {}, { onFinish: () => setSigningOut(false) });
    };

    return (
        <div className="commerce-admin" lang="vi">
            <a className="admin-skip" href="#admin-main">
                Đến nội dung chính
            </a>
            <div className="admin-app" data-menu={menuOpen ? 'open' : 'closed'}>
                <aside
                    className="admin-sidebar"
                    id="admin-sidebar"
                    aria-label="Quản trị"
                >
                    <Link href="/admin" className="admin-brand">
                        <BrandMark size={30} />
                        <span>
                            Shop Cầu Lông
                            <small>Quản trị cửa hàng</small>
                        </span>
                    </Link>

                    <nav aria-label="Công việc">
                        <div className="admin-nav">
                            {workNav.map(({ href, label, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    aria-current={
                                        isCurrent(href) ? 'page' : undefined
                                    }
                                >
                                    <Icon aria-hidden="true" />
                                    {label}
                                    {href === '/admin/orders' &&
                                        pending > 0 && (
                                            <span
                                                className="admin-nav-count"
                                                aria-label={
                                                    pending +
                                                    ' đơn chờ xác nhận'
                                                }
                                            >
                                                {pending}
                                            </span>
                                        )}
                                    {href === '/admin/support-chat' &&
                                        pendingSupportChats > 0 && (
                                            <span
                                                className="admin-nav-count"
                                                aria-label={
                                                    pendingSupportChats +
                                                    ' cuộc trò chuyện chưa đọc'
                                                }
                                            >
                                                {pendingSupportChats}
                                            </span>
                                        )}
                                </Link>
                            ))}
                        </div>
                        <p className="admin-nav-label">Cửa hàng</p>
                        <div className="admin-nav">
                            <Link href="/products" prefetch="hover">
                                <Store aria-hidden="true" />
                                Xem cửa hàng
                            </Link>
                            <Link href="/account">
                                <UserRound aria-hidden="true" />
                                Tài khoản của tôi
                            </Link>
                        </div>
                    </nav>

                    {user && (
                        <div className="admin-user">
                            <div className="admin-user-id">
                                <span
                                    className="admin-avatar"
                                    aria-hidden="true"
                                >
                                    {initials(user.name)}
                                </span>
                                <span className="admin-user-name">
                                    <strong>{user.name}</strong>
                                    <span>{user.email}</span>
                                </span>
                            </div>
                            <div className="admin-user-actions">
                                <button
                                    type="button"
                                    className="admin-button-secondary admin-button-small"
                                    onClick={signOut}
                                    disabled={signingOut}
                                    data-busy={signingOut}
                                >
                                    <LogOut aria-hidden="true" />
                                    {signingOut
                                        ? 'Đang đăng xuất…'
                                        : 'Đăng xuất'}
                                </button>
                            </div>
                        </div>
                    )}
                </aside>

                <button
                    type="button"
                    className="admin-backdrop"
                    aria-label="Đóng menu"
                    tabIndex={-1}
                    onClick={() => setMenuOpen(false)}
                />

                <div className="admin-content">
                    <header className="admin-topbar">
                        <button
                            ref={menuButton}
                            type="button"
                            className="admin-button-ghost"
                            aria-expanded={menuOpen}
                            aria-controls="admin-sidebar"
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            {menuOpen ? (
                                <X aria-hidden="true" />
                            ) : (
                                <Menu aria-hidden="true" />
                            )}
                            <span className="sr-only">
                                {menuOpen ? 'Đóng menu' : 'Mở menu'}
                            </span>
                        </button>
                        <Link href="/admin" className="admin-brand">
                            <BrandMark size={26} />
                            Quản trị
                        </Link>
                        {pending > 0 && (
                            <Link
                                href="/admin/orders?status=pending"
                                className="admin-badge"
                                data-tone="warning"
                            >
                                {pending} đơn chờ
                            </Link>
                        )}
                    </header>

                    <main id="admin-main" tabIndex={-1}>
                        {props.flash?.success && (
                            <p className="admin-flash" role="status">
                                <CircleCheck aria-hidden="true" />
                                {props.flash.success}
                            </p>
                        )}
                        {props.flash?.error && (
                            <p
                                className="admin-flash"
                                data-tone="error"
                                role="alert"
                            >
                                <CircleAlert aria-hidden="true" />
                                {props.flash.error}
                            </p>
                        )}
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
