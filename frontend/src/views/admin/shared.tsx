'use client';

import { Link } from '@/lib/page';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export type Taxonomy = { id: number; name: string; slug: string };
export type Variant = {
    id: number;
    sku: string;
    name: string;
    price: number;
    compare_at_price?: number | null;
    cost_price?: number | null;
    stock: number;
    is_active: boolean;
};
export type Product = {
    id: number;
    name: string;
    slug: string;
    description: string;
    image_url: string;
    /** Photos besides the main one (the product form only). */
    images?: { id: number; url: string | null }[];
    brand_id: number | null;
    category_id: number | null;
    brand?: Taxonomy | null;
    category?: Taxonomy | null;
    play_style: string;
    skill_level: string;
    specs: Record<string, string> | null;
    is_active: boolean;
    is_featured: boolean;
    is_demo: boolean;
    variants: Variant[];
};
export type Order = {
    id: number;
    public_id: string;
    name: string;
    phone: string;
    address: string;
    email: string | null;
    notes: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    subtotal: number;
    shipping_fee: number;
    /** What a coupon took off; total = subtotal - discount_total + shipping_fee. */
    discount_total?: number;
    coupon_code?: string | null;
    total: number;
    is_demo: boolean;
    created_at: string;
    updated_at?: string;
    items_count?: number;
    user?: { id: number; name: string; email: string } | null;
    items: {
        id: number;
        product_id?: number | null;
        product_name: string;
        variant_name: string;
        sku: string;
        unit_price: number;
        quantity: number;
        line_total: number;
    }[];
};
export type Pagination<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
    links?: { url: string | null; label: string; active: boolean }[];
};
export const money = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
/** Gross margin on a sale price, or null while the cost is unknown. */
export const margin = (price: number, cost: number | null | undefined) =>
    cost === null || cost === undefined || cost === 0 || price <= 0
        ? null
        : { profit: price - cost, rate: ((price - cost) / price) * 100 };
export const date = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString('vi-VN') : '—';
export const dateTime = (value: string | null | undefined) =>
    value
        ? new Date(value).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
          })
        : '—';
export const statuses: Record<string, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
};
const statusTone: Record<string, string> = {
    pending: 'warning',
    confirmed: 'accent',
    shipped: 'info',
    delivered: 'success',
    cancelled: 'danger',
};
export const styles: Record<string, string> = {
    attack: 'Tấn công',
    speed: 'Tốc độ',
    balanced: 'Cân bằng',
};

export function PageHeader({
    title,
    description,
    back,
    actions,
}: {
    title: ReactNode;
    description?: ReactNode;
    back?: { href: string; label: string };
    actions?: ReactNode;
}) {
    return (
        <div className="admin-heading">
            <div>
                {back && (
                    <Link href={back.href} className="admin-back">
                        <ChevronLeft aria-hidden="true" />
                        {back.label}
                    </Link>
                )}
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
            {actions && <div className="admin-heading-actions">{actions}</div>}
        </div>
    );
}

export function OrderStatus({ status }: { status: string }) {
    return (
        <span className="admin-badge" data-tone={statusTone[status]}>
            {statuses[status] ?? status}
        </span>
    );
}

/**
 * How an order's money stands. With the order, an unpaid bank transfer reads as what the shop
 * is waiting for, not as cash to collect.
 */
export function PaymentStatus({
    status,
    order,
}: {
    status: string;
    order?: { payment_method: string; status: string };
}) {
    if (status === 'paid')
        return (
            <span className="admin-badge" data-tone="success">
                Đã thu tiền
            </span>
        );
    if (status === 'refunded')
        return <span className="admin-badge">Đã hoàn tiền</span>;
    return order?.payment_method === 'bank_transfer' &&
        order.status === 'pending' ? (
        <span className="admin-badge" data-tone="warning">
            Chờ chuyển khoản
        </span>
    ) : (
        <span className="admin-badge">Chưa thu</span>
    );
}

