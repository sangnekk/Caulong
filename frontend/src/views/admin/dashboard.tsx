'use client';

import { Head, Link } from '@/lib/page';
import { ArrowRight, Check } from 'lucide-react';
import { demoParam, money, OrderTable, PageHeader, query } from './shared';
import type { Order } from './shared';

type Todo = {
    pending_orders: number;
    /** Placed, to be paid by bank transfer, and the money has not been confirmed. */
    awaiting_transfer: number;
    confirmed_orders: number;
    uncollected: number;
    low_stock: number;
    sold_out: number;
    stocked_hidden: number;
    demo_visible: number;
    /** Stringing requests the shop has not answered, and rackets strung and not collected. */
    service_pending: number;
    service_ready: number;
    /** Support tickets waiting for the shop's reply. */
    support_open: number;
    reviews_pending: number;
    /** Emails of the last seven days that could not be sent. */
    emails_failed: number;
};
type Stats = {
    today_sales: number;
    today_orders: number;
    week_sales: number;
    week_orders: number;
    week_profit: number;
    week_costed: number;
    week_collected: number;
    /** Paid at the stringing counter in the same seven days. */
    week_service: number;
    orders_open: number;
    products_active: number;
    products_in_stock: number;
    customers: number;
};
type LowStock = {
    product_id: number;
    product: string;
    variant: string;
    sku: string;
    stock: number;
}[];

const number = (value: number) => value.toLocaleString('vi-VN');

