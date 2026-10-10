'use client';

import { Head, Link } from '@/lib/page';
import type { ReactNode } from 'react';
import {
    ChatStatus,
    CouponState,
    couponTerms,
    date,
    dateTime,
    money,
    OrderTable,
    PageHeader,
    Pages,
    query,
    ReviewStatus,
    SegmentBadge,
    serviceLine,
    ServiceStatus,
    staffRoles,
    Stars,
    Tabs,
} from './shared';
import type {
    ChatSummary,
    CouponStateName,
    CouponTerms,
    Order,
    Pagination,
    ReviewState,
    ServiceSummary,
} from './shared';

type Customer = {
    id: number;
    name: string;
    email: string;
    verified: boolean;
    is_admin: boolean;
    /** What a staff account may do; null for a customer. */
    staff_role: string | null;
    /** The group the customer is in right now; null for staff. */
    segment: string | null;
    joined: string;
};
type Overview = {
    orders: number;
    open: number;
    cancelled: number;
    ordered: number;
    spent: number;
    average: number;
    first_order_at: string | null;
    last_order_at: string | null;
};
type Named = { id: number; name: string };
type Entry = {
    type: string;
    at: string;
    key: string;
    product?: Named | null;
    order?: { id: number; total: number; is_demo: boolean };
    data?: Record<string, number | string | boolean> | null;
};
type Timeline = {
    entries: Entry[];
    next: { before: string; skip: number } | null;
};
type Products = {
    purchased: {
        id: number | null;
        name: string;
        units: number;
        spent: number;
        last_at: string | null;
    }[];
    brands: { name: string; units: number }[];
    categories: { name: string; units: number }[];
    viewed: (Named & { views: number; last_at: string | null })[];
    wishlist: (Named & { added_at: string | null })[];
};
type Review = {
    id: number;
    rating: number;
    body: string | null;
    status: ReviewState;
    created_at: string;
    product: Named & { slug: string };
};
type Coupons = {
    personal: (CouponTerms & {
        id: number;
        code: string;
        name: string;
        campaign: string | null;
        expires_at: string | null;
        state: CouponStateName;
    })[];
    used: {
        id: number;
        code: string;
        amount: number;
        at: string | null;
        order: { id: number; total: number };
    }[];
};
type Tab =
    | 'overview'
    | 'orders'
    | 'timeline'
    | 'products'
    | 'coupons'
    | 'services'
    | 'conversations'
    | 'reviews';

const tabs: [Tab, string][] = [
    ['overview', 'Tổng quan'],
    ['orders', 'Đơn hàng'],
    ['timeline', 'Hoạt động'],
    ['products', 'Sản phẩm'],
    ['coupons', 'Mã giảm giá'],
    ['services', 'Đan dây'],
    ['conversations', 'Hội thoại'],
    ['reviews', 'Đánh giá'],
];

function ProductName({ product }: { product?: Named | null }) {
    return product ? (
        <Link href={'/admin/products/' + product.id + '/edit'}>
            {product.name}
        </Link>
    ) : (
        <>một sản phẩm đã xóa</>
    );
}

function OrderLink({ order }: { order?: Entry['order'] }) {
    return order ? (
        <Link href={'/admin/orders/' + order.id}>đơn #{order.id}</Link>
    ) : (
        <>một đơn hàng</>
    );
}

