import { Head, Link } from '@inertiajs/react';
import { OrderTable } from './shared';
import type { Order } from './shared';

export default function Dashboard({
    stats,
    orders,
}: {
    stats: { products: number; pending_orders: number; low_stock: number };
    orders: Order[];
}) {
    return (
        <>
            <Head title="Tổng quan quản trị" />
            <h1>Tổng quan</h1>
            <p className="admin-muted">
                Theo dõi đơn mới, kiểm tra hàng trước khi mở bán.
            </p>
            <dl className="admin-stats">
                <div>
                    <dt>Sản phẩm</dt>
                    <dd>
                        <Link href="/admin/products">{stats.products}</Link>
                    </dd>
                </div>
                <div>
                    <dt>Đơn chờ xác nhận</dt>
                    <dd>
                        <Link href="/admin/orders?status=pending">
                            {stats.pending_orders}
                        </Link>
                    </dd>
                </div>
                <div>
                    <dt>Biến thể còn tối đa 5 sản phẩm</dt>
                    <dd>{stats.low_stock}</dd>
                </div>
            </dl>
            <div className="admin-heading">
                <h2>Đơn hàng gần đây</h2>
                <Link href="/admin/orders">Tất cả đơn hàng</Link>
            </div>
            <OrderTable orders={orders} />
        </>
    );
}