/** Customer groups (App\Services\CustomerSegmentation), in the order a customer moves through them. */
export const segments: Record<string, [string, string | undefined]> = {
    new: ['Mới', 'info'],
    potential: ['Tiềm năng', 'accent'],
    active: ['Đang mua', 'success'],
    vip: ['VIP', 'warning'],
    inactive: ['Không hoạt động', undefined],
    lost: ['Đã mất', 'danger'],
};

export function SegmentBadge({ segment }: { segment: string | null }) {
    if (!segment) return null;
    const [label, tone] = segments[segment] ?? [segment, undefined];
    return (
        <span className="admin-badge" data-tone={tone}>
            {label}
        </span>
    );
}

export type CouponTerms = {
    type: 'percent' | 'fixed';
    value: number;
    max_discount: number | null;
    min_order: number;
};
/** What a coupon takes off, in a line: "Giảm 10%, tối đa 100.000 ₫ · đơn từ 500.000 ₫". */
export const couponTerms = (coupon: CouponTerms) =>
    (coupon.type === 'percent'
        ? 'Giảm ' +
          coupon.value +
          '%' +
          (coupon.max_discount ? ', tối đa ' + money(coupon.max_discount) : '')
        : 'Giảm ' + money(coupon.value)) +
    (coupon.min_order > 0 ? ' · đơn từ ' + money(coupon.min_order) : '');

export type CouponStateName =
    | 'active'
    | 'scheduled'
    | 'expired'
    | 'used_up'
    | 'off';
const couponStates: Record<CouponStateName, [string, string | undefined]> = {
    active: ['Đang chạy', 'success'],
    scheduled: ['Sắp chạy', 'info'],
    expired: ['Hết hạn', undefined],
    used_up: ['Hết lượt', undefined],
    off: ['Đã tắt', 'danger'],
};

export function CouponState({ state }: { state: CouponStateName }) {
    const [label, tone] = couponStates[state] ?? [state, undefined];
    return (
        <span className="admin-badge" data-tone={tone}>
            {label}
        </span>
    );
}

/** What each email is, by its type in the email log (App\Services\EmailService::TYPES). */
export const emailTypes: Record<string, string> = {
    welcome: 'Chào mừng',
    verify_email: 'Xác minh email',
    reset_password: 'Đặt lại mật khẩu',
    order_placed: 'Đã nhận đơn',
    order_paid: 'Đã nhận thanh toán',
    order_shipped: 'Đơn đang giao',
    order_delivered: 'Đơn đã giao',
    order_cancelled: 'Đơn đã hủy',
    coupon: 'Tặng mã giảm giá',
    service_placed: 'Đã nhận yêu cầu đan dây',
    service_ready: 'Vợt đã đan xong',
    service_cancelled: 'Hủy yêu cầu đan dây',
    abandoned_cart: 'Nhắc giỏ hàng',
    winback: 'Mời khách quay lại',
    post_purchase: 'Mời đánh giá',
    vip: 'Cảm ơn khách VIP',
};

/** Where a stringing request stands (App\Services\StringingService::STATUSES), as staff say it. */
export type ServiceState =
    | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'ready'
    | 'completed'
    | 'cancelled';
export const serviceStates: Record<ServiceState, [string, string | undefined]> =
    {
        pending: ['Chờ xác nhận', 'warning'],
        confirmed: ['Đã hẹn', 'accent'],
        in_progress: ['Đang đan', 'info'],
        ready: ['Chờ khách lấy', 'success'],
        completed: ['Đã trả vợt', undefined],
        cancelled: ['Đã hủy', 'danger'],
    };

export function ServiceStatus({ status }: { status: ServiceState }) {
    const [label, tone] = serviceStates[status] ?? [status, undefined];
    return (
        <span className="admin-badge" data-tone={tone}>
            {label}
        </span>
    );
}

/** A stringing request in a list (App\Services\StringingService::summary). */
export type ServiceSummary = {
    id: number;
    public_id: string;
    /** The short code the customer reads out at the counter. */
    code: string;
    status: ServiceState;
    racket: string;
    string_name: string | null;
    service_type: 'shop_string' | 'own_string';
    tension_kg: number;
    quantity: number;
    total: number;
    created_at: string;
};

