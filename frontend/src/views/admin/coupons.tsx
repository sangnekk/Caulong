'use client';

import { Head, Link, router } from '@/lib/page';
import { Plus, Search } from 'lucide-react';
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
    segments,
    Tabs,
} from './shared';
import type { CouponStateName, CouponTerms, Pagination } from './shared';

type Coupon = CouponTerms & {
    id: number;
    code: string;
    name: string;
    usage_limit: number | null;
    per_customer_limit: number | null;
    segment: string | null;
    campaign: string | null;
    starts_at: string | null;
    expires_at: string | null;
    customer: { id: number; name: string; email: string } | null;
    used: number;
    discounted: number;
    state: CouponStateName;
};
type Filters = { state: string; q: string };

const tabs: [string, string][] = [
    ['', 'Tất cả'],
    ['active', 'Đang chạy'],
    ['scheduled', 'Sắp chạy'],
    ['ended', 'Đã kết thúc'],
    ['off', 'Đã tắt'],
];

function Audience({ coupon }: { coupon: Coupon }) {
    if (coupon.customer)
        return (
            <>
                <Link href={'/admin/customers/' + coupon.customer.id}>
                    {coupon.customer.name}
                </Link>
                <small>Mã riêng của khách</small>
            </>
        );
    if (coupon.segment)
        return (
            <>
                Nhóm {segments[coupon.segment]?.[0] ?? coupon.segment}
                <small>Khách đã đăng nhập</small>
            </>
        );
    return <>Mọi khách</>;
}

export default function Coupons({
    coupons,
    filters,
    counts,
}: {
    coupons: Pagination<Coupon>;
    filters: Filters;
    counts: Record<string, number>;
}) {
    const [q, setQ] = useState(filters.q);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            query('/admin/coupons', { ...filters, q }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Mã giảm giá" />
            <PageHeader
                title="Mã giảm giá"
                description="Mã cho mọi khách, cho riêng một khách hoặc cho một nhóm khách. Mức giảm luôn do máy chủ tính lại khi đặt hàng; mã không áp dụng cho sản phẩm mẫu."
                actions={
                    <Link href="/admin/coupons/create" className="admin-button">
                        <Plus aria-hidden="true" />
                        Tạo mã
                    </Link>
                }
            />
            <Tabs
                label="Lọc theo trạng thái"
                items={tabs.map(([state, label]) => ({
                    href: query('/admin/coupons', { ...filters, state }),
                    label,
                    count: counts[state || 'all'],
                    current: filters.state === state,
                }))}
            />
            <form className="admin-filters" onSubmit={submit} role="search">
                <label className="admin-search">
                    Tìm mã
                    <input
                        type="search"
                        value={q}
                        maxLength={40}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Mã, tên hoặc chiến dịch"
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
                                    query('/admin/coupons', {
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

            {coupons.data.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Danh sách mã giảm giá"
                    tabIndex={0}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Mã</th>
                                <th scope="col">Mức giảm</th>
                                <th scope="col">Dành cho</th>
                                <th scope="col">Hiệu lực</th>
                                <th scope="col" className="admin-number">
                                    Đã dùng
                                </th>
                                <th scope="col">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.data.map((coupon) => (
                                <tr key={coupon.id}>
                                    <th scope="row">
                                        <Link
                                            href={
                                                '/admin/coupons/' +
                                                coupon.id +
                                                '/edit'
                                            }
                                        >
                                            {coupon.code}
                                        </Link>
                                        <small>
                                            {coupon.name}
                                            {coupon.campaign &&
                                                ' · ' + coupon.campaign}
                                        </small>
                                    </th>
                                    <td>{couponTerms(coupon)}</td>
                                    <td>
                                        <Audience coupon={coupon} />
                                    </td>
                                    <td className="admin-nowrap">
                                        {coupon.starts_at || coupon.expires_at
                                            ? (coupon.starts_at
                                                  ? date(coupon.starts_at)
                                                  : 'Từ bây giờ') +
                                              ' – ' +
                                              (coupon.expires_at
                                                  ? date(coupon.expires_at)
                                                  : 'không hạn')
                                            : 'Không hạn'}
                                    </td>
                                    <td className="admin-number">
                                        {coupon.used}
                                        {coupon.usage_limit !== null &&
                                            '/' + coupon.usage_limit}
                                        {coupon.discounted > 0 && (
                                            <small>
                                                giảm {money(coupon.discounted)}
                                            </small>
                                        )}
                                    </td>
                                    <td>
                                        <CouponState state={coupon.state} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-empty">
                    {filters.q || filters.state ? (
                        <>
                            <strong>Không có mã nào khớp.</strong>
                            Thử bỏ bộ lọc hoặc tìm bằng một phần của mã.
                        </>
                    ) : (
                        <>
                            <strong>Chưa có mã giảm giá nào.</strong>
                            Tạo mã đầu tiên: cho mọi khách, hoặc tặng riêng một
                            khách từ trang của khách đó.
                        </>
                    )}
                </div>
            )}
            <Pages page={coupons} noun="mã" />
        </>
    );
}
