'use client';

import { Head, Link, useForm } from '@/lib/page';
import { Copy, Phone } from 'lucide-react';
import { useState } from 'react';
import {
    dateTime,
    Errors,
    money,
    OrderStatus,
    PageHeader,
    PaymentStatus,
    statuses,
} from './shared';
import type { Order } from './shared';

const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered'],
};
const flow = ['pending', 'confirmed', 'shipped', 'delivered'];
// What the admin should do at each step, in the order's own words.
const guidance: Record<string, string> = {
    pending:
        'Gọi khách xác nhận địa chỉ, giờ nhận và phiên bản trước khi đóng gói.',
    confirmed:
        'Đóng gói, giao cho đơn vị vận chuyển rồi chuyển sang “Đang giao”.',
    shipped: 'Khi khách đã nhận hàng, chuyển sang “Đã giao”.',
    delivered:
        'Đơn đã giao. Ghi nhận tiền COD khi đơn vị giao hàng đã đối soát.',
    cancelled:
        'Đơn đã hủy; tồn kho của các sản phẩm trong đơn đã được hoàn lại.',
};

/** The bank transfer asked for the order (Admin\OrderController::show). */
type Payment = {
    id: number;
    status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
    /** What the customer writes in the transfer, as it reads on the bank statement. */
    reference: string;
    amount: number;
    expires_at: string | null;
    paid_at: string | null;
    refunded_at: string | null;
    /** The member of staff who saw the money arrive, or sent it back. */
    confirmed_by: string | null;
    refunded_by: string | null;
};
const paymentStates: Record<Payment['status'], string> = {
    pending: 'Chờ khách chuyển',
    paid: 'Đã nhận tiền',
    expired: 'Hết hạn, chưa nhận tiền',
    cancelled: 'Đơn hủy trước khi thanh toán',
    refunded: 'Đã hoàn tiền cho khách',
};

type Related = {
    id: number;
    status: string;
    total: number;
    created_at: string;
    is_demo: boolean;
}[];

