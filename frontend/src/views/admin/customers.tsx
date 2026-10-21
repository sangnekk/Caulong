'use client';

import { Head, Link, router } from '@/lib/page';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    CouponState,
    couponTerms,
    date,
    money,
    PageHeader,
    Pages,
    query,
    SegmentBadge,
    segments as segmentNames,
    staffRoles,
    Tabs,
} from './shared';
import type { CouponStateName, CouponTerms, Pagination } from './shared';

type Customer = {
    id: number;
    name: string;
    email: string;
    verified: boolean;
    is_admin: boolean;
    /** What a staff account may do; null for a customer. */
    staff_role: string | null;
    segment: string | null;
    joined: string;
    orders: number;
    open_orders: number;
    collected: number;
    last_order_at: string | null;
};
type Filters = { q: string; role: string; segment: string };
type VipCoupon = CouponTerms & {
    code: string;
    name: string;
    starts_at: string | null;
    expires_at: string | null;
    state: CouponStateName;
};
type Vip = {
    id: number;
    name: string;
    email: string;
    segment: string | null;
    collected: number;
    coupon: VipCoupon | null;
};

export default function Customers({
    customers,
    vips,
    filters,
    counts,
    segments,
}: {
    customers: Pagination<Customer>;
    /** The customers who have paid the shop the most, with a personal voucher when they have one. */
    vips: Vip[];
    filters: Filters;
    counts: { all: number; admins: number };
    /** Customers per group, as last worked out. */
    segments: Record<string, number>;
}) {
    const [q, setQ] = useState(filters.q);
    const [copied, setCopied] = useState<string | null>(null);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            query('/admin/customers', { ...filters, q }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };
    const copy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(code);
            window.setTimeout(
                () => setCopied((current) => (current === code ? null : current)),
                1800,
            );
        } catch {
            setCopied(null);
        }
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
                        label: 'Nhân viên',
                        count: counts.admins,
                        current: filters.role === 'admin',
                    },
                ]}
            />
            {vips.length > 0 && (
                <section
                    className="admin-panel admin-vip"
                    aria-labelledby="vip-customers"
                >
                    <div className="admin-section-heading">
                        <div>
                            <h2 id="vip-customers">Khách chi tiêu lớn</h2>
                            <p className="admin-muted admin-vip-intro">
                                Những khách đã thanh toán nhiều nhất, kèm mã
                                giảm giá riêng nếu shop đã tặng.
                            </p>
                        </div>
                        <span className="admin-muted">Theo số tiền đã thu</span>
                    </div>
                    <div className="admin-vip-grid">
                        {vips.map((vip) => (
                            <article className="admin-vip-card" key={vip.id}>
                                <div className="admin-vip-head">
                                    <div>
                                        <Link
                                            href={
                                                '/admin/customers/' +
                                                vip.id +
                                                '?tab=coupons'
                                            }
                                        >
                                            {vip.name}
                                        </Link>
                                        <small>{vip.email}</small>
                                    </div>
                                    <SegmentBadge segment={vip.segment} />
                                </div>
                                <p className="admin-vip-spend">
                                    {money(vip.collected)}
                                    <small>đã thu</small>
                                </p>
                                {vip.coupon ? (
                                    <div className="admin-vip-coupon">
                                        <span className="admin-vip-code">
                                            {vip.coupon.code}
                                        </span>
                                        <small>
                                            {vip.coupon.name} ·{' '}
                                            {couponTerms(vip.coupon)}
                                        </small>
                                        <div className="admin-vip-foot">
                                            <CouponState
                                                state={vip.coupon.state}
                                            />
                                            <span className="admin-muted">
                                                {vip.coupon.expires_at
                                                    ? 'HSD ' +
                                                      date(
                                                          vip.coupon
                                                              .expires_at,
                                                      )
                                                    : 'Không hết hạn'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="admin-button admin-button-secondary admin-button-small"
                                            onClick={() =>
                                                copy(vip.coupon!.code)
                                            }
                                        >
                                            {copied === vip.coupon.code
                                                ? 'Đã chép mã'
                                                : 'Sao chép mã'}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="admin-muted admin-vip-empty">
                                        Chưa có mã riêng.{' '}
                                        <Link
                                            href={
                                                '/admin/coupons/create?customer=' +
                                                vip.id
                                            }
                                        >
                                            Tạo mã
                                        </Link>
                                    </p>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            )}
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
                                                {staffRoles[
                                                    customer.staff_role ??
                                                        'admin'
                                                ] ?? 'Nhân viên'}
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
