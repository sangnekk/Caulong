'use client';

import { Head, Link, router } from '@/lib/page';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    date,
    money,
    PageHeader,
    Pages,
    query,
    SegmentBadge,
    segments as segmentNames,
    Tabs,
} from './shared';
import type { Pagination } from './shared';

type Customer = {
    id: number;
    name: string;
    email: string;
    verified: boolean;
    is_admin: boolean;
    segment: string | null;
    joined: string;
    orders: number;
    open_orders: number;
    collected: number;
    last_order_at: string | null;
};
type Filters = { q: string; role: string; segment: string };

export default function Customers({
    customers,
    filters,
    counts,
    segments,
}: {
    customers: Pagination<Customer>;
    filters: Filters;
    counts: { all: number; admins: number };
    /** Customers per group, as last worked out. */
    segments: Record<string, number>;
}) {
    const [q, setQ] = useState(filters.q);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            query('/admin/customers', { ...filters, q }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Khách hàng" />
            <PageHeader
                title="Khách hàng"
                description="Tài khoản đã đăng ký. Khách đặt hàng không cần tài khoản, nên đơn của khách vãng lai chỉ có ở mục Đơn hàng."
            />
            <Tabs
                label="Lọc theo vai trò"
                items={[
                    {
                        href: query('/admin/customers', {
                            ...filters,
                            role: '',
                        }),
                        label: 'Tất cả',
                        count: counts.all,
                        current: filters.role === '',
                    },
                    {
                        href: query('/admin/customers', {
                            ...filters,
                            role: 'customer',
                        }),
                        label: 'Khách hàng',
                        count: counts.all - counts.admins,
                        current: filters.role === 'customer',
                    },
                    {
                        href: query('/admin/customers', {
                            ...filters,
                            role: 'admin',
                        }),
                        label: 'Quản trị viên',
                        count: counts.admins,
                        current: filters.role === 'admin',
                    },
                ]}
            />
            <form className="admin-filters" onSubmit={submit} role="search">
                <label className="admin-search">
                    Tìm tài khoản
                    <input
                        type="search"
                        value={q}
                        maxLength={100}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Tên hoặc email"
                    />
                </label>
                <label>
                    Nhóm khách
                    <select
                        value={filters.segment}
                        onChange={(event) =>
                            router.get(
                                query('/admin/customers', {
                                    ...filters,
                                    q,
                                    segment: event.target.value,
                                }),
                                {},
                                { preserveState: true, preserveScroll: true },
                            )
                        }
                    >
                        <option value="">Mọi nhóm</option>
                        {Object.entries(segmentNames).map(([key, [label]]) => (
                            <option key={key} value={key}>
                                {label} ({segments[key] ?? 0})
                            </option>
                        ))}
                    </select>
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
                                    query('/admin/customers', {
                                        ...filters,
                                        q: '',
                                    }),
                                );
                            }}
                        >
                            Xóa tìm kiếm
                        </button>
                    )}
                </div>
            </form>

            {customers.data.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Danh sách tài khoản"
                    tabIndex={0}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Tài khoản</th>
                                <th scope="col">Trạng thái</th>
                                <th scope="col">Nhóm</th>
                                <th scope="col" className="admin-number">
                                    Đơn hàng
                                </th>
                                <th scope="col" className="admin-number">
                                    Đã thu
                                </th>
                                <th scope="col">Đơn gần nhất</th>
                                <th scope="col">Tham gia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.data.map((customer) => (
                                <tr key={customer.id}>
                                    <th scope="row">
                                        <Link
                                            href={
                                                '/admin/customers/' +
                                                customer.id
                                            }
                                        >
                                            {customer.name}
                                        </Link>
                                        <small>
                                            <a
                                                href={
                                                    'mailto:' + customer.email
                                                }
                                            >
                                                {customer.email}
                                            </a>
                                        </small>
                                    </th>
                                    <td>
                                        {customer.is_admin ? (
                                            <span
                                                className="admin-badge"
                                                data-tone="accent"
                                            >
                                                Quản trị viên
                                            </span>
                                        ) : customer.verified ? (
                                            <span
                                                className="admin-badge"
                                                data-tone="success"
                                            >
                                                Đã xác minh
                                            </span>
                                        ) : (
                                            <span
                                                className="admin-badge"
                                                data-tone="warning"
                                            >
                                                Chưa xác minh email
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {customer.segment ? (
                                            <SegmentBadge
                                                segment={customer.segment}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="admin-number">
                                        {customer.orders}
                                        {customer.open_orders > 0 && (
                                            <small>
                                                {customer.open_orders} đang xử
                                                lý
                                            </small>
                                        )}
                                    </td>
                                    <td className="admin-number">
                                        {customer.collected
                                            ? money(customer.collected)
                                            : '—'}
                                    </td>
                                    <td className="admin-nowrap">
                                        {date(customer.last_order_at)}
                                    </td>
                                    <td className="admin-nowrap">
                                        {date(customer.joined)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-empty">
                    {filters.q || filters.role || filters.segment ? (
                        <>
                            <strong>Không có tài khoản khớp.</strong>
                            Thử tìm bằng một phần email.
                        </>
                    ) : (
                        <>
                            <strong>Chưa có tài khoản nào.</strong>
                            Khách tự đăng ký ở trang{' '}
                            <Link href="/register">Đăng ký</Link>.
                        </>
                    )}
                </div>
            )}
            <Pages page={customers} noun="tài khoản" />
        </>
    );
}
