import { Head, router } from '@inertiajs/react';
import { OrderTable, Pages, statuses } from './shared';
import type { Order, Pagination } from './shared';

export default function Orders({
    orders,
    filters,
}: {
    orders: Pagination<Order>;
    filters: { status: string };
}) {
    return (
        <>
            <Head title="Quản lý đơn hàng" />
            <h1>Đơn hàng</h1>
            <div className="admin-toolbar">
                <label htmlFor="order-status">Trạng thái</label>
                <select
                    id="order-status"
                    value={filters.status}
                    onChange={(event) =>
                        router.get(
                            '/admin/orders',
                            { status: event.target.value },
                            { preserveState: true },
                        )
                    }
                >
                    <option value="">Tất cả</option>
                    {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>
            <OrderTable orders={orders.data} />
            <Pages page={orders} />
        </>
    );
}