export default function Dashboard({
    figures,
    demo,
    demoDefault,
    todo,
    stats,
    lowStock,
    orders,
}: {
    /** Sales, profit and money collected are shown to admins; staff get the work and the stock. */
    figures: boolean;
    demo: boolean;
    demoDefault: boolean;
    todo: Todo;
    stats: Stats;
    lowStock: LowStock;
    orders: Order[];
}) {
    // Order and report links keep the demo switch, so their numbers match these.
    const withDemo = (base: string, params: Record<string, string> = {}) =>
        query(base, { ...params, demo: demoParam(demo, demoDefault) });
    const scope = demo
        ? 'Đang tính cả dữ liệu mẫu.'
        : 'Số liệu chỉ tính đơn và hàng thật, không tính dữ liệu mẫu.';
    // Each row: what needs doing, why it matters, and the one place that does it.
    const tasks = [
        {
            count: todo.pending_orders,
            title: 'đơn chờ xác nhận',
            done: 'Không có đơn chờ xác nhận',
            hint: 'Gọi khách xác nhận địa chỉ và giờ nhận trước khi giao.',
            href: withDemo('/admin/orders', { status: 'pending' }),
            action: 'Xử lý đơn',
        },
        {
            count: todo.awaiting_transfer,
            title: 'đơn chờ khách chuyển khoản',
            done: 'Không có đơn chờ chuyển khoản',
            hint: 'Kiểm tra tài khoản ngân hàng rồi xác nhận tiền đã về. Đơn quá hạn giữ hàng sẽ tự hủy.',
            href: withDemo('/admin/orders', { payment: 'transfer' }),
            action: 'Đối chiếu',
        },
        {
            count: todo.confirmed_orders,
            title: 'đơn đã xác nhận, chưa giao',
            done: 'Không có đơn chờ giao',
            hint: 'Đóng gói rồi chuyển sang “Đang giao”.',
            href: withDemo('/admin/orders', { status: 'confirmed' }),
            action: 'Xem đơn',
        },
        {
            count: todo.uncollected,
            title: 'đơn đã giao, chưa ghi nhận tiền COD',
            done: 'Tiền COD đã ghi nhận đủ',
            hint: 'Xác nhận khi đã thực nhận tiền từ đơn vị giao hàng.',
            href: withDemo('/admin/orders', {
                status: 'delivered',
                payment: 'unpaid',
            }),
            action: 'Ghi nhận',
        },
        {
            count: todo.service_pending,
            title: 'yêu cầu đan dây chờ xác nhận',
            done: 'Không có yêu cầu đan dây chờ xác nhận',
            hint: 'Gọi khách để hẹn lúc mang vợt tới.',
            href: '/admin/service-orders?status=pending',
            action: 'Xem yêu cầu',
        },
        {
            count: todo.service_ready,
            title: 'cây vợt đan xong chờ khách lấy',
            done: 'Không có vợt đan xong chờ khách lấy',
            hint: 'Khách tới lấy và trả tiền thì chuyển sang “Đã trả vợt”.',
            href: '/admin/service-orders?status=ready',
            action: 'Xem yêu cầu',
        },
        {
            count: todo.support_open,
            title: 'ticket hỗ trợ chờ shop trả lời',
            done: 'Không có ticket hỗ trợ chờ trả lời',
            hint: 'Khách đang chờ trong khung chat.',
            href: '/admin/support-chat?status=open',
            action: 'Trả lời',
        },
        {
            count: todo.reviews_pending,
            title: 'đánh giá chờ duyệt',
            done: 'Không có đánh giá chờ duyệt',
            hint: 'Đánh giá có lời bình chỉ hiện ở cửa hàng sau khi bạn đọc.',
            href: '/admin/reviews?status=pending',
            action: 'Duyệt',
        },
        {
            count: todo.emails_failed,
            title: 'email gửi lỗi trong 7 ngày qua',
            done: 'Không có email gửi lỗi trong 7 ngày qua',
            hint: 'Xem lý do; mã giảm giá riêng có thể gửi lại từ trang sửa mã.',
            href: '/admin/emails?status=failed',
            action: 'Xem nhật ký',
        },
        {
            count: todo.low_stock,
            title: 'phiên bản đang bán chỉ còn 1–5 cái',
            done: 'Không có phiên bản nào sắp hết (1–5 cái)',
            hint: 'Nhập thêm hoặc cập nhật tồn kho trước khi hết.',
            href: '/admin/products?status=active&stock=low',
            action: 'Xem hàng',
        },
        {
            count: todo.sold_out,
            title: 'sản phẩm đang bán nhưng hết hàng',
            done: 'Mọi sản phẩm đang bán đều còn hàng',
            hint: 'Khách thấy “Hết hàng” và không đặt được. Bấm vào tồn kho trong danh sách để sửa nhanh, hoặc nhập file.',
            href: '/admin/products?status=active&stock=out',
            action: 'Nhập tồn kho',
        },
        {
            count: todo.stocked_hidden,
            title: 'sản phẩm đã có tồn kho nhưng đang ẩn',
            done: 'Không có hàng có sẵn nào bị ẩn',
            hint: 'Kiểm tra lại rồi mở bán hàng loạt.',
            href: '/admin/imports',
            action: 'Mở bán',
        },
        {
            count: todo.demo_visible,
            title: 'sản phẩm demo đang hiện ở cửa hàng',
            done: 'Cửa hàng không hiện sản phẩm demo',
            hint: 'Ẩn đi khi hàng thật đã sẵn sàng.',
            href: '/admin/imports',
            action: 'Ẩn demo',
        },
    ];
    const open = tasks.filter((task) => task.count > 0).length;

    return (
        <>
            <Head title="Tổng quan quản trị" />
            <PageHeader
                title="Tổng quan"
                description={
                    (open
                        ? open + ' việc đang chờ. '
                        : 'Không có việc tồn đọng. ') + scope
                }
                actions={
                    <>
                        {figures && (
                            <Link
                                href={withDemo('/admin/reports')}
                                className="admin-button admin-button-secondary"
                            >
                                Báo cáo doanh thu
                            </Link>
                        )}
                        <Link
                            href="/admin/products/create"
                            className="admin-button"
                        >
                            Thêm sản phẩm
                        </Link>
                    </>
                }
            />

            {demo && (
                <p className="admin-notice" role="status">
                    Số liệu dưới đây gồm cả đơn và sản phẩm mẫu, không phải của
                    cửa hàng thật.{' '}
                    <Link
                        href={query('/admin', {
                            demo: demoParam(false, demoDefault),
                        })}
                    >
                        Chỉ xem số liệu thật
                    </Link>
                </p>
            )}

            <section aria-labelledby="stats-title">
                <h2 id="stats-title" className="sr-only">
                    Số liệu cửa hàng
                </h2>
                <dl className="admin-metrics" data-layout={figures ? '3' : '2'}>
                    {figures && (
                        <>
                            <div>
                                <dt>Doanh số hôm nay</dt>
                                <dd>
                                    {money(stats.today_sales)}
                                    <small>
                                        {number(stats.today_orders)} đơn
                                    </small>
                                </dd>
                            </div>
                            <div>
                                <dt>Doanh số 7 ngày</dt>
                                <dd>
                                    {money(stats.week_sales)}
                                    <small>
                                        {number(stats.week_orders)} đơn
                                    </small>
                                </dd>
                            </div>
                            <div>
                                <dt>Lãi gộp 7 ngày</dt>
                                <dd>
                                    {stats.week_costed > 0
                                        ? money(stats.week_profit)
                                        : '—'}
                                    <small>
                                        {stats.week_costed > 0
                                            ? 'biên ' +
                                              Math.round(
                                                  (stats.week_profit /
                                                      stats.week_costed) *
                                                      100,
                                              ) +
                                              '%'
                                            : 'cần giá nhập'}
                                    </small>
                                </dd>
                            </div>
                            <div>
                                <dt>Đã thu 7 ngày</dt>
                                <dd>
                                    {money(stats.week_collected)}
                                    <small>
                                        COD và chuyển khoản
                                        {stats.week_service > 0 &&
                                            ' · đan dây thu thêm ' +
                                                money(stats.week_service)}
                                    </small>
                                </dd>
                            </div>
                        </>
                    )}
                    <div>
                        <dt>Đơn đang xử lý</dt>
                        <dd>
                            {number(stats.orders_open)}
                            <small>chờ, đã xác nhận, đang giao</small>
                        </dd>
                    </div>
                    <div>
                        <dt>Đang bán</dt>
                        <dd>
                            {number(stats.products_active)}
                            <small>
                                {number(stats.products_in_stock)} còn hàng ·{' '}
                                {number(stats.customers)} khách
                            </small>
                        </dd>
                    </div>
                </dl>
            </section>

            <div className="admin-grid-main">
                <section className="admin-panel" aria-labelledby="todo-title">
                    <h2 id="todo-title">Cần xử lý</h2>
                    <ul className="admin-todo">
                        {tasks.map((task) => {
                            const done = task.count === 0;
                            return (
                                <li key={task.title} data-done={done}>
                                    <span className="admin-todo-count">
                                        {done ? (
                                            <Check aria-label="Xong" />
                                        ) : (
                                            number(task.count)
                                        )}
                                    </span>
                                    <span>
                                        <strong>
                                            {done
                                                ? task.done
                                                : number(task.count) +
                                                  ' ' +
                                                  task.title}
                                        </strong>
                                        {!done && <small>{task.hint}</small>}
                                    </span>
                                    {!done && (
                                        <Link href={task.href}>
                                            {task.action}
                                            <ArrowRight aria-hidden="true" />
                                        </Link>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section className="admin-panel" aria-labelledby="low-title">
                    <div className="admin-section-heading">
                        <h2 id="low-title">Sắp hết hàng</h2>
                        {lowStock.length > 0 && (
                            <Link href="/admin/products?status=active&stock=low">
                                Xem tất cả
                            </Link>
                        )}
                    </div>
                    {lowStock.length ? (
                        <ul className="admin-low-stock">
                            {lowStock.map((item) => (
                                <li key={item.sku}>
                                    <span>
                                        <Link
                                            href={
                                                '/admin/products/' +
                                                item.product_id +
                                                '/edit'
                                            }
                                        >
                                            {item.product}
                                        </Link>
                                        <small className="admin-muted">
                                            {item.variant} · {item.sku}
                                        </small>
                                    </span>
                                    <span
                                        className={
                                            item.stock === 0
                                                ? 'admin-stock-out'
                                                : 'admin-stock-low'
                                        }
                                    >
                                        {item.stock === 0
                                            ? 'Hết'
                                            : 'Còn ' + item.stock}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="admin-muted">
                            Không có phiên bản đang bán nào chỉ còn 1–5 cái.
                        </p>
                    )}
                </section>
            </div>

            <section className="admin-section" aria-labelledby="recent-title">
                <div className="admin-section-heading">
                    <h2 id="recent-title">Đơn hàng gần đây</h2>
                    <Link href={withDemo('/admin/orders')}>
                        Tất cả đơn hàng
                    </Link>
                </div>
                <OrderTable orders={orders} />
            </section>
        </>
    );
}