/** The racket, the string and the tension of a request, in one line. */
export const serviceLine = (
    order: Pick<
        ServiceSummary,
        'racket' | 'quantity' | 'string_name' | 'service_type' | 'tension_kg'
    >,
) =>
    order.racket +
    (order.quantity > 1 ? ' × ' + order.quantity : '') +
    ' · ' +
    (order.service_type === 'own_string'
        ? 'dây khách mang tới' +
          (order.string_name ? ' (' + order.string_name + ')' : '')
        : (order.string_name ?? 'dây của shop')) +
    ' · ' +
    order.tension_kg.toLocaleString('vi-VN') +
    ' kg';

/** Staff roles (App\Models\User::ROLES), as the admin names them. */
export const staffRoles: Record<string, string> = {
    admin: 'Quản trị viên',
    staff: 'Nhân viên bán hàng',
    support: 'Nhân viên hỗ trợ',
};

/** Where a support conversation stands (App\Services\SupportChat::STATUSES). */
export type ChatState = 'open' | 'pending' | 'resolved' | 'closed';
const chatStates: Record<ChatState, [string, string | undefined]> = {
    open: ['Chờ shop trả lời', 'warning'],
    pending: ['Chờ khách', 'info'],
    resolved: ['Đã giải quyết', 'success'],
    closed: ['Đã đóng', undefined],
};

export function ChatStatus({ status }: { status: ChatState }) {
    const [label, tone] = chatStates[status] ?? [status, undefined];
    return (
        <span className="admin-badge" data-tone={tone}>
            {label}
        </span>
    );
}

/** One support conversation in a list: how it began and where it stands. */
export type ChatSummary = {
    id: number;
    status: ChatState;
    /** Handed to the staff; false while only the automatic assistant answered. */
    needs_human: boolean;
    started_at: string;
    last_message_at: string | null;
    excerpt: string;
    messages: number;
    assigned_name: string | null;
};

export type ReviewState = 'pending' | 'published' | 'hidden';
const reviewStates: Record<ReviewState, [string, string | undefined]> = {
    pending: ['Chờ duyệt', 'warning'],
    published: ['Đang hiện', 'success'],
    hidden: ['Đã ẩn', undefined],
};

export function ReviewStatus({ status }: { status: ReviewState }) {
    const [label, tone] = reviewStates[status] ?? [status, undefined];
    return (
        <span className="admin-badge" data-tone={tone}>
            {label}
        </span>
    );
}

/** A rating out of five, read out as one phrase. */
export function Stars({ rating }: { rating: number }) {
    return (
        <span
            className="admin-stars"
            role="img"
            aria-label={rating + ' trên 5 sao'}
        >
            {'★'.repeat(rating)}
            <span>{'★'.repeat(5 - rating)}</span>
        </span>
    );
}

export function ProductStatus({
    product,
}: {
    product: { is_active: boolean; is_demo: boolean };
}) {
    if (product.is_demo)
        return (
            <span className="admin-badge" data-tone="warning">
                {product.is_active ? 'Demo · đang hiện' : 'Demo · đã ẩn'}
            </span>
        );
    return product.is_active ? (
        <span className="admin-badge" data-tone="success">
            Đang bán
        </span>
    ) : (
        <span className="admin-badge">Đang ẩn</span>
    );
}

/** Status filters as links, so each view has its own URL and back/forward works. */
export function Tabs({
    label,
    items,
}: {
    label: string;
    items: { href: string; label: string; count?: number; current: boolean }[];
}) {
    return (
        <nav className="admin-tabs" aria-label={label}>
            {items.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    preserveScroll
                    aria-current={item.current ? 'page' : undefined}
                >
                    {item.label}
                    {item.count !== undefined && <span>{item.count}</span>}
                </Link>
            ))}
        </nav>
    );
}

