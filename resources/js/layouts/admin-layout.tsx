import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import '../../css/admin.css';

export default function AdminLayout({ children }: PropsWithChildren) {
    const { url, props } = usePage<{
        flash?: { success?: string; error?: string };
    }>();
    const navigation = [
        ['/admin', 'Tổng quan'],
        ['/admin/products', 'Sản phẩm'],
        ['/admin/orders', 'Đơn hàng'],
    ];
    return (
        <div className="commerce-admin" lang="vi">
            <a className="admin-skip" href="#admin-main">
                Đến nội dung chính
            </a>
            <header className="admin-header">
                <Link href="/admin" className="admin-brand">
                    Shop Cầu Lông <span>Quản trị</span>
                </Link>
                <Link href="/products">Xem cửa hàng</Link>
            </header>
            <div className="admin-shell">
                <nav aria-label="Quản trị">
                    {navigation.map(([href, label]) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={
                                (
                                    href === '/admin'
                                        ? url.split('?')[0] === href
                                        : url.startsWith(href)
                                )
                                    ? 'page'
                                    : undefined
                            }
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                <main id="admin-main" tabIndex={-1}>
                    {props.flash?.success && (
                        <p className="admin-notice" role="status">
                            {props.flash.success}
                        </p>
                    )}
                    {props.flash?.error && (
                        <p className="admin-error" role="alert">
                            {props.flash.error}
                        </p>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}
