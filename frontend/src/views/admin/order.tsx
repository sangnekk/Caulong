import { Head, Link, useForm } from '@inertiajs/react';
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

type Related = {
    id: number;
    status: string;
    total: number;
    created_at: string;
    is_demo: boolean;
}[];

export default function OrderDetail({
    order,
    related,
}: {
    order: Order;
    related: Related;
}) {
    const form = useForm({ status: '' });
    const collection = useForm({});
    const [copied, setCopied] = useState(false);
    const options = transitions[order.status] ?? [];
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
                actions={<PaymentStatus status={order.payment_status} />}
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
                    {guidance.cancelled}
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
                                            : 'Tổng cộng'}
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
                                {order.user
                                    ? order.user.name + ' · ' + order.user.email
                                    : 'Khách không đăng nhập'}
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
                        <p className="admin-muted">{guidance[order.status]}</p>
                        <Errors errors={form.errors} />
                        <Errors errors={collection.errors} />
                        <div className="admin-actions-stack">
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
                                            disabled={
                                                form.processing ||
                                                collection.processing ||
                                                !form.data.status
                                            }
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
                                        disabled={
                                            collection.processing ||
                                            form.processing
                                        }
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
                            {options.length === 0 && !canCollect && (
                                <p className="admin-muted">
                                    Đơn đã kết thúc; không còn thao tác nào.
                                </p>
                            )}
                        </div>
                    </section>

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