/** Build a query string from filters, dropping empty values. */
export const query = (base: string, params: Record<string, string>) => {
    const search = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== ''),
    ).toString();
    return search ? base + '?' + search : base;
};

/** The demo switch as a query value: empty when it matches the page default, so links stay clean. */
export const demoParam = (on: boolean, byDefault: boolean) =>
    on === byDefault ? '' : on ? '1' : '0';

export function Field({
    name,
    label,
    error,
    children,
}: {
    name: string;
    label: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="admin-field">
            <label htmlFor={name}>{label}</label>
            {children}
            {error && (
                <p id={name + '-error'} className="admin-error">
                    {error}
                </p>
            )}
        </div>
    );
}
export function Errors({
    errors,
}: {
    errors: Record<string, string | undefined>;
}) {
    const messages = Object.entries(errors).filter(([, message]) => message);
    return messages.length ? (
        <div className="admin-error-summary" role="alert">
            <strong>Chưa lưu được. Kiểm tra thông tin:</strong>
            <ul>
                {messages.map(([name, message]) => (
                    <li key={name}>{message}</li>
                ))}
            </ul>
        </div>
    ) : null;
}
export function Pages<T>({
    page,
    noun = 'kết quả',
}: {
    page: Pagination<T>;
    noun?: string;
}) {
    if (page.total === 0) return null;
    // Laravel's links: [previous, 1, 2, …, next]; keep only the numbered pages and gaps.
    const numbers = (page.links ?? []).slice(1, -1);
    return (
        <nav className="admin-pagination" aria-label="Phân trang">
            <span>
                {page.from ?? 0}–{page.to ?? 0} trong {page.total} {noun}
            </span>
            {page.last_page > 1 && (
                <ol>
                    {page.prev_page_url && (
                        <li>
                            <Link href={page.prev_page_url} preserveScroll>
                                Trước
                            </Link>
                        </li>
                    )}
                    {numbers.map((link, index) => (
                        <li key={index}>
                            {link.url === null ? (
                                <span className="admin-gap">…</span>
                            ) : link.active ? (
                                <span aria-current="page">{link.label}</span>
                            ) : (
                                <Link
                                    href={link.url}
                                    aria-label={'Trang ' + link.label}
                                >
                                    {link.label}
                                </Link>
                            )}
                        </li>
                    ))}
                    {page.next_page_url && (
                        <li>
                            <Link href={page.next_page_url}>Sau</Link>
                        </li>
                    )}
                </ol>
            )}
        </nav>
    );
}
export function OrderTable({
    orders,
    empty,
}: {
    orders: Order[];
    empty?: ReactNode;
}) {
    return orders.length ? (
        <div
            className="admin-table-wrap"
            role="region"
            aria-label="Danh sách đơn hàng"
            tabIndex={0}
        >
            <table>
                <thead>
                    <tr>
                        <th scope="col">Đơn hàng</th>
                        <th scope="col">Khách hàng</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Thanh toán</th>
                        <th scope="col" className="admin-number">
                            Tổng tiền
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id}>
                            <th scope="row">
                                <Link href={'/admin/orders/' + order.id}>
                                    #{order.id}
                                </Link>
                                <small>
                                    {dateTime(order.created_at)}
                                    {order.items_count !== undefined &&
                                        ' · ' + order.items_count + ' sản phẩm'}
                                </small>
                            </th>
                            <td>
                                {order.name}
                                <small>
                                    {order.is_demo ? 'Đơn mẫu' : order.phone}
                                </small>
                            </td>
                            <td>
                                <OrderStatus status={order.status} />
                            </td>
                            <td>
                                <PaymentStatus
                                    status={order.payment_status}
                                    order={order}
                                />
                            </td>
                            <td className="admin-number">
                                {money(order.total)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    ) : (
        <div className="admin-empty">
            {empty ?? (
                <>
                    <strong>Chưa có đơn hàng.</strong>
                    Đơn khách đặt ở cửa hàng sẽ hiện ở đây, mới nhất ở trên.
                </>
            )}
        </div>
    );
}
