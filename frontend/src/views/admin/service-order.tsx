'use client';

import { Head, Link, useForm } from '@/lib/page';
import { Phone } from 'lucide-react';
import {
    dateTime,
    Errors,
    money,
    PageHeader,
    serviceStates,
    ServiceStatus,
} from './shared';
import type { ServiceState, ServiceSummary } from './shared';

type ServiceOrder = ServiceSummary & {
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    /** Per racket, as quoted when the request was made. */
    string_price: number;
    labor_fee: number;
    technician_id: number | null;
    technician_name: string | null;
    preferred_at: string | null;
    /** The account that asked, when the customer was signed in. */
    customer: { id: number; name: string; email: string } | null;
    /** When each step was reached. */
    steps: Partial<Record<ServiceState, string | null>>;
};
type Related = {
    id: number;
    status: ServiceState;
    racket: string;
    created_at: string;
}[];

const transitions: Partial<Record<ServiceState, ServiceState[]>> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['ready', 'cancelled'],
    ready: ['completed'],
};
const flow: ServiceState[] = [
    'pending',
    'confirmed',
    'in_progress',
    'ready',
    'completed',
];
// What to do at each step, and what choosing the next one means.
const guidance: Record<ServiceState, string> = {
    pending:
        'Gọi khách để hẹn lúc mang vợt tới và thống nhất loại dây, mức căng. Xong thì chuyển sang “Đã hẹn”.',
    confirmed: 'Khi khách mang vợt tới, nhận vợt rồi chuyển sang “Đang đan”.',
    in_progress:
        'Đan xong thì chuyển sang “Chờ khách lấy”: khách có email sẽ được báo ngay.',
    ready: 'Khi khách tới lấy vợt và đã trả tiền, chuyển sang “Đã trả vợt”.',
    completed: 'Yêu cầu đã xong: khách đã nhận vợt và thanh toán.',
    cancelled: 'Yêu cầu đã hủy.',
};

