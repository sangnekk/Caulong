import { Head, Link, useForm } from '@inertiajs/react';
import { Errors, money, statuses } from './shared';
import type { Order } from './shared';

const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered'],
};
export default function OrderDetail({ order }: { order: Order }) {
    const form = useForm({ status: '' });
    const collection = useForm({});
    const options = transitions[order.status] ?? [];
    return (
        <>
            <Head title={'Đơn hàng #' + order.id} />
            <Link href="/admin/orders">Về danh sách đơn hàng</Link>
            <div className="admin-heading">
                <h1>Đơn hàng #{order.id}</h1>
                <span className="admin-badge">{statuses[order.status]}</span>
            </div>
            <p className="admin-muted">
                {order.public_id} ·{' '}
                {new Date(order.created_at).toLocaleString('vi-VN')}
            </p>
            {order.is_demo && (
                <p className="admin-notice">
                    Đơn mẫu — không dùng làm số liệu giao dịch thật.
                </p>
            )}
            <div className="admin-two-columns">
                <section>
                    <h2>Thông tin nhận hàng</h2>
                    <address>
                        <strong>{order.name}</strong>
                        <br />
                        {order.phone}
                        <br />
                        {order.address}
                        {order.email && (
                            <>
                                <br />
                                {order.email}
                            </>
                        )}
                    </address>
                    {order.notes && (
                        <p>
                            <strong>Ghi chú:</strong> {order.notes}
                        </p>
                    )}
                </section>
                <section>
                    <h2>Xử lý đơn</h2>
                    <p>
                        Thanh toán COD:{' '}
                        <strong>
                            {order.payment_status === 'paid'
                                ? 'Đã thu tiền'
                                : 'Chưa thu tiền'}
                        </strong>
                    </p>
                    <Errors errors={form.errors} />
                    <Errors errors={collection.errors} />
                    {options.length > 0 ? (
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
                                form.patch('/admin/orders/' + order.id, {
                                    preserveScroll: true,
                                    onSuccess: () => form.reset(),
                                });
                            }}
                        >
                            <label htmlFor="status">Chuyển trạng thái</label>
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
                                    <option value="">Chọn trạng thái</option>
                                    {options.map((value) => (
                                        <option key={value} value={value}>
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
                                >
                                    {form.processing
                                        ? 'Đang cập nhật…'
                                        : 'Cập nhật'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <p>Đơn đã kết thúc; không thể chuyển trạng thái.</p>
                    )}
                    {order.payment_method === 'cod' &&
                        order.status === 'delivered' &&
                        order.payment_status !== 'paid' && (
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
                                <p>
                                    Chỉ xác nhận khi đã nhận đủ tiền. Giao hàng
                                    không tự đánh dấu đã thu.
                                </p>
                                <button
                                    disabled={
                                        collection.processing || form.processing
                                    }
                                >
                                    {collection.processing
                                        ? 'Đang xác nhận…'
                                        : 'Xác nhận đã thu tiền COD'}
                                </button>
                            </form>
                        )}
                </section>
            </div>
            <h2>Sản phẩm đã đặt</h2>
            <div
                className="admin-table-wrap"
                role="region"
                aria-label="Sản phẩm trong đơn"
                tabIndex={0}
            >
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Sản phẩm / SKU</th>
                            <th scope="col" className="admin-number">
                                Đơn giá
                            </th>
                            <th scope="col" className="admin-number">
                                Số lượng
                            </th>
                            <th scope="col" className="admin-number">
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
                                        {item.variant_name} · {item.sku}
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
                    <dd>{money(order.shipping_fee)}</dd>
                </div>
                <div>
                    <dt>Tổng cộng</dt>
                    <dd>
                        <strong>{money(order.total)}</strong>
                    </dd>
                </div>
            </dl>
        </>
    );
}
