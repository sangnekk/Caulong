'use client';

import { Head, Link, router, useForm } from '@/lib/page';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { ProductImage } from '@/layouts/shop-layout';
import {
    couponTerms,
    kg,
    paymentLabel,
    serviceStatuses,
    shortOrderCode,
    vnd,
    type AccountCoupon,
    type ServiceOrderSummary,
    type WishlistItem,
} from '@/types/commerce';

type AccountOrder = {
    public_id: string;
    status: string;
    payment_status: string;
    payment_method: string;
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

const couponStates: Record<AccountCoupon['state'], [string, string]> = {
    usable: ['Dùng được', 'success'],
    scheduled: ['Chưa tới ngày', 'info'],
    used: ['Đã dùng', ''],
    expired: ['Hết hạn', ''],
};

/** A conversation with the shop in the support chat (App\Services\SupportChat::history). */
type AccountConversation = {
    id: number;
    status: 'open' | 'pending' | 'resolved' | 'closed';
    started_at: string;
    last_message_at: string | null;
    /** How it began: the customer's first message. */
    excerpt: string;
    messages: number;
};
type ChatLine = {
    id: number;
    sender: 'customer' | 'admin' | 'bot';
    body: string;
};

const chatStates: Record<AccountConversation['status'], [string, string]> = {
    open: ['Đang chờ shop trả lời', 'warning'],
    pending: ['Shop đã trả lời', 'info'],
    resolved: ['Đã giải quyết', 'success'],
    closed: ['Đã đóng', ''],
};

/** One past conversation; its messages are fetched the first time it is opened. */
function Conversation({ conversation }: { conversation: AccountConversation }) {
    const [open, setOpen] = useState(false);
    const [lines, setLines] = useState<ChatLine[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [label, tone] = chatStates[conversation.status];
    const thread = 'chat-' + conversation.id;
    const toggle = () => {
        setOpen(!open);
        if (open || lines) return;
        setFailed(false);
        fetch('/support-chat/conversations/' + conversation.id, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        })
            .then((response) =>
                response.ok
                    ? (response.json() as Promise<{ messages: ChatLine[] }>)
                    : Promise.reject(new Error(String(response.status))),
            )
            .then((data) => setLines(data.messages))
            .catch(() => setFailed(true));
    };

    return (
        <li>
            <h3>
                Ngày{' '}
                {new Date(conversation.started_at).toLocaleDateString('vi-VN')}
                <span className="store-status" data-tone={tone}>
                    {label}
                </span>
            </h3>
            <p>“{conversation.excerpt}”</p>
            <p>
                {conversation.messages} tin nhắn ·{' '}
                <button
                    type="button"
                    className="store-chat-link"
                    aria-expanded={open}
                    aria-controls={thread}
                    onClick={toggle}
                >
                    {open ? 'Thu gọn' : 'Xem lại'}
                </button>
            </p>
            {open && (
                <div id={thread} className="store-history-thread">
                    {failed ? (
                        <p role="alert">
                            Không tải được cuộc trò chuyện. Vui lòng thử lại
                            sau.
                        </p>
                    ) : lines === null ? (
                        <p role="status">Đang tải…</p>
                    ) : (
                        lines.map((line) => (
                            <div
                                key={line.id}
                                className="store-chat-message"
                                data-author={
                                    line.sender === 'customer'
                                        ? 'visitor'
                                        : 'assistant'
                                }
                            >
                                {line.sender === 'admin' && (
                                    <small>Nhân viên hỗ trợ</small>
                                )}
                                <p>{line.body}</p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </li>
    );
}

function FieldError({ message }: { message?: string }) {
    return message ? <p className="store-field-error">{message}</p> : null;
}

export default function Account({
    account,
    orders,
    wishlist,
    coupons,
    serviceOrders,
    conversations,
    totals,
}: {
    account: {
        name: string;
        email: string;
        verified: boolean;
        is_admin: boolean;
        joined: string;
        /** They agreed to promotional email. */
        marketing: boolean;
    };
    orders: Page<AccountOrder>;
    wishlist: WishlistItem[];
    /** Made for this customer or for their group; nobody else's. */
    coupons: AccountCoupon[];
    /** The rackets they asked the shop to string, the latest first. */
    serviceOrders: ServiceOrderSummary[];
    /** Their conversations in the support chat, the latest first. */
    conversations: AccountConversation[];
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
    const [removing, setRemoving] = useState<string | null>(null);
    const [switching, setSwitching] = useState(false);
    // Deleting the account: asked for first, then confirmed with the password.
    const removal = useForm({ password: '' });
    const [closing, setClosing] = useState(false);
    const unsave = (slug: string) => {
        setRemoving(slug);
        router.delete('/wishlist/' + slug, {
            preserveScroll: true,
            onFinish: () => setRemoving(null),
        });
    };
    const signOut = () => {
        setSigningOut(true);
        router.post('/logout', {}, { onFinish: () => setSigningOut(false) });
    };

    return (
        // Everything here is the customer's own: masked in Clarity recordings.
        <div data-clarity-mask="true">
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
                <div className="store-account-main">
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
                                                    <p>
                                                        {describe(order.items)}
                                                    </p>
                                                    <p>
                                                        Đặt ngày{' '}
                                                        {new Date(
                                                            order.created_at,
                                                        ).toLocaleDateString(
                                                            'vi-VN',
                                                        )}{' '}
                                                        · {paymentLabel(order)}
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
                                    Bạn chưa có đơn hàng nào. Đơn đặt khi đã
                                    đăng nhập sẽ hiện ở đây để bạn theo dõi
                                    trạng thái giao hàng.
                                </p>
                                <Link href="/products" className="store-button">
                                    Xem vợt cầu lông
                                </Link>
                            </div>
                        )}
                    </section>

                    {serviceOrders.length > 0 && (
                        <section aria-labelledby="dan-day">
                            <h2 id="dan-day">Yêu cầu đan dây của tôi</h2>
                            <ol className="store-account-orders">
                                {serviceOrders.map((request) => {
                                    const [label, tone] =
                                        serviceStatuses[request.status];
                                    return (
                                        <li
                                            key={request.public_id}
                                            className="store-account-order"
                                        >
                                            <div>
                                                <h3>
                                                    Yêu cầu {request.code}
                                                    <span
                                                        className="store-status"
                                                        data-tone={tone}
                                                    >
                                                        {label}
                                                    </span>
                                                </h3>
                                                <p>
                                                    {request.racket}
                                                    {request.quantity > 1 &&
                                                        ' × ' +
                                                            request.quantity}
                                                    {' · '}
                                                    {request.service_type ===
                                                    'own_string'
                                                        ? 'dây bạn mang tới'
                                                        : request.string_name}
                                                    {' · '}
                                                    {kg(request.tension_kg)}
                                                </p>
                                                <p>
                                                    Gửi ngày{' '}
                                                    {new Date(
                                                        request.created_at,
                                                    ).toLocaleDateString(
                                                        'vi-VN',
                                                    )}
                                                </p>
                                            </div>
                                            <div className="store-account-order-total">
                                                {request.total > 0
                                                    ? vnd(request.total)
                                                    : 'Chờ báo giá'}
                                                <br />
                                                <Link
                                                    href={
                                                        '/service-orders/' +
                                                        request.public_id
                                                    }
                                                >
                                                    Xem chi tiết
                                                    <span className="store-sr-only">
                                                        {' '}
                                                        yêu cầu {request.code}
                                                    </span>
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            <p className="store-hint">
                                <Link href="/services">
                                    Gửi yêu cầu đan dây mới
                                </Link>
                            </p>
                        </section>
                    )}

                    {coupons.length > 0 && (
                        <section aria-labelledby="ma-giam-gia">
                            <h2 id="ma-giam-gia">Mã giảm giá của tôi</h2>
                            <ul className="store-coupons">
                                {coupons.map((coupon) => {
                                    const [label, tone] =
                                        couponStates[coupon.state];
                                    return (
                                        <li
                                            key={coupon.code}
                                            data-usable={
                                                coupon.state === 'usable'
                                            }
                                        >
                                            <div>
                                                <h3>
                                                    <code>{coupon.code}</code>
                                                    <span
                                                        className="store-status"
                                                        data-tone={tone}
                                                    >
                                                        {label}
                                                    </span>
                                                </h3>
                                                <p>{coupon.name}</p>
                                                <p>
                                                    {couponTerms(coupon)}
                                                    {coupon.state ===
                                                        'scheduled' &&
                                                        coupon.starts_at &&
                                                        ' · từ ngày ' +
                                                            new Date(
                                                                coupon.starts_at,
                                                            ).toLocaleDateString(
                                                                'vi-VN',
                                                            )}
                                                    {coupon.expires_at &&
                                                        ' · đến hết ' +
                                                            new Date(
                                                                coupon.expires_at,
                                                            ).toLocaleDateString(
                                                                'vi-VN',
                                                            )}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <p className="store-hint">
                                Nhập mã ở giỏ hàng khi đã đăng nhập bằng tài
                                khoản này.
                            </p>
                        </section>
                    )}

                    <section aria-labelledby="yeu-thich">
                        <h2 id="yeu-thich">Sản phẩm yêu thích</h2>
                        {wishlist.length ? (
                            <ul className="store-wishlist">
                                {wishlist.map((item) => (
                                    <li key={item.id}>
                                        <ProductImage
                                            src={item.image_url}
                                            name={item.name}
                                        />
                                        <div>
                                            {item.on_sale ? (
                                                <Link
                                                    href={
                                                        '/products/' + item.slug
                                                    }
                                                >
                                                    {item.name}
                                                </Link>
                                            ) : (
                                                <span>{item.name}</span>
                                            )}
                                            <p>
                                                {!item.on_sale
                                                    ? 'Cửa hàng đã ngừng bán'
                                                    : (item.price === null
                                                          ? 'Chưa có giá'
                                                          : 'Từ ' +
                                                            vnd(item.price)) +
                                                      ' · ' +
                                                      (item.in_stock
                                                          ? 'Còn hàng'
                                                          : 'Hết hàng')}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="store-remove"
                                            disabled={removing !== null}
                                            onClick={() => unsave(item.slug)}
                                        >
                                            Bỏ lưu
                                            <span className="store-sr-only">
                                                {' '}
                                                {item.name}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="store-account-empty">
                                <p>
                                    Chưa lưu sản phẩm nào. Bấm “Lưu vào yêu
                                    thích” ở trang sản phẩm để xem lại ở đây.
                                </p>
                            </div>
                        )}
                    </section>

                    {conversations.length > 0 && (
                        <section aria-labelledby="ho-tro">
                            <h2 id="ho-tro">Lịch sử hỗ trợ</h2>
                            <ul className="store-history">
                                {conversations.map((conversation) => (
                                    <Conversation
                                        key={conversation.id}
                                        conversation={conversation}
                                    />
                                ))}
                            </ul>
                            <p className="store-hint">
                                Các cuộc trò chuyện với cửa hàng khi bạn đã đăng
                                nhập. Cần hỗ trợ thêm, mở khung chat ở góc màn
                                hình.
                            </p>
                        </section>
                    )}
                </div>

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
                        <label className="store-check store-account-marketing">
                            <input
                                type="checkbox"
                                checked={account.marketing}
                                disabled={switching}
                                onChange={(event) => {
                                    setSwitching(true);
                                    router.patch(
                                        '/account/marketing',
                                        { opt_in: event.target.checked },
                                        {
                                            preserveScroll: true,
                                            onFinish: () => setSwitching(false),
                                        },
                                    );
                                }}
                            />
                            <span>
                                Nhận email ưu đãi của cửa hàng: mã giảm giá,
                                nhắc giỏ hàng, mời đánh giá. Email về đơn hàng
                                và tài khoản luôn được gửi.
                            </span>
                        </label>
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

                    {/* A staff account is taken out of the staff by an admin first. */}
                    {!account.is_admin && (
                        <section
                            className="store-account-card"
                            aria-labelledby="xoa-tai-khoan"
                        >
                            <h2 id="xoa-tai-khoan">Xóa tài khoản</h2>
                            <p className="store-hint store-account-delete-note">
                                Xóa hẳn tài khoản cùng lịch sử xem hàng, sản
                                phẩm yêu thích, đánh giá, lịch sử hỗ trợ và mã
                                giảm giá riêng của bạn. Đơn hàng đã đặt vẫn được
                                cửa hàng giữ làm chứng từ, không còn gắn với tài
                                khoản. Không hoàn tác được.
                            </p>
                            {closing ? (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        removal.delete('/account', {
                                            preserveScroll: true,
                                            onError: () =>
                                                removal.reset('password'),
                                        });
                                    }}
                                >
                                    <div className="store-field">
                                        <label htmlFor="delete_password">
                                            Nhập mật khẩu để xác nhận
                                        </label>
                                        <input
                                            id="delete_password"
                                            type="password"
                                            required
                                            autoComplete="current-password"
                                            value={removal.data.password}
                                            onChange={(event) =>
                                                removal.setData(
                                                    'password',
                                                    event.target.value,
                                                )
                                            }
                                            aria-invalid={
                                                !!removal.errors.password
                                            }
                                        />
                                        <FieldError
                                            message={removal.errors.password}
                                        />
                                    </div>
                                    <div className="store-account-delete-actions">
                                        <button
                                            className="store-button store-button-danger"
                                            disabled={removal.processing}
                                        >
                                            {removal.processing
                                                ? 'Đang xóa…'
                                                : 'Xóa tài khoản vĩnh viễn'}
                                        </button>
                                        <button
                                            type="button"
                                            className="store-button store-button-secondary"
                                            disabled={removal.processing}
                                            onClick={() => {
                                                removal.reset();
                                                removal.clearErrors();
                                                setClosing(false);
                                            }}
                                        >
                                            Giữ tài khoản
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    className="store-button store-button-secondary"
                                    onClick={() => setClosing(true)}
                                >
                                    Xóa tài khoản…
                                </button>
                            )}
                        </section>
                    )}
                </aside>
            </div>
        </div>
    );
}
