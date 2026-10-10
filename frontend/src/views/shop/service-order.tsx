'use client';

import { Head, Link, usePage } from '@/lib/page';
import { ShopContact } from '@/layouts/shop-layout';
import {
    kg,
    serviceStatuses,
    vnd,
    type ServiceOrderSummary,
} from '@/types/commerce';

type ServiceOrder = ServiceOrderSummary & {
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    /** Per racket, as quoted when the request was made. */
    string_price: number;
    labor_fee: number;
    /** When the customer plans to bring the racket in. */
    preferred_at: string | null;
};

/** The steps a request goes through, in order; a cancelled one leaves them. */
const flow: ServiceOrderSummary['status'][] = [
    'pending',
    'confirmed',
    'in_progress',
    'ready',
    'completed',
];
const stepNames = [
    'Gửi yêu cầu',
    'Hẹn mang vợt',
    'Đang đan',
    'Đan xong',
    'Đã nhận vợt',
];

const dayTime = (value: string) =>
    new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

export default function ServiceOrderPage({
    order,
    justPlaced = false,
    address,
}: {
    order: ServiceOrder;
    justPlaced?: boolean;
    /** The shop's address, when the owner has entered one. */
    address: string;
}) {
    const signedIn = !!usePage<{ auth: { user: unknown } }>().props.auth?.user;
    const [label] = serviceStatuses[order.status];
    const step = flow.indexOf(order.status);
    const where = address ? 'tới ' + address : 'tới cửa hàng';
    // What the customer does next, at each step.
    const next: Record<ServiceOrderSummary['status'], string> = {
        pending:
            'Cửa hàng sẽ gọi số ' +
            order.phone +
            ' để hẹn lúc bạn mang vợt tới.',
        confirmed:
            'Cửa hàng đã xác nhận. Bạn mang vợt ' +
            where +
            ' và đọc mã ' +
            order.code +
            ' cho nhân viên.',
        in_progress: 'Cửa hàng đã nhận vợt và đang đan.',
        ready:
            'Vợt đã đan xong. Bạn ghé ' +
            (address || 'cửa hàng') +
            ' nhận vợt' +
            (order.total > 0 ? ' và thanh toán ' + vnd(order.total) : '') +
            '.',
        completed: 'Bạn đã nhận lại vợt. Cảm ơn bạn đã dùng dịch vụ.',
        cancelled:
            'Yêu cầu này đã hủy. Nếu bạn không yêu cầu hủy, hãy liên hệ cửa hàng.',
    };

    return (
        <>
            <Head title={'Yêu cầu đan dây ' + order.code}>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <header className="store-page-heading">
                <div>
                    <h1>
                        {justPlaced
                            ? 'Đã gửi yêu cầu đan dây'
                            : 'Yêu cầu đan dây ' + order.code}
                    </h1>
                    <p>
                        Mã yêu cầu: <strong>{order.code}</strong>
                    </p>
                </div>
                <Link
                    href={signedIn ? '/account#dan-day' : '/services'}
                    className="store-text-link"
                >
                    {signedIn ? 'Về tài khoản của tôi' : 'Gửi yêu cầu khác'}
                </Link>
            </header>
            {/* Who asked and how to reach them: masked in Clarity recordings. */}
            <div className="store-two-column" data-clarity-mask="true">
                <section>
                    <div className="store-notice">
                        <strong>Trạng thái: {label}</strong>
                        <br />
                        {next[order.status]}
                    </div>
                    {step >= 0 && (
                        <ol
                            className="store-steps"
                            aria-label="Tiến trình yêu cầu"
                        >
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
                                    aria-current={
                                        index === step ? 'step' : undefined
                                    }
                                >
                                    {stepNames[index]}
                                </li>
                            ))}
                        </ol>
                    )}
                    <h2>Yêu cầu</h2>
                    <dl className="store-specs">
                        <div>
                            <dt>Vợt</dt>
                            <dd>
                                {order.racket}
                                {order.quantity > 1 && ' × ' + order.quantity}
                            </dd>
                        </div>
                        <div>
                            <dt>Dây</dt>
                            <dd>
                                {order.service_type === 'own_string'
                                    ? 'Dây bạn mang tới' +
                                      (order.string_name
                                          ? ' (' + order.string_name + ')'
                                          : '')
                                    : order.string_name}
                            </dd>
                        </div>
                        <div>
                            <dt>Mức căng</dt>
                            <dd>{kg(order.tension_kg)}</dd>
                        </div>
                        {order.preferred_at && (
                            <div>
                                <dt>Hẹn mang vợt tới</dt>
                                <dd>{dayTime(order.preferred_at)}</dd>
                            </div>
                        )}
                        <div>
                            <dt>Gửi lúc</dt>
                            <dd>{dayTime(order.created_at)}</dd>
                        </div>
                    </dl>
                    {order.notes && (
                        <p>
                            <strong>Ghi chú:</strong> {order.notes}
                        </p>
                    )}
                    <dl className="store-totals">
                        {order.string_price > 0 && (
                            <div>
                                <dt>Dây × {order.quantity}</dt>
                                <dd>
                                    {vnd(order.string_price * order.quantity)}
                                </dd>
                            </div>
                        )}
                        {order.labor_fee > 0 && (
                            <div>
                                <dt>Công đan × {order.quantity}</dt>
                                <dd>{vnd(order.labor_fee * order.quantity)}</dd>
                            </div>
                        )}
                        <div className="store-total">
                            <dt>Trả khi nhận vợt</dt>
                            <dd>
                                {order.total > 0
                                    ? vnd(order.total)
                                    : 'Cửa hàng báo khi nhận vợt'}
                            </dd>
                        </div>
                    </dl>
                </section>
                <aside className="store-summary">
                    <h2>Liên hệ</h2>
                    <dl className="store-specs">
                        <div>
                            <dt>Họ tên</dt>
                            <dd>{order.name}</dd>
                        </div>
                        <div>
                            <dt>Số điện thoại</dt>
                            <dd>{order.phone}</dd>
                        </div>
                        {order.email && (
                            <div>
                                <dt>Email</dt>
                                <dd>{order.email}</dd>
                            </div>
                        )}
                    </dl>
                    <p className="store-hint">
                        {order.email
                            ? 'Cửa hàng gửi email khi vợt đan xong. Liên kết trong email mở lại trang này.'
                            : signedIn
                              ? 'Xem lại yêu cầu này trong tài khoản của bạn.'
                              : 'Lưu mã yêu cầu để đọc cho nhân viên khi tới cửa hàng.'}
                    </p>
                    <ShopContact />
                </aside>
            </div>
        </>
    );
}