export default function ServiceOrderDetail({
    order,
    staff,
    related,
}: {
    order: ServiceOrder;
    staff: { id: number; name: string }[];
    related: Related;
}) {
    const status = useForm({ status: '' });
    const technician = useForm({
        technician_id: order.technician_id ?? ('' as number | ''),
    });
    const price = useForm({ total: order.total });
    const url = '/admin/service-orders/' + order.id;
    const options = transitions[order.status] ?? [];
    const step = flow.indexOf(order.status);
    const over = order.status === 'completed' || order.status === 'cancelled';
    const busy = status.processing || technician.processing || price.processing;

    return (
        <>
            <Head title={'Yêu cầu đan dây #' + order.id} />
            <PageHeader
                back={{ href: '/admin/service-orders', label: 'Đan dây' }}
                title={
                    <>
                        Yêu cầu đan dây #{order.id}{' '}
                        <ServiceStatus status={order.status} />
                    </>
                }
                description={
                    'Gửi lúc ' +
                    dateTime(order.created_at) +
                    ' · Mã khách đọc tại quầy: ' +
                    order.code
                }
            />

            {order.status === 'cancelled' ? (
                <p className="admin-empty admin-cancelled">
                    <strong>Yêu cầu đã hủy.</strong>
                    {order.steps.cancelled &&
                        'Hủy lúc ' + dateTime(order.steps.cancelled) + '.'}
                </p>
            ) : (
                <ol className="admin-steps" aria-label="Tiến trình yêu cầu">
                    {flow.map((value, index) => (
                        <li
                            key={value}
                            data-state={
                                index < step
                                    ? 'done'
                                    : index === step
                                      ? 'current'
                                      : 'todo'
                            }
                            aria-current={index === step ? 'step' : undefined}
                        >
                            {serviceStates[value][0]}
                        </li>
                    ))}
                </ol>
            )}

            <div className="admin-grid-main">
                <div>
                    <section
                        className="admin-panel"
                        aria-labelledby="request-title"
                    >
                        <h2 id="request-title">Việc cần làm</h2>
                        <dl className="admin-detail-list">
                            <dt>Vợt</dt>
                            <dd>
                                <strong>{order.racket}</strong>
                                {order.quantity > 1 &&
                                    ' × ' + order.quantity + ' cây'}
                            </dd>
                            <dt>Dây</dt>
                            <dd>
                                {order.service_type === 'own_string'
                                    ? 'Khách mang dây tới' +
                                      (order.string_name
                                          ? ': ' + order.string_name
                                          : '')
                                    : order.string_name}
                            </dd>
                            <dt>Mức căng</dt>
                            <dd>
                                <strong>
                                    {order.tension_kg.toLocaleString('vi-VN')}{' '}
                                    kg
                                </strong>
                            </dd>
                            <dt>Hẹn mang vợt</dt>
                            <dd>
                                {order.preferred_at
                                    ? dateTime(order.preferred_at)
                                    : 'Khách chưa chọn giờ'}
                            </dd>
                            {order.notes && (
                                <>
                                    <dt>Ghi chú</dt>
                                    <dd>{order.notes}</dd>
                                </>
                            )}
                        </dl>
                    </section>

                    <section
                        className="admin-panel"
                        aria-labelledby="customer-title"
                    >
                        <h2 id="customer-title">Khách hàng</h2>
                        <dl className="admin-detail-list">
                            <dt>Họ tên</dt>
                            <dd>
                                <strong>{order.name}</strong>
                            </dd>
                            <dt>Điện thoại</dt>
                            <dd>
                                <a href={'tel:' + order.phone}>
                                    <Phone
                                        aria-hidden="true"
                                        className="admin-inline-icon"
                                    />
                                    {order.phone}
                                </a>
                            </dd>
                            {order.email && (
                                <>
                                    <dt>Email</dt>
                                    <dd>
                                        <a href={'mailto:' + order.email}>
                                            {order.email}
                                        </a>
                                    </dd>
                                </>
                            )}
                            <dt>Tài khoản</dt>
                            <dd>
                                {order.customer ? (
                                    <Link
                                        href={
                                            '/admin/customers/' +
                                            order.customer.id +
                                            '?tab=services'
                                        }
                                    >
                                        {order.customer.name} ·{' '}
                                        {order.customer.email}
                                    </Link>
                                ) : (
                                    'Khách không đăng nhập'
                                )}
                            </dd>
                        </dl>
                    </section>

                    <section
                        className="admin-panel"
                        aria-labelledby="price-title"
                    >
                        <h2 id="price-title">Số tiền</h2>
                        <dl className="admin-detail-list">
                            <dt>Dây</dt>
                            <dd>
                                {order.string_price > 0
                                    ? money(order.string_price) +
                                      ' × ' +
                                      order.quantity
                                    : 'Không tính (dây của khách)'}
                            </dd>
                            <dt>Công đan</dt>
                            <dd>
                                {order.labor_fee > 0
                                    ? money(order.labor_fee) +
                                      ' × ' +
                                      order.quantity
                                    : 'Chưa đặt phí công ở Cài đặt lúc khách gửi'}
                            </dd>
                        </dl>
                        <Errors errors={price.errors} />
                        <form
                            className="admin-toolbar"
                            onSubmit={(event) => {
                                event.preventDefault();
                                price.patch(url, { preserveScroll: true });
                            }}
                        >
                            <label htmlFor="total">
                                Thu khi trả vợt (₫)
                                <input
                                    id="total"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={1000}
                                    required
                                    disabled={over}
                                    value={price.data.total}
                                    onChange={(event) =>
                                        price.setData(
                                            'total',
                                            Math.max(
                                                0,
                                                Math.floor(
                                                    Number(event.target.value),
                                                ) || 0,
                                            ),
                                        )
                                    }
                                />
                            </label>
                            {!over && (
                                <button
                                    className="admin-button-secondary"
                                    disabled={busy || !price.isDirty}
                                    data-busy={price.processing}
                                >
                                    {price.processing
                                        ? 'Đang lưu…'
                                        : 'Lưu số tiền'}
                                </button>
                            )}
                        </form>
                        <small className="admin-muted">
                            Tự tính lúc khách gửi yêu cầu. Sửa khi đã thống nhất
                            giá khác với khách, ví dụ công đan dây khách mang
                            tới.
                        </small>
                    </section>
                </div>

                <div>
                    <section
                        className="admin-panel"
                        aria-labelledby="process-title"
                    >
                        <h2 id="process-title">Xử lý</h2>
                        <p className="admin-muted">{guidance[order.status]}</p>
                        <Errors errors={status.errors} />
                        <div className="admin-actions-stack">
                            {options.length > 0 ? (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                            status.data.status ===
                                                'cancelled' &&
                                            !window.confirm(
                                                'Hủy yêu cầu này? Khách có email sẽ được báo, và không hoàn tác được.',
                                            )
                                        )
                                            return;
                                        status.patch(url, {
                                            preserveScroll: true,
                                            onSuccess: () => status.reset(),
                                        });
                                    }}
                                >
                                    <label htmlFor="status">
                                        Chuyển trạng thái
                                    </label>
                                    <div className="admin-toolbar">
                                        <select
                                            required
                                            id="status"
                                            value={status.data.status}
                                            onChange={(event) =>
                                                status.setData(
                                                    'status',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Chọn trạng thái mới
                                            </option>
                                            {options.map((value) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {serviceStates[value][0]}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            disabled={
                                                busy || !status.data.status
                                            }
                                            data-busy={status.processing}
                                        >
                                            {status.processing
                                                ? 'Đang cập nhật…'
                                                : 'Cập nhật'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <p className="admin-muted">
                                    Yêu cầu đã kết thúc; không còn thao tác nào.
                                </p>
                            )}
                        </div>
                    </section>

                    <section
                        className="admin-panel"
                        aria-labelledby="technician-title"
                    >
                        <h2 id="technician-title">Người đan</h2>
                        <Errors errors={technician.errors} />
                        <form
                            className="admin-toolbar"
                            onSubmit={(event) => {
                                event.preventDefault();
                                technician.patch(url, { preserveScroll: true });
                            }}
                        >
                            <label htmlFor="technician_id">
                                Giao cho
                                <select
                                    id="technician_id"
                                    disabled={over}
                                    value={technician.data.technician_id}
                                    onChange={(event) =>
                                        technician.setData(
                                            'technician_id',
                                            event.target.value === ''
                                                ? ''
                                                : Number(event.target.value),
                                        )
                                    }
                                >
                                    <option value="">Chưa giao</option>
                                    {staff.map((person) => (
                                        <option
                                            key={person.id}
                                            value={person.id}
                                        >
                                            {person.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {!over && (
                                <button
                                    className="admin-button-secondary"
                                    disabled={busy || !technician.isDirty}
                                    data-busy={technician.processing}
                                >
                                    {technician.processing
                                        ? 'Đang lưu…'
                                        : 'Lưu'}
                                </button>
                            )}
                        </form>
                    </section>

                    <section
                        className="admin-panel"
                        aria-labelledby="related-title"
                    >
                        <h2 id="related-title">
                            Yêu cầu khác cùng số điện thoại
                        </h2>
                        {related.length ? (
                            <ul className="admin-low-stock">
                                {related.map((item) => (
                                    <li key={item.id}>
                                        <span>
                                            <Link
                                                href={
                                                    '/admin/service-orders/' +
                                                    item.id
                                                }
                                            >
                                                #{item.id} · {item.racket}
                                            </Link>
                                            <small className="admin-muted">
                                                {dateTime(item.created_at)}
                                            </small>
                                        </span>
                                        <ServiceStatus status={item.status} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="admin-muted">
                                Đây là yêu cầu đầu tiên của số điện thoại này.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
