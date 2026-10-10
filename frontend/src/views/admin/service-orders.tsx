'use client';

import { Head, Link, router } from '@/lib/page';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    dateTime,
    money,
    PageHeader,
    Pages,
    query,
    serviceLine,
    serviceStates,
    ServiceStatus,
    Tabs,
} from './shared';
import type { Pagination, ServiceState, ServiceSummary } from './shared';

type Row = ServiceSummary & {
    name: string;
    phone: string;
    /** When the customer plans to bring the racket in. */
    preferred_at: string | null;
    technician_name: string | null;
};
type Filters = { status: string; q: string };

export default function ServiceOrders({
    orders,
    filters,
    counts,
}: {
    orders: Pagination<Row>;
    filters: Filters;
    counts: Record<string, number>;
}) {
    const [q, setQ] = useState(filters.q);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            query('/admin/service-orders', { ...filters, q }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Đan dây" />
            <PageHeader
                title="Đan dây"
                description="Yêu cầu đan dây khách gửi từ cửa hàng. Gọi khách để hẹn, nhận vợt, đan, rồi trả vợt và thu tiền tại quầy."
                actions={
                    <Link
                        href="/admin/service-strings"
                        className="admin-button admin-button-secondary"
                    >
                        Danh sách dây và giá
                    </Link>
                }
            />
            <Tabs
                label="Lọc theo trạng thái"
                items={[
                    {
                        href: query('/admin/service-orders', {
                            ...filters,
                            status: '',
                        }),
                        label: 'Tất cả',
                        count: counts.all,
                        current: filters.status === '',
                    },
                    ...(Object.keys(serviceStates) as ServiceState[]).map(
                        (value) => ({
                            href: query('/admin/service-orders', {
                                ...filters,
                                status: value,
                            }),
                            label: serviceStates[value][0],
                            count: counts[value] ?? 0,
                            current: filters.status === value,
                        }),
                    ),
                ]}
            />
            <form className="admin-filters" onSubmit={submit} role="search">
                <label className="admin-search">
                    Tìm yêu cầu
                    <input
                        type="search"
                        value={q}
                        maxLength={100}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Mã yêu cầu, tên khách hoặc số điện thoại"
                    />
                </label>
                <div className="admin-filter-actions">
                    <button type="submit">
                        <Search aria-hidden="true" />
                        Tìm
                    </button>
                    {filters.q && (
                        <button
                            type="button"
                            className="admin-button-ghost"
                            onClick={() => {
                                setQ('');
                                router.get(
                                    query('/admin/service-orders', {
                                        status: filters.status,
                                    }),
                                );
                            }}
                        >
                            Xóa lọc
                        </button>
                    )}
                </div>
            </form>

            {orders.data.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Danh sách yêu cầu đan dây"
                    tabIndex={0}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Yêu cầu</th>
                                <th scope="col">Khách hàng</th>
                                <th scope="col">Vợt, dây, mức căng</th>
                                <th scope="col">Hẹn mang vợt</th>
                                <th scope="col">Trạng thái</th>
                                <th scope="col" className="admin-number">
                                    Thu khi trả vợt
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.data.map((order) => (
                                <tr key={order.id}>
                                    <th scope="row">
                                        <Link
                                            href={
                                                '/admin/service-orders/' +
                                                order.id
                                            }
                                        >
                                            #{order.id} · {order.code}
                                        </Link>
                                        <small>
                                            {dateTime(order.created_at)}
                                        </small>
                                    </th>
                                    <td>
                                        {order.name}
                                        <small>{order.phone}</small>
                                    </td>
                                    <td>{serviceLine(order)}</td>
                                    <td>
                                        {order.preferred_at
                                            ? dateTime(order.preferred_at)
                                            : 'Chưa hẹn'}
                                    </td>
                                    <td>
                                        <ServiceStatus status={order.status} />
                                        {order.technician_name && (
                                            <small>
                                                {order.technician_name}
                                            </small>
                                        )}
                                    </td>
                                    <td className="admin-number">
                                        {order.total > 0
                                            ? money(order.total)
                                            : 'Chưa báo giá'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-empty">
                    {filters.q || filters.status ? (
                        <>
                            <strong>Không có yêu cầu nào khớp.</strong>
                            Thử bỏ bớt điều kiện, hoặc tìm bằng số điện thoại
                            không có dấu cách.
                        </>
                    ) : (
                        <>
                            <strong>Chưa có yêu cầu đan dây.</strong>
                            Yêu cầu khách gửi ở trang Đan dây của cửa hàng sẽ
                            hiện ở đây, mới nhất ở trên.
                        </>
                    )}
                </div>
            )}
            <Pages page={orders} noun="yêu cầu" />
        </>
    );
}