/** One line of the timeline, in the shop's own words. */
function describe(entry: Entry): ReactNode {
    const { data, product, order } = entry;
    const item = <ProductName product={product} />;
    const link = <OrderLink order={order} />;
    switch (entry.type) {
        case 'register':
            return 'Tạo tài khoản';
        case 'product_view':
            return <>Xem {item}</>;
        case 'search':
            return (
                <>
                    Tìm “{data?.q}”
                    {typeof data?.results === 'number' &&
                        ' · ' + data.results + ' kết quả'}
                </>
            );
        case 'add_to_cart':
            return (
                <>
                    Thêm vào giỏ {item}
                    {typeof data?.quantity === 'number' &&
                        ' × ' + data.quantity}
                </>
            );
        case 'remove_from_cart':
            return <>Bỏ khỏi giỏ {item}</>;
        case 'checkout_started':
            return (
                <>
                    Mở trang thanh toán
                    {typeof data?.subtotal === 'number' &&
                        ' · giỏ ' + money(data.subtotal)}
                </>
            );
        case 'wishlist_added':
            return <>Lưu vào yêu thích {item}</>;
        case 'coupon_applied':
            return <>Nhập mã {data?.code} vào giỏ</>;
        case 'coupon_used':
            return (
                <>
                    Dùng mã {data?.code} cho {link}
                    {typeof data?.amount === 'number' &&
                        ' · giảm ' + money(data.amount)}
                </>
            );
        case 'chat_started':
            return 'Bắt đầu chat với cửa hàng';
        case 'order_placed':
            return (
                <>
                    Đặt {link}
                    {order && ' · ' + money(order.total)}
                    {order?.is_demo && ' · đơn mẫu'}
                </>
            );
        case 'order_confirmed':
            return <>Cửa hàng xác nhận {link}</>;
        case 'order_shipped':
            return <>Giao {link} cho đơn vị vận chuyển</>;
        case 'order_delivered':
            return <>Khách nhận {link}</>;
        case 'order_cancelled':
            return <>Hủy {link}</>;
        case 'order_paid':
            return (
                <>
                    Thu tiền {link}
                    {order && ' · ' + money(order.total)}
                </>
            );
        case 'review':
            return (
                <>
                    Đánh giá {item}
                    {typeof data?.rating === 'number' &&
                        ' · ' + data.rating + '/5 sao'}
                </>
            );
        default:
            return entry.type;
    }
}

/** Orders, the account and reviews are facts of record; the rest is browsing. */
const kind = (type: string) =>
    type.startsWith('order_') || type === 'coupon_used'
        ? 'order'
        : type === 'register' || type === 'review'
          ? 'account'
          : 'browse';

function TimelineList({ entries }: { entries: Entry[] }) {
    return (
        <ol className="admin-timeline">
            {entries.map((entry) => (
                <li key={entry.key} data-kind={kind(entry.type)}>
                    <time dateTime={entry.at}>{dateTime(entry.at)}</time>
                    <span>{describe(entry)}</span>
                </li>
            ))}
        </ol>
    );
}

