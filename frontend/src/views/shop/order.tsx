'use client';

import { Head, Link, usePage } from '@/lib/page';
import { useEffect, useState } from 'react';
import { DemoBadge, OrderTotals, ShopContact } from '@/layouts/shop-layout';
import { mark } from '@/lib/analytics';
import {
    paymentLabel,
    shortOrderCode,
    vnd,
    type Order,
    type OrderPayment,
} from '@/types/commerce';

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

/** A deadline in the shop's own time, wherever the page is read. */
const shopTime = (value: string) =>
    new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
    });

/** Copies one figure of the transfer, so it is not retyped wrong in the banking app. */
function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            className="store-copy"
            aria-label={'Sao chép ' + label}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                } catch {
                    setCopied(false);
                }
            }}
        >
            <span aria-live="polite">{copied ? 'Đã chép' : 'Sao chép'}</span>
        </button>
    );
}

/** Where to send the money for an order that waits for its transfer. */
function TransferInstructions({ payment }: { payment: OrderPayment }) {
    const account = payment.account;
    return (
        <section className="store-transfer" aria-labelledby="transfer-title">
            <h2 id="transfer-title">Chuyển khoản để hoàn tất đơn</h2>
            {account ? (
                <>
                    <p>
                        Chuyển đúng số tiền và ghi đúng nội dung bên dưới. Cửa
                        hàng xác nhận rồi giao hàng sau khi nhận được tiền.
                    </p>
                    <div className="store-transfer-body">
                        {account.qr && (
                            <figure className="store-transfer-qr">
                                <img
                                    src={account.qr}
                                    width={220}
                                    height={220}
                                    alt={
                                        'Mã QR chuyển ' +
                                        vnd(payment.amount) +
                                        ' tới ' +
                                        account.bank +
                                        ', nội dung ' +
                                        payment.reference
                                    }
                                />
                                <figcaption>
                                    Quét bằng ứng dụng ngân hàng: số tiền và nội
                                    dung được điền sẵn.
                                </figcaption>
                            </figure>
                        )}
                        <dl className="store-specs">
                            <div>
                                <dt>Ngân hàng</dt>
                                <dd>{account.bank}</dd>
                            </div>
                            <div>
                                <dt>Số tài khoản</dt>
                                <dd>
                                    <strong>{account.number}</strong>
                                    <CopyButton
                                        value={account.number}
                                        label="số tài khoản"
                                    />
                                </dd>
                            </div>
                            <div>
                                <dt>Chủ tài khoản</dt>
                                <dd>{account.name}</dd>
                            </div>
                            <div>
                                <dt>Số tiền</dt>
                                <dd>
                                    <strong>{vnd(payment.amount)}</strong>
                                    <CopyButton
                                        value={String(payment.amount)}
                                        label="số tiền"
                                    />
                                </dd>
                            </div>
                            <div>
                                <dt>Nội dung</dt>
                                <dd>
                                    <strong>{payment.reference}</strong>
                                    <CopyButton
                                        value={payment.reference}
                                        label="nội dung chuyển khoản"
                                    />
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <p className="store-hint">
                        Kiểm tra tên chủ tài khoản trong ứng dụng ngân hàng
                        trước khi chuyển.
                        {payment.expires_at &&
                            ' Đơn giữ hàng tới ' +
                                shopTime(payment.expires_at) +
                                ' (giờ Việt Nam); sau thời điểm đó, đơn chưa thanh toán sẽ tự hủy.'}
                    </p>
                </>
            ) : (
                <p>
                    Cửa hàng đang cập nhật tài khoản nhận tiền. Vui lòng liên hệ
                    cửa hàng để được hướng dẫn thanh toán cho đơn này, nội dung
                    chuyển khoản <strong>{payment.reference}</strong>.
                </p>
            )}
        </section>
    );
}

export default function OrderPage({
    order,
    payment = null,
    trackingUrl,
    justPlaced = false,
}: {
    order: Order;
    /** The order's bank transfer; null when it is paid on delivery. */
    payment?: OrderPayment | null;
    trackingUrl: string;
    justPlaced?: boolean;
}) {
    const signedIn = !!usePage<{ auth: { user: unknown } }>().props.auth?.user;
    const code = shortOrderCode(order.public_id);
    const awaited = payment?.status === 'pending';
    useEffect(() => {
        if (justPlaced) mark('order_placed');
    }, [justPlaced]);
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
                        Mã đơn: <strong>{code}</strong>
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
            {/* Who the order goes to and where: masked in Clarity recordings. */}
            <div className="store-two-column" data-clarity-mask="true">
                <section>
                    <div className="store-notice">
                        <strong>
                            Trạng thái:{' '}
                            {awaited
                                ? 'Chờ thanh toán'
                                : (statusLabels[order.status] ?? order.status)}
                        </strong>
                        <br />
                        {payment ? (
                            <>
                                Thanh toán: {paymentLabel(order)} · Chuyển khoản
                                ngân hàng
                            </>
                        ) : (
                            <>
                                Thanh toán:{' '}
                                {paymentLabels[order.payment_status] ??
                                    order.payment_status}{' '}
                                · Thanh toán khi nhận hàng
                            </>
                        )}
                    </div>
                    {payment && awaited && (
                        <TransferInstructions payment={payment} />
                    )}
                    {payment?.status === 'paid' && (
                        <p className="store-hint">
                            Cửa hàng đã nhận {vnd(payment.amount)} chuyển khoản
                            cho đơn này. Bạn không cần trả thêm gì khi nhận
                            hàng.
                        </p>
                    )}
                    {payment?.status === 'expired' && (
                        <p className="store-error">
                            Đơn đã tự hủy vì cửa hàng chưa nhận được tiền trong
                            thời hạn giữ hàng. Nếu bạn đã chuyển khoản, hãy liên
                            hệ cửa hàng kèm nội dung{' '}
                            <strong>{payment.reference}</strong> để được hoàn
                            tiền hoặc đặt lại đơn.
                        </p>
                    )}
                    {payment?.status === 'refunded' && (
                        <p className="store-hint">
                            Cửa hàng đã chuyển trả {vnd(payment.amount)} cho đơn
                            này. Nếu sau vài ngày làm việc bạn chưa nhận được,
                            hãy liên hệ cửa hàng.
                        </p>
                    )}
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
                    <OrderTotals
                        totals={order}
                        discount={order.discount_total}
                        couponCode={order.coupon_code}
                    />
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
                        {awaited
                            ? 'Tôi đã chuyển khoản, tải lại đơn'
                            : 'Tải lại đơn hàng'}
                    </a>
                </aside>
            </div>
        </>
    );
}
