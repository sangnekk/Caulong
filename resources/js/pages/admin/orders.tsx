import { Head, router } from '@inertiajs/react';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { OrderTable, PageHeader, Pages, query, statuses, Tabs } from './shared';
import type { Order, Pagination } from './shared';

type Filters = { status: string; payment: string; q: string; demo: boolean };

export default function Orders({
    orders,
    filters,
    counts,
    demoCount,
}: {
    orders: Pagination<Order>;
    filters: Filters;
    counts: Record<string, number>;
    demoCount: number;
}) {
    const [q, setQ] = useState(filters.q);
    const [payment, setPayment] = useState(filters.payment);
    const params = (next: Partial<Filters> = {}) => {
        const merged = { ...filters, ...next };
        return { ...merged, demo: merged.demo ? '1' : '' };
    };
    const apply = (next: Partial<Filters>) =>
        router.get(
            query('/admin/orders', params(next)),
            {},
            { preserveState: true, preserveScroll: true },
        );
    const submit = (event: FormEvent) => {
        event.preventDefault();
        apply({ q, payment });
    };
    const filtered = filters.q !== '' || filters.payment !== '';

    return (
        <>
            <Head title="Đơn hàng" />
            <PageHeader
                title="Đơn hàng"
                description="Xác nhận đơn mới, theo dõi giao hàng và ghi nhận tiền COD khi đã thu."
                actions={
                    <a
                        className="admin-button admin-button-secondary"
                        href={query('/admin/orders/export', {
                            status: filters.status,
                            payment: filters.payment,
                            q: filters.q,
                        })}
                        download
                    >
                        <Download aria-hidden="true" />
                        {filters.status || filters.payment || filters.q
                            ? 'Xuất CSV theo bộ lọc'
                            : 'Xuất CSV'}
                    </a>
                }
            />

            <Tabs
                label="Lọc theo trạng thái"
                items={[
                    {
                        href: query('/admin/orders', params({ status: '' })),
                        label: 'Tất cả',
                        count: counts.all,
                        current: filters.status === '',
                    },
                    ...Object.entries(statuses).map(([value, label]) => ({
                        href: query('/admin/orders', params({ status: value })),
                        label,
                        count: counts[value] ?? 0,
                        current: filters.status === value,
                    })),
                ]}
            />

            <form className="admin-filters" onSubmit={submit} role="search">
                <label className="admin-search">
                    Tìm đơn
                    <input
                        type="search"
                        value={q}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Mã đơn (#12), tên khách hoặc số điện thoại"
                    />
                </label>
                <label>
                    Thanh toán
                    <select
                        value={payment}
                        onChange={(event) => {
                            setPayment(event.target.value);
                            apply({ q, payment: event.target.value });
                        }}
                    >
                        <option value="">Tất cả</option>
                        <option value="unpaid">Chưa thu</option>
                        <option value="paid">Đã thu tiền</option>
                    </select>
                </label>
                {demoCount > 0 && (
                    <label className="admin-check">
                        <input
                            type="checkbox"
                            checked={filters.demo}
                            onChange={(event) =>
                                apply({ q, demo: event.target.checked })
                            }
                        />
                        Hiện đơn mẫu ({demoCount.toLocaleString('vi-VN')})
                    </label>
                )}
                <div className="admin-filter-actions">
                    <button type="submit">
                        <Search aria-hidden="true" />
                        Tìm
                    </button>
                    {filtered && (
                        <button
                            type="button"
                            className="admin-button-ghost"
                            onClick={() => {
                                setQ('');
                                setPayment('');
                                apply({ q: '', payment: '' });
                            }}
                        >
                            Xóa lọc
                        </button>
                    )}
                </div>
            </form>

            <OrderTable
                orders={orders.data}
                empty={
                    filtered || filters.status ? (
                        <>
                            <strong>Không có đơn khớp bộ lọc.</strong>
                            Thử bỏ bớt điều kiện, hoặc tìm bằng số điện thoại
                            không có dấu cách.
                        </>
                    ) : undefined
                }
            />
            <Pages page={orders} noun="đơn" />
        </>
    );
}
