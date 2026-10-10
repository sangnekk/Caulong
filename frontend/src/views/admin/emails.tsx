'use client';

import { Head, Link, router } from '@/lib/page';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { dateTime, emailTypes, PageHeader, Pages, query, Tabs } from './shared';
import type { Pagination } from './shared';

type Email = {
    id: number;
    type: string;
    recipient: string;
    subject: string;
    status: 'queued' | 'sent' | 'failed';
    provider_message_id: string | null;
    error: string | null;
    user_id: number | null;
    order_id: number | null;
    sent_at: string | null;
    created_at: string;
};
type Filters = { status: string; type: string; q: string };

const tabs: [string, string][] = [
    ['', 'Tất cả'],
    ['sent', 'Đã gửi'],
    ['queued', 'Chờ gửi'],
    ['failed', 'Lỗi'],
];
const states: Record<Email['status'], [string, string]> = {
    queued: ['Chờ gửi', 'warning'],
    sent: ['Đã gửi', 'success'],
    failed: ['Lỗi', 'danger'],
};

export default function Emails({
    emails,
    filters,
    types,
    counts,
    mailer,
    stalled,
}: {
    emails: Pagination<Email>;
    filters: Filters;
    types: string[];
    counts: Record<string, number>;
    /** How mail leaves the server (MAIL_MAILER). */
    mailer: string;
    /** Emails waiting far longer than a queue worker takes. */
    stalled: number;
}) {
    const [q, setQ] = useState(filters.q);
    const visit = (next: Partial<Filters>) =>
        router.get(
            query('/admin/emails', { ...filters, q, ...next }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit({});
    };
    const real = mailer !== 'log' && mailer !== 'array';

    return (
        <>
            <Head title="Email đã gửi" />
            <PageHeader
                title="Email đã gửi"
                description="Mọi email cửa hàng gửi cho khách: về tài khoản, đơn hàng, mã giảm giá và các email tự động. Email được xếp hàng rồi gửi ở nền, không làm khách phải chờ."
            />
            {!real && (
                <p className="admin-notice" role="status">
                    Máy này đang <strong>ghi email ra file log</strong> chứ
                    không gửi thật (MAIL_MAILER={mailer}). Để gửi thật qua
                    Resend, đặt MAIL_MAILER=resend, RESEND_API_KEY và địa chỉ
                    gửi MAIL_FROM_ADDRESS trong file .env.
                </p>
            )}
            {stalled > 0 && (
                <p className="admin-notice" role="alert">
                    {stalled} email đã chờ gửi hơn 10 phút. Có vẻ tiến trình gửi
                    chưa chạy: mở một cửa sổ dòng lệnh và chạy{' '}
                    <code>php artisan queue:work</code> (lệnh{' '}
                    <code>php artisan dev</code> đã gồm việc này).
                </p>
            )}
            <Tabs
                label="Lọc theo trạng thái"
                items={tabs.map(([status, label]) => ({
                    href: query('/admin/emails', { ...filters, status }),
                    label,
                    count: counts[status || 'all'],
                    current: filters.status === status,
                }))}
            />
            <form className="admin-filters" onSubmit={submit} role="search">
                <label className="admin-search">
                    Tìm theo người nhận
                    <input
                        type="search"
                        value={q}
                        maxLength={190}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Địa chỉ email"
                    />
                </label>
                <label>
                    Loại email
                    <select
                        value={filters.type}
                        onChange={(event) =>
                            visit({ type: event.target.value })
                        }
                    >
                        <option value="">Mọi loại</option>
                        {types.map((type) => (
                            <option key={type} value={type}>
                                {emailTypes[type] ?? type}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="admin-filter-actions">
                    <button type="submit">
                        <Search aria-hidden="true" />
                        Tìm
                    </button>
                    {(filters.q || filters.type) && (
                        <button
                            type="button"
                            className="admin-button-ghost"
                            onClick={() => {
                                setQ('');
                                router.get(
                                    query('/admin/emails', {
                                        status: filters.status,
                                    }),
                                );
                            }}
                        >
                            Bỏ lọc
                        </button>
                    )}
                </div>
            </form>

            {emails.data.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Danh sách email"
                    tabIndex={0}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Thời gian</th>
                                <th scope="col">Loại</th>
                                <th scope="col">Người nhận</th>
                                <th scope="col">Tiêu đề</th>
                                <th scope="col">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {emails.data.map((email) => {
                                const [label, tone] = states[email.status];
                                return (
                                    <tr key={email.id}>
                                        <td className="admin-nowrap">
                                            {dateTime(email.created_at)}
                                        </td>
                                        <td>
                                            {emailTypes[email.type] ??
                                                email.type}
                                            {email.order_id !== null && (
                                                <small>
                                                    <Link
                                                        href={
                                                            '/admin/orders/' +
                                                            email.order_id
                                                        }
                                                    >
                                                        Đơn #{email.order_id}
                                                    </Link>
                                                </small>
                                            )}
                                        </td>
                                        <th scope="row">
                                            {email.user_id !== null ? (
                                                <Link
                                                    href={
                                                        '/admin/customers/' +
                                                        email.user_id
                                                    }
                                                >
                                                    {email.recipient}
                                                </Link>
                                            ) : (
                                                email.recipient
                                            )}
                                        </th>
                                        <td>{email.subject}</td>
                                        <td>
                                            <span
                                                className="admin-badge"
                                                data-tone={tone}
                                            >
                                                {label}
                                            </span>
                                            {email.status === 'sent' &&
                                                email.sent_at && (
                                                    <small>
                                                        {dateTime(
                                                            email.sent_at,
                                                        )}
                                                        {email.provider_message_id &&
                                                            ' · mã ' +
                                                                email.provider_message_id.slice(
                                                                    0,
                                                                    8,
                                                                )}
                                                    </small>
                                                )}
                                            {email.status === 'failed' &&
                                                email.error && (
                                                    <small className="admin-error">
                                                        {email.error}
                                                    </small>
                                                )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-empty">
                    {filters.q || filters.type || filters.status ? (
                        <>
                            <strong>Không có email nào khớp.</strong>
                            Thử bỏ bớt bộ lọc.
                        </>
                    ) : (
                        <>
                            <strong>Chưa gửi email nào.</strong>
                            Email chào mừng, xác nhận đơn và các email tự động
                            sẽ hiện ở đây khi được gửi.
                        </>
                    )}
                </div>
            )}
            <Pages page={emails} noun="email" />
        </>
    );
}