export default function OrderDetail({
    order,
    payment = null,
    related,
}: {
    order: Order;
    /** Null for an order paid on delivery. */
    payment?: Payment | null;
    related: Related;
}) {
    const form = useForm({ status: '' });
    const collection = useForm({});
    const receipt = useForm({});
    const refund = useForm({});
    const [copied, setCopied] = useState(false);
    const transfer = order.payment_method === 'bank_transfer';
    const paid = order.payment_status === 'paid';
    // A transfer is confirmed by its money and, once paid, cancelled only by a refund.
    const awaiting =
        transfer && order.status === 'pending' && payment?.status === 'pending';
    const refundable =
        transfer &&
        payment?.status === 'paid' &&
        (order.status === 'pending' || order.status === 'confirmed');
    const options = (transitions[order.status] ?? []).filter((value) =>
        !transfer
            ? true
            : value === 'cancelled'
              ? !paid
              : value !== 'confirmed' || paid,
    );
    const busy =
        form.processing ||
        collection.processing ||
        receipt.processing ||
        refund.processing;
    const paymentUrl =
        '/admin/orders/' + order.id + '/payments/' + (payment?.id ?? 0);
    // What to do next, in the order's own words.
    const advice = awaiting
        ? 'Đơn chờ khách chuyển khoản. Khi tiền đã về tài khoản, bấm “Xác nhận đã nhận tiền”: đơn chuyển sang “Đã xác nhận”.'
        : order.status === 'delivered' && transfer
          ? 'Đơn đã giao và đã thanh toán bằng chuyển khoản.'
          : order.status === 'cancelled' && payment?.status === 'expired'
            ? 'Đơn tự hủy vì quá hạn mà chưa nhận được tiền chuyển khoản; tồn kho đã được hoàn lại.'
            : order.status === 'cancelled' && payment?.status === 'refunded'
              ? 'Tiền đã hoàn cho khách; tồn kho của các sản phẩm trong đơn đã được hoàn lại.'
              : guidance[order.status];
    const step = flow.indexOf(order.status);
    const canCollect =
        order.payment_method === 'cod' &&
        order.status === 'delivered' &&
        order.payment_status !== 'paid';
    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(
                order.name + '\n' + order.phone + '\n' + order.address,
            );
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    return (
        <>
            <Head title={'Đơn hàng #' + order.id} />
            <PageHeader
                back={{ href: '/admin/orders', label: 'Đơn hàng' }}
                title={
                    <>
                        Đơn hàng #{order.id}{' '}
                        <OrderStatus status={order.status} />
                    </>
                }
                description={
                    'Đặt lúc ' +
                    dateTime(order.created_at) +
                    ' · Mã theo dõi ' +
                    order.public_id.slice(0, 8)
                }
                actions={
                    <PaymentStatus
                        status={order.payment_status}
                        order={order}
                    />
                }
            />
            {order.is_demo && (
                <p className="admin-notice">
                    Đơn mẫu, tạo khi thử cửa hàng: không phải giao dịch thật và
                    không tính vào số liệu.
                </p>
            )}

            {order.status === 'cancelled' ? (
                <p className="admin-empty admin-cancelled">
                    <strong>Đơn đã hủy.</strong>
                    {advice}
                </p>
            ) : (
                <ol className="admin-steps" aria-label="Tiến trình đơn hàng">
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
                            {statuses[value]}
                        </li>
                    ))}
                </ol>
            )}

            <div className="admin-grid-main">
                <div>
                    <section
                        className="admin-panel admin-panel-flush"
                        aria-labelledby="items-title"
                    >
                        <div className="admin-section-heading">
                            <h2 id="items-title">
                                Sản phẩm đã đặt ({order.items.length})
                            </h2>
                        </div>
                        <div
                            className="admin-table-wrap"
                            role="region"
                            aria-label="Sản phẩm trong đơn"
                            tabIndex={0}
                        >
                            <table>
                                <thead>
                                    <tr>
                                        <th scope="col">Sản phẩm</th>
                                        <th
                                            scope="col"
                                            className="admin-number"
                                        >
                                            Đơn giá
                                        </th>
                                        <th
                                            scope="col"
                                            className="admin-number"
                                        >
                                            SL
                                        </th>
                                        <th
                                            scope="col"
                                            className="admin-number"
                                        >
                                            Thành tiền
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items.map((item) => (
                                        <tr key={item.id}>
                                            <th scope="row">
                                                {item.product_name}
                                                <small>
                                                    {item.variant_name} · SKU{' '}
                                                    {item.sku}
                                                </small>
                                            </th>
                                            <td className="admin-number">
                                                {money(item.unit_price)}
                                            </td>
                                            <td className="admin-number">
                                                {item.quantity}
                                            </td>
                                            <td className="admin-number">
                                                {money(item.line_total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <dl className="admin-totals">
                            <div>
                                <dt>Tiền hàng</dt>
                                <dd>{money(order.subtotal)}</dd>
                            </div>
                            {(order.discount_total ?? 0) > 0 && (
                                <div>
                                    <dt>
                                        Giảm giá
                                        {order.coupon_code &&
                                            ' (mã ' + order.coupon_code + ')'}
                                    </dt>
                                    <dd>−{money(order.discount_total ?? 0)}</dd>
                                </div>
                            )}
                            <div>
                                <dt>Phí giao hàng</dt>
                                <dd>
                                    {order.shipping_fee
                                        ? money(order.shipping_fee)
                                        : 'Miễn phí'}
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    <strong>
                                        {order.payment_method === 'cod'
                                            ? 'Thu khi giao (COD)'
                                            : 'Tổng cộng (chuyển khoản)'}
                                    </strong>
                                </dt>
                                <dd>
                                    <strong>{money(order.total)}</strong>
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section
                        className="admin-panel"
                        aria-labelledby="customer-title"
                    >
                        <div className="admin-section-heading">
                            <h2 id="customer-title">Giao đến</h2>
                            <button
                                type="button"
                                className="admin-button-secondary admin-button-small"
                                onClick={copyAddress}
                            >
                                <Copy aria-hidden="true" />
                                {copied ? 'Đã sao chép' : 'Sao chép địa chỉ'}
                            </button>
                        </div>
                        <dl className="admin-detail-list">
                            <dt>Người nhận</dt>
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
                            <dt>Địa chỉ</dt>
                            <dd>{order.address}</dd>
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
                                {order.user ? (
                                    <Link
                                        href={
                                            '/admin/customers/' + order.user.id
                                        }
                                    >
                                        {order.user.name} · {order.user.email}
                                    </Link>
                                ) : (
                                    'Khách không đăng nhập'
                                )}
                            </dd>
                            {order.notes && (
                                <>
                                    <dt>Ghi chú</dt>
                                    <dd>{order.notes}</dd>
                                </>
                            )}
                        </dl>
                    </section>
                </div>

                <div>
                    <section
                        className="admin-panel"
                        aria-labelledby="process-title"
                    >
                        <h2 id="process-title">Xử lý đơn</h2>
                        <p className="admin-muted">{advice}</p>
                        <Errors errors={form.errors} />
                        <Errors errors={collection.errors} />
                        <Errors errors={receipt.errors} />
                        <Errors errors={refund.errors} />
                        <div className="admin-actions-stack">
                            {awaiting && payment && (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                            window.confirm(
                                                'Tài khoản cửa hàng đã nhận đủ ' +
                                                    money(payment.amount) +
                                                    ' với nội dung ' +
                                                    payment.reference +
                                                    '? Đơn sẽ chuyển sang “Đã xác nhận” và khách được báo qua email.',
                                            )
                                        )
                                            receipt.post(
                                                paymentUrl + '/confirm',
                                                { preserveScroll: true },
                                            );
                                    }}
                                >
                                    <button
                                        disabled={busy}
                                        data-busy={receipt.processing}
                                    >
                                        {receipt.processing
                                            ? 'Đang ghi nhận…'
                                            : 'Xác nhận đã nhận ' +
                                              money(payment.amount)}
                                    </button>
                                    <small className="admin-muted">
                                        Chỉ bấm khi đã thấy khoản tiền trong tài
                                        khoản ngân hàng, đúng số tiền và nội
                                        dung {payment.reference}.
                                    </small>
                                </form>
                            )}
                            {options.length > 0 && (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                            form.data.status === 'cancelled' &&
                                            !window.confirm(
                                                'Hủy đơn và hoàn tồn kho? Thao tác này không thể hoàn tác.',
                                            )
                                        )
                                            return;
                                        form.patch(
                                            '/admin/orders/' + order.id,
                                            {
                                                preserveScroll: true,
                                                onSuccess: () => form.reset(),
                                            },
                                        );
                                    }}
                                >
                                    <label htmlFor="status">
                                        Chuyển trạng thái
                                    </label>
                                    <div className="admin-toolbar">
                                        <select
                                            required
                                            id="status"
                                            value={form.data.status}
                                            onChange={(event) =>
                                                form.setData(
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
                                                    {statuses[value]}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            disabled={busy || !form.data.status}
                                            data-busy={form.processing}
                                        >
                                            {form.processing
                                                ? 'Đang cập nhật…'
                                                : 'Cập nhật'}
                                        </button>
                                    </div>
                                </form>
                            )}
                            {canCollect && (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                            window.confirm(
                                                'Xác nhận đã thực nhận đủ ' +
                                                    money(order.total) +
                                                    ' tiền COD?',
                                            )
                                        )
                                            collection.post(
                                                '/admin/orders/' +
                                                    order.id +
                                                    '/collected',
                                                { preserveScroll: true },
                                            );
                                    }}
                                >
                                    <button
                                        disabled={busy}
                                        data-busy={collection.processing}
                                    >
                                        {collection.processing
                                            ? 'Đang ghi nhận…'
                                            : 'Ghi nhận đã thu ' +
                                              money(order.total)}
                                    </button>
                                    <small className="admin-muted">
                                        Chỉ bấm khi đã nhận đủ tiền. Giao hàng
                                        không tự đánh dấu đã thu.
                                    </small>
                                </form>
                            )}
                            {refundable && payment && (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                            window.confirm(
                                                'Bạn đã chuyển trả ' +
                                                    money(payment.amount) +
                                                    ' cho khách? Đơn sẽ bị hủy, tồn kho được hoàn lại và khách được báo qua email. Thao tác này không thể hoàn tác.',
                                            )
                                        )
                                            refund.post(
                                                paymentUrl + '/refund',
                                                {
                                                    preserveScroll: true,
                                                },
                                            );
                                    }}
                                >
                                    <button
                                        className="admin-button-secondary"
                                        disabled={busy}
                                        data-busy={refund.processing}
                                    >
                                        {refund.processing
                                            ? 'Đang ghi nhận…'
                                            : 'Đã hoàn tiền, hủy đơn'}
                                    </button>
                                    <small className="admin-muted">
                                        Đơn đã thanh toán chỉ hủy được bằng cách
                                        này. Chuyển trả tiền cho khách trước rồi
                                        mới bấm.
                                    </small>
                                </form>
                            )}
                            {options.length === 0 &&
                                !canCollect &&
                                !awaiting &&
                                !refundable && (
                                    <p className="admin-muted">
                                        Đơn đã kết thúc; không còn thao tác nào.
                                    </p>
                                )}
                        </div>
                    </section>

                    {payment && (
                        <section
                            className="admin-panel"
                            aria-labelledby="payment-title"
                        >
                            <h2 id="payment-title">Chuyển khoản</h2>
                            <dl className="admin-detail-list">
                                <dt>Nội dung</dt>
                                <dd>
                                    <strong>{payment.reference}</strong>
                                </dd>
                                <dt>Số tiền</dt>
                                <dd>{money(payment.amount)}</dd>
                                <dt>Tình trạng</dt>
                                <dd>{paymentStates[payment.status]}</dd>
                                {payment.status === 'pending' &&
                                    payment.expires_at && (
                                        <>
                                            <dt>Giữ hàng tới</dt>
                                            <dd>
                                                {dateTime(payment.expires_at)}
                                            </dd>
                                        </>
                                    )}
                                {payment.paid_at && (
                                    <>
                                        <dt>Nhận lúc</dt>
                                        <dd>
                                            {dateTime(payment.paid_at)}
                                            {payment.confirmed_by &&
                                                ' · ' +
                                                    payment.confirmed_by +
                                                    ' xác nhận'}
                                        </dd>
                                    </>
                                )}
                                {payment.refunded_at && (
                                    <>
                                        <dt>Hoàn lúc</dt>
                                        <dd>
                                            {dateTime(payment.refunded_at)}
                                            {payment.refunded_by &&
                                                ' · ' +
                                                    payment.refunded_by +
                                                    ' ghi nhận'}
                                        </dd>
                                    </>
                                )}
                            </dl>
                            {payment.status === 'pending' && (
                                <p className="admin-muted">
                                    Tìm khoản tiền trên sao kê theo nội dung
                                    này. Quá hạn giữ hàng mà chưa xác nhận, đơn
                                    tự hủy và hoàn tồn kho.
                                </p>
                            )}
                        </section>
                    )}

                    <section
                        className="admin-panel"
                        aria-labelledby="related-title"
                    >
                        <h2 id="related-title">Đơn khác cùng số điện thoại</h2>
                        {related.length ? (
                            <ul className="admin-low-stock">
                                {related.map((item) => (
                                    <li key={item.id}>
                                        <span>
                                            <Link
                                                href={
                                                    '/admin/orders/' + item.id
                                                }
                                            >
                                                #{item.id}
                                            </Link>
                                            <small className="admin-muted">
                                                {dateTime(item.created_at)}
                                                {item.is_demo && ' · Đơn mẫu'}
                                            </small>
                                        </span>
                                        <span>
                                            <OrderStatus status={item.status} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="admin-muted">
                                Đây là đơn đầu tiên của số điện thoại này.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
