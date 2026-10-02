import { Head, Link, router, useForm } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { shortOrderCode, vnd } from '@/types/commerce';

type AccountOrder = {
    public_id: string;
    status: string;
    payment_status: string;
    total: number;
    is_demo: boolean;
    created_at: string;
    items: { product_name: string; variant_name: string; quantity: number }[];
};
type Page<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

const statuses: Record<string, [string, string]> = {
    pending: ['Chờ xác nhận', 'warning'],
    confirmed: ['Đã xác nhận', 'accent'],
    shipped: ['Đang giao', 'info'],
    delivered: ['Đã giao', 'success'],
    cancelled: ['Đã hủy', 'danger'],
};

function describe(items: AccountOrder['items']) {
    if (!items.length) return '';
    const first = items[0].product_name + ' × ' + items[0].quantity;
    return items.length === 1
        ? first
        : first + ' và ' + (items.length - 1) + ' sản phẩm khác';
}

function FieldError({ message }: { message?: string }) {
    return message ? <p className="store-field-error">{message}</p> : null;
}

export default function Account({
    account,
    orders,
    totals,
}: {
    account: {
        name: string;
        email: string;
        verified: boolean;
        is_admin: boolean;
        joined: string;
    };
    orders: Page<AccountOrder>;
    totals: { orders: number; open: number };
}) {
    const profile = useForm({ name: account.name, email: account.email });
    const password = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const [signingOut, setSigningOut] = useState(false);
    const [resent, setResent] = useState(false);
    const signOut = () => {
        setSigningOut(true);
        router.post('/logout', {}, { onFinish: () => setSigningOut(false) });
    };

    return (
        <>
            <Head title="Tài khoản của tôi" />
            <header className="store-page-heading">
                <div>
                    <h1>Tài khoản của tôi</h1>
                    <p>
                        Xin chào, {account.name}.{' '}
                        {totals.orders
                            ? 'Bạn có ' +
                              totals.orders +
                              ' đơn hàng' +
                              (totals.open
                                  ? ', ' + totals.open + ' đơn đang xử lý.'
                                  : '.')
                            : 'Đơn đặt khi đã đăng nhập sẽ được lưu ở đây.'}
                    </p>
                </div>
                <button
                    type="button"
                    className="store-button store-button-secondary"
                    onClick={signOut}
                    disabled={signingOut}
                >
                    <LogOut size={17} aria-hidden="true" />
                    &nbsp;{signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
            </header>

            {!account.verified && (
                <div
                    className="store-notice store-account-signout-row"
                    role="status"
                >
                    <p>
                        Email <strong>{account.email}</strong> chưa được xác
                        minh. Mở email và bấm liên kết xác minh.
                    </p>
                    <button
                        type="button"
                        className="store-button store-button-secondary"
                        disabled={resent}
                        onClick={() =>
                            router.post(
                                '/email/verification-notification',
                                {},
                                {
                                    preserveScroll: true,
                                    onSuccess: () => setResent(true),
                                },
                            )
                        }
                    >
                        {resent ? 'Đã gửi lại email' : 'Gửi lại email xác minh'}
                    </button>
                </div>
            )}

            <div className="store-account-page">
                <section aria-labelledby="don-hang" id="orders">
                    <h2 id="don-hang">Đơn hàng của tôi</h2>
                    {orders.data.length ? (
                        <>
                            <ol className="store-account-orders">
                                {orders.data.map((order) => {
                                    const [label, tone] = statuses[
                                        order.status
                                    ] ?? [order.status, ''];
                                    return (
                                        <li
                                            key={order.public_id}
                                            className="store-account-order"
                                        >
                                            <div>
                                                <h3>
                                                    Đơn{' '}
                                                    {shortOrderCode(
                                                        order.public_id,
                                                    )}
                                                    <span
                                                        className="store-status"
                                                        data-tone={tone}
                                                    >
                                                        {label}
                                                    </span>
                                                    {order.is_demo && (
                                                        <span className="store-status">
                                                            Đơn mẫu
                                                        </span>
                                                    )}
                                                </h3>
                                                <p>{describe(order.items)}</p>
                                                <p>
                                                    Đặt ngày{' '}
                                                    {new Date(
                                                        order.created_at,
                                                    ).toLocaleDateString(
                                                        'vi-VN',
                                                    )}{' '}
                                                    ·{' '}
                                                    {order.payment_status ===
                                                    'paid'
                                                        ? 'Đã thanh toán'
                                                        : 'Thanh toán khi nhận hàng'}
                                                </p>
                                            </div>
                                            <div className="store-account-order-total">
                                                {vnd(order.total)}
                                                <br />
                                                <Link
                                                    href={
                                                        '/orders/' +
                                                        order.public_id
                                                    }
                                                >
                                                    Xem chi tiết
                                                    <span className="store-sr-only">
                                                        {' '}
                                                        đơn{' '}
                                                        {shortOrderCode(
                                                            order.public_id,
                                                        )}
                                                    </span>
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            {orders.last_page > 1 && (
                                <nav
                                    className="store-pagination"
                                    aria-label="Trang đơn hàng"
                                >
                                    {orders.prev_page_url && (
                                        <Link
                                            href={orders.prev_page_url}
                                            preserveScroll
                                        >
                                            Đơn mới hơn
                                        </Link>
                                    )}
                                    <span>
                                        Trang {orders.current_page}/
                                        {orders.last_page}
                                    </span>
                                    {orders.next_page_url && (
                                        <Link
                                            href={orders.next_page_url}
                                            preserveScroll
                                        >
                                            Đơn cũ hơn
                                        </Link>
                                    )}
                                </nav>
                            )}
                        </>
                    ) : (
                        <div className="store-account-empty">
                            <p>
                                Bạn chưa có đơn hàng nào. Đơn đặt khi đã đăng
                                nhập sẽ hiện ở đây để bạn theo dõi trạng thái
                                giao hàng.
                            </p>
                            <Link href="/products" className="store-button">
                                Xem vợt cầu lông
                            </Link>
                        </div>
                    )}
                </section>

                <aside
                    className="store-account-side"
                    aria-label="Thiết lập tài khoản"
                >
                    {account.is_admin && (
                        <section className="store-account-card">
                            <h2>Quản trị cửa hàng</h2>
                            <p className="store-muted">
                                Tài khoản này có quyền quản trị: đơn hàng, sản
                                phẩm, nhập hàng.
                            </p>
                            <Link href="/admin" className="store-button">
                                Mở trang quản trị
                            </Link>
                        </section>
                    )}

                    <section
                        className="store-account-card"
                        aria-labelledby="profile-title"
                    >
                        <h2 id="profile-title">Thông tin tài khoản</h2>
                        <dl className="store-account-facts">
                            <dt>Tham gia</dt>
                            <dd>
                                {new Date(account.joined).toLocaleDateString(
                                    'vi-VN',
                                )}
                            </dd>
                            <dt>Email</dt>
                            <dd>
                                {account.verified
                                    ? 'Đã xác minh'
                                    : 'Chưa xác minh'}
                            </dd>
                        </dl>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                profile.patch('/account', {
                                    preserveScroll: true,
                                });
                            }}
                        >
                            <div className="store-field">
                                <label htmlFor="account-name">Họ tên</label>
                                <input
                                    id="account-name"
                                    required
                                    maxLength={255}
                                    autoComplete="name"
                                    value={profile.data.name}
                                    onChange={(event) =>
                                        profile.setData(
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={!!profile.errors.name}
                                />
                                <FieldError message={profile.errors.name} />
                            </div>
                            <div className="store-field">
                                <label htmlFor="account-email">Email</label>
                                <input
                                    id="account-email"
                                    type="email"
                                    required
                                    maxLength={255}
                                    autoComplete="email"
                                    value={profile.data.email}
                                    onChange={(event) =>
                                        profile.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={!!profile.errors.email}
                                    aria-describedby="account-email-hint"
                                />
                                <p
                                    id="account-email-hint"
                                    className="store-hint"
                                >
                                    Đổi email thì cần xác minh lại địa chỉ mới.
                                </p>
                                <FieldError message={profile.errors.email} />
                            </div>
                            <button
                                className="store-button"
                                disabled={
                                    profile.processing || !profile.isDirty
                                }
                            >
                                {profile.processing
                                    ? 'Đang lưu…'
                                    : 'Lưu thông tin'}
                            </button>
                        </form>
                    </section>

                    <section
                        className="store-account-card"
                        aria-labelledby="password-title"
                    >
                        <h2 id="password-title">Đổi mật khẩu</h2>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                password.put('/account/password', {
                                    preserveScroll: true,
                                    onSuccess: () => password.reset(),
                                    onError: () =>
                                        password.reset(
                                            'password',
                                            'password_confirmation',
                                        ),
                                });
                            }}
                        >
                            <div className="store-field">
                                <label htmlFor="current_password">
                                    Mật khẩu hiện tại
                                </label>
                                <input
                                    id="current_password"
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    value={password.data.current_password}
                                    onChange={(event) =>
                                        password.setData(
                                            'current_password',
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={
                                        !!password.errors.current_password
                                    }
                                />
                                <FieldError
                                    message={password.errors.current_password}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="new_password">
                                    Mật khẩu mới
                                </label>
                                <input
                                    id="new_password"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={password.data.password}
                                    onChange={(event) =>
                                        password.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={!!password.errors.password}
                                />
                                <FieldError
                                    message={password.errors.password}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="new_password_confirmation">
                                    Nhập lại mật khẩu mới
                                </label>
                                <input
                                    id="new_password_confirmation"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={password.data.password_confirmation}
                                    onChange={(event) =>
                                        password.setData(
                                            'password_confirmation',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <button
                                className="store-button"
                                disabled={password.processing}
                            >
                                {password.processing
                                    ? 'Đang đổi…'
                                    : 'Đổi mật khẩu'}
                            </button>
                        </form>
                    </section>
                </aside>
            </div>
        </>
    );
}