export default function CustomerDetail({
    customer,
    overview,
    tab,
    demo,
    recentOrders,
    orders,
    timeline,
    products,
    coupons,
    services,
    conversations,
    reviews,
}: {
    customer: Customer;
    overview: Overview;
    tab: Tab;
    demo: boolean;
    recentOrders: Order[] | null;
    orders: Pagination<Order> | null;
    timeline: Timeline | null;
    products: Products | null;
    coupons: Coupons | null;
    services: ServiceSummary[] | null;
    conversations: ChatSummary[] | null;
    reviews: Review[] | null;
}) {
    const base = '/admin/customers/' + customer.id;
    const to = (value: Tab, more: Record<string, string> = {}) =>
        query(base, { tab: value === 'overview' ? '' : value, ...more });

    return (
        <>
            <Head title={customer.name} />
            <PageHeader
                back={{ href: '/admin/customers', label: 'Khách hàng' }}
                title={
                    <>
                        {customer.name}{' '}
                        <SegmentBadge segment={customer.segment} />{' '}
                        {customer.is_admin ? (
                            <span className="admin-badge" data-tone="accent">
                                {staffRoles[customer.staff_role ?? 'admin'] ??
                                    'Nhân viên'}
                            </span>
                        ) : (
                            !customer.verified && (
                                <span
                                    className="admin-badge"
                                    data-tone="warning"
                                >
                                    Chưa xác minh email
                                </span>
                            )
                        )}
                    </>
                }
                description={
                    <>
                        <a href={'mailto:' + customer.email}>
                            {customer.email}
                        </a>{' '}
                        · Tham gia {date(customer.joined)}
                    </>
                }
                actions={
                    <Link
                        href={query('/admin/emails', { q: customer.email })}
                        className="admin-button admin-button-secondary"
                    >
                        Email đã gửi
                    </Link>
                }
            />
            {demo && (
                <p className="admin-notice" role="status">
                    Số liệu dưới đây gồm cả đơn mẫu, vì đây là máy thử. Trên máy
                    chủ thật chỉ tính đơn thật.
                </p>
            )}

            <dl className="admin-metrics" data-layout="4">
                <div>
                    <dt>Đã thu</dt>
                    <dd>
                        {money(overview.spent)}
                        <small>đã đặt {money(overview.ordered)}</small>
                    </dd>
                </div>
                <div>
                    <dt>Đơn hàng</dt>
                    <dd>
                        {overview.orders}
                        <small>
                            {overview.open} đang xử lý · {overview.cancelled} đã
                            hủy
                        </small>
                    </dd>
                </div>
                <div>
                    <dt>Giá trị đơn trung bình</dt>
                    <dd>
                        {overview.orders ? money(overview.average) : '—'}
                        <small>không tính đơn đã hủy</small>
                    </dd>
                </div>
                <div>
                    <dt>Lần mua gần nhất</dt>
                    <dd>
                        {date(overview.last_order_at)}
                        <small>
                            {overview.first_order_at
                                ? 'đơn đầu tiên ' +
                                  date(overview.first_order_at)
                                : 'chưa đặt đơn nào'}
                        </small>
                    </dd>
                </div>
            </dl>

            <Tabs
                label="Thông tin khách hàng"
                items={tabs.map(([value, label]) => ({
                    href: to(value),
                    label,
                    current: tab === value,
                }))}
            />

            {tab === 'overview' && (
                <div className="admin-grid-main">
                    <section aria-labelledby="recent-orders">
                        <div className="admin-section-heading">
                            <h2 id="recent-orders">Đơn hàng gần đây</h2>
                            {(recentOrders?.length ?? 0) > 0 && (
                                <Link href={to('orders')}>Tất cả đơn</Link>
                            )}
                        </div>
                        <OrderTable
                            orders={recentOrders ?? []}
                            empty={
                                <>
                                    <strong>Chưa có đơn hàng.</strong>
                                    Đơn khách đặt khi đã đăng nhập sẽ hiện ở
                                    đây.
                                </>
                            }
                        />
                    </section>
                    <section
                        className="admin-panel"
                        aria-labelledby="recent-activity"
                    >
                        <div className="admin-section-heading">
                            <h2 id="recent-activity">Hoạt động gần đây</h2>
                            {timeline?.next && (
                                <Link href={to('timeline')}>Xem tất cả</Link>
                            )}
                        </div>
                        <TimelineList entries={timeline?.entries ?? []} />
                    </section>
                </div>
            )}

            {tab === 'orders' && orders && (
                <>
                    <OrderTable
                        orders={orders.data}
                        empty={
                            <>
                                <strong>Chưa có đơn hàng.</strong>
                                Đơn khách đặt khi đã đăng nhập sẽ hiện ở đây.
                            </>
                        }
                    />
                    <Pages page={orders} noun="đơn hàng" />
                </>
            )}

            {tab === 'timeline' && timeline && (
                <section className="admin-panel" aria-label="Hoạt động">
                    <TimelineList entries={timeline.entries} />
                    {timeline.next && (
                        <p className="admin-timeline-more">
                            <Link
                                href={to('timeline', {
                                    before: timeline.next.before,
                                    skip: String(timeline.next.skip),
                                })}
                            >
                                Hoạt động cũ hơn
                            </Link>
                        </p>
                    )}
                </section>
            )}

            {tab === 'products' && products && (
                <div className="admin-two-columns">
                    <section
                        className="admin-panel"
                        aria-labelledby="bought-title"
                    >
                        <h2 id="bought-title">Đã mua</h2>
                        {products.purchased.length ? (
                            <ul className="admin-low-stock">
                                {products.purchased.map((item) => (
                                    <li key={item.id ?? item.name}>
                                        <span>
                                            {item.id ? (
                                                <ProductName
                                                    product={{
                                                        id: item.id,
                                                        name: item.name,
                                                    }}
                                                />
                                            ) : (
                                                item.name
                                            )}
                                            <small className="admin-muted">
                                                Lần gần nhất{' '}
                                                {date(item.last_at)}
                                            </small>
                                        </span>
                                        <span className="admin-nowrap">
                                            {item.units} cái ·{' '}
                                            {money(item.spent)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="admin-muted">
                                Chưa mua sản phẩm nào.
                            </p>
                        )}
                        {(products.brands.length > 0 ||
                            products.categories.length > 0) && (
                            <p className="admin-list-note">
                                {products.brands.length > 0 && (
                                    <>
                                        Hãng thường mua:{' '}
                                        {products.brands
                                            .map(
                                                (brand) =>
                                                    brand.name +
                                                    ' (' +
                                                    brand.units +
                                                    ')',
                                            )
                                            .join(', ')}
                                        .{' '}
                                    </>
                                )}
                                {products.categories.length > 0 && (
                                    <>
                                        Danh mục thường mua:{' '}
                                        {products.categories
                                            .map(
                                                (category) =>
                                                    category.name +
                                                    ' (' +
                                                    category.units +
                                                    ')',
                                            )
                                            .join(', ')}
                                        .
                                    </>
                                )}
                            </p>
                        )}
                    </section>
                    <div>
                        <section
                            className="admin-panel"
                            aria-labelledby="viewed-title"
                        >
                            <h2 id="viewed-title">Đã xem gần đây</h2>
                            {products.viewed.length ? (
                                <ul className="admin-low-stock">
                                    {products.viewed.map((item) => (
                                        <li key={item.id}>
                                            <span>
                                                <ProductName product={item} />
                                                <small className="admin-muted">
                                                    Lần gần nhất{' '}
                                                    {date(item.last_at)}
                                                </small>
                                            </span>
                                            <span className="admin-nowrap">
                                                {item.views} lần
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="admin-muted">
                                    Chưa ghi nhận lượt xem nào khi khách đã đăng
                                    nhập.
                                </p>
                            )}
                        </section>
                        <section
                            className="admin-panel"
                            aria-labelledby="saved-title"
                        >
                            <h2 id="saved-title">Yêu thích</h2>
                            {products.wishlist.length ? (
                                <ul className="admin-low-stock">
                                    {products.wishlist.map((item) => (
                                        <li key={item.id}>
                                            <ProductName product={item} />
                                            <span className="admin-nowrap admin-muted">
                                                {date(item.added_at)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="admin-muted">
                                    Chưa lưu sản phẩm nào.
                                </p>
                            )}
                        </section>
                    </div>
                </div>
            )}

            {tab === 'coupons' && coupons && (
                <div className="admin-two-columns">
                    <section
                        className="admin-panel"
                        aria-labelledby="personal-coupons"
                    >
                        <div className="admin-section-heading">
                            <h2 id="personal-coupons">Mã riêng của khách</h2>
                            {!customer.is_admin && (
                                <Link
                                    href={
                                        '/admin/coupons/create?customer=' +
                                        customer.id
                                    }
                                >
                                    Tạo mã riêng
                                </Link>
                            )}
                        </div>
                        {coupons.personal.length ? (
                            <ul className="admin-low-stock">
                                {coupons.personal.map((coupon) => (
                                    <li key={coupon.id}>
                                        <span>
                                            <Link
                                                href={
                                                    '/admin/coupons/' +
                                                    coupon.id +
                                                    '/edit'
                                                }
                                            >
                                                {coupon.code}
                                            </Link>
                                            <small className="admin-muted">
                                                {couponTerms(coupon)}
                                                {coupon.expires_at &&
                                                    ' · hết hạn ' +
                                                        date(coupon.expires_at)}
                                            </small>
                                        </span>
                                        <CouponState state={coupon.state} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="admin-muted">
                                Chưa có mã nào tạo riêng cho khách này.
                            </p>
                        )}
                    </section>
                    <section
                        className="admin-panel"
                        aria-labelledby="used-coupons"
                    >
                        <h2 id="used-coupons">Mã đã dùng</h2>
                        {coupons.used.length ? (
                            <ul className="admin-low-stock">
                                {coupons.used.map((use) => (
                                    <li key={use.id}>
                                        <span>
                                            {use.code}
                                            <small className="admin-muted">
                                                <Link
                                                    href={
                                                        '/admin/orders/' +
                                                        use.order.id
                                                    }
                                                >
                                                    Đơn #{use.order.id}
                                                </Link>{' '}
                                                · {date(use.at)}
                                            </small>
                                        </span>
                                        <span className="admin-nowrap">
                                            −{money(use.amount)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="admin-muted">
                                Khách chưa dùng mã giảm giá nào khi đã đăng
                                nhập.
                            </p>
                        )}
                    </section>
                </div>
            )}

            {tab === 'services' &&
                services &&
                (services.length ? (
                    <section
                        className="admin-panel"
                        aria-label="Yêu cầu đan dây của khách"
                    >
                        <ul className="admin-low-stock">
                            {services.map((request) => (
                                <li key={request.id}>
                                    <span>
                                        <Link
                                            href={
                                                '/admin/service-orders/' +
                                                request.id
                                            }
                                        >
                                            #{request.id} ·{' '}
                                            {serviceLine(request)}
                                        </Link>
                                        <small className="admin-muted">
                                            {dateTime(request.created_at)}
                                            {request.total > 0 &&
                                                ' · ' + money(request.total)}
                                        </small>
                                    </span>
                                    <ServiceStatus status={request.status} />
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : (
                    <div className="admin-empty">
                        <strong>Chưa gửi yêu cầu đan dây nào.</strong>
                        Yêu cầu khách gửi khi đã đăng nhập sẽ hiện ở đây.
                    </div>
                ))}

            {tab === 'conversations' &&
                conversations &&
                (conversations.length ? (
                    <section
                        className="admin-panel"
                        aria-label="Các cuộc trò chuyện với cửa hàng"
                    >
                        <ul className="admin-low-stock">
                            {conversations.map((conversation) => (
                                <li key={conversation.id}>
                                    <span>
                                        <Link
                                            href={
                                                '/admin/support-chat?status=all&conversation=' +
                                                conversation.id
                                            }
                                        >
                                            {conversation.excerpt ||
                                                'Không có nội dung'}
                                        </Link>
                                        <small className="admin-muted">
                                            {dateTime(conversation.started_at)}{' '}
                                            · {conversation.messages} tin nhắn
                                            {conversation.needs_human
                                                ? conversation.assigned_name
                                                    ? ' · ' +
                                                      conversation.assigned_name +
                                                      ' tiếp nhận'
                                                    : ' · chưa ai nhận'
                                                : ' · chỉ trợ lý tự động trả lời'}
                                        </small>
                                    </span>
                                    <ChatStatus status={conversation.status} />
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : (
                    <div className="admin-empty">
                        <strong>Chưa có cuộc trò chuyện nào.</strong>
                        Những gì khách nhắn ở khung chat khi đã đăng nhập sẽ
                        hiện ở đây.
                    </div>
                ))}

            {tab === 'reviews' &&
                reviews &&
                (reviews.length ? (
                    <ul className="admin-reviews">
                        {reviews.map((review) => (
                            <li key={review.id} className="admin-panel">
                                <div className="admin-review-head">
                                    <Stars rating={review.rating} />
                                    <ReviewStatus status={review.status} />
                                    <span className="admin-muted">
                                        {dateTime(review.created_at)}
                                    </span>
                                </div>
                                <p className="admin-review-about">
                                    <Link
                                        href={
                                            '/products/' + review.product.slug
                                        }
                                    >
                                        {review.product.name}
                                    </Link>
                                </p>
                                {review.body ? (
                                    <p className="admin-review-body">
                                        {review.body}
                                    </p>
                                ) : (
                                    <p className="admin-muted">
                                        Chỉ chấm sao, không viết lời bình.
                                    </p>
                                )}
                                {review.status === 'pending' && (
                                    <p className="admin-review-actions">
                                        <Link href="/admin/reviews">
                                            Duyệt ở mục Đánh giá
                                        </Link>
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="admin-empty">
                        <strong>Chưa viết đánh giá nào.</strong>
                        Khách đánh giá được sản phẩm sau khi đơn đã giao.
                    </div>
                ))}
        </>
    );
}
