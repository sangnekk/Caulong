import { Head, Link, usePage } from '@inertiajs/react';
import { DemoBadge, OrderTotals, ShopContact } from '@/layouts/shop-layout';
import { vnd, type Order } from '@/types/commerce';

const statusLabels: Record<string, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
};
const paymentLabels: Record<string, string> = {
    unpaid: 'Chưa thu tiền',
    paid: 'Đã thu tiền',
};

export default function OrderPage({
    order,
    trackingUrl,
    justPlaced = false,
}: {
    order: Order;
    trackingUrl: string;
    justPlaced?: boolean;
}) {
    const signedIn = !!usePage<{ auth: { user: unknown } }>().props.auth?.user;
    const code = order.public_id.slice(0, 8).toUpperCase();
    return (
        <>
            <Head title={'Đơn hàng ' + code}>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <header className="store-page-heading">
                <div>
                    <h1>
                        {justPlaced
                            ? 'Đặt hàng thành công'
                            : 'Đơn hàng ' + code}
                    </h1>
                    <p>
                        Mã đơn: <strong>{order.public_id}</strong>
                    </p>
                </div>
                <Link
                    href={signedIn ? '/account#don-hang' : '/products'}
                    className="store-text-link"
                >
                    {signedIn ? 'Về đơn hàng của tôi' : 'Tiếp tục mua sắm'}
                </Link>
            </header>
            {order.is_demo && (
                <p className="store-notice">
                    <DemoBadge /> Đơn mẫu vì có sản phẩm mẫu. Không phải giao
                    dịch hàng thực tế.
                </p>
            )}
            <div className="store-two-column">
                <section>
                    <div className="store-notice">
                        <strong>
                            Trạng thái:{' '}
                            {statusLabels[order.status] ?? order.status}
                        </strong>
                        <br />
                        Thanh toán:{' '}
                        {paymentLabels[order.payment_status] ??
                            order.payment_status}{' '}
                        · Thanh toán khi nhận hàng
                    </div>
                    <h2>Sản phẩm</h2>
                    <ul className="store-order-items">
                        {order.items.map((item, index) => (
                            <li key={item.sku + ':' + index}>
                                <div>
                                    <strong>{item.product_name}</strong>
                                    <p>
                                        {item.variant_name} · {item.sku} · Số
                                        lượng {item.quantity}
                                    </p>
                                </div>
                                <span>{vnd(item.line_total)}</span>
                            </li>
                        ))}
                    </ul>
                    <OrderTotals totals={order} />
                </section>
                <aside className="store-summary">
                    <h2>Thông tin nhận hàng</h2>
                    <dl className="store-specs">
                        <div>
                            <dt>Người nhận</dt>
                            <dd>{order.name}</dd>
                        </div>
                        <div>
                            <dt>Số điện thoại</dt>
                            <dd>{order.phone}</dd>
                        </div>
                        <div>
                            <dt>Địa chỉ</dt>
                            <dd>{order.address}</dd>
                        </div>
                        {order.email && (
                            <div>
                                <dt>Email</dt>
                                <dd>{order.email}</dd>
                            </div>
                        )}
                    </dl>
                    {order.notes && (
                        <p>
                            <strong>Ghi chú:</strong> {order.notes}
                        </p>
                    )}
                    <p className="store-hint">
                        Lưu đường dẫn này để xem lại đơn trong phiên hiện tại.
                    </p>
                    <ShopContact />
                    <a className="store-button store-full" href={trackingUrl}>
                        Tải lại đơn hàng
                    </a>
                </aside>
            </div>
        </>
    );
}
