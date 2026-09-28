import { Head, Link, router } from '@inertiajs/react';
import { ArrowDownRight, ArrowUpRight, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import RevenueChart, { compact } from '@/components/revenue-chart';
import type { RevenuePoint } from '@/components/revenue-chart';
import {
    date,
    money,
    PageHeader,
    query,
    statuses,
    styles,
    Tabs,
} from './shared';

type Period = '7d' | '30d' | '90d' | '12m';
type Totals = {
    sales: number;
    collected: number;
    orders: number;
    placed: number;
    cancelled: number;
    average: number;
    items: number;
    goods: number;
    costed: number;
    profit: number;
};
type Share = {
    name: string;
    revenue: number;
    quantity: number;
    profit?: number | null;
};

const periods: { key: Period; label: string; previous: string }[] = [
    { key: '7d', label: '7 ngày', previous: '7 ngày trước đó' },
    { key: '30d', label: '30 ngày', previous: '30 ngày trước đó' },
    { key: '90d', label: '90 ngày', previous: '90 ngày trước đó' },
    { key: '12m', label: '12 tháng', previous: '12 tháng trước đó' },
];
const statusOrder = [
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
];
const number = (value: number) => value.toLocaleString('vi-VN');

/** Stat-tile money: exact under a million, then "12,5 triệu ₫" / "1,23 tỷ ₫". */
const tileMoney = (value: number) => {
    const format = (amount: number) =>
        amount.toLocaleString('vi-VN', {
            maximumFractionDigits: amount < 10 ? 2 : 1,
        });
    if (value >= 1e9) return format(value / 1e9) + ' tỷ ₫';
    if (value >= 1e6) return format(value / 1e6) + ' triệu ₫';
    return money(value);
};
const rate = (part: number, whole: number) =>
    whole ? (part / whole) * 100 : 0;
const percent = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';

/**
 * Change against the previous period of the same length. Direction is shown by arrow and sign,
 * colour only adds whether that direction is good for the shop.
 */
function Delta({
    now,
    before,
    show,
    upIsGood = true,
    points = false,
}: {
    now: number;
    before: number;
    show: (value: number) => string;
    upIsGood?: boolean;
    points?: boolean;
}) {
    const previous = 'kỳ trước ' + show(before);
    if (!points && before === 0) {
        return <small className="admin-delta">Kỳ trước: 0</small>;
    }
    const change = points ? now - before : ((now - before) / before) * 100;
    if (Math.abs(change) < 0.5) {
        return <small className="admin-delta">Như {previous}</small>;
    }
    const up = change > 0;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    // Past +900% a percentage stops meaning anything to a reader: say how many times instead.
    const times = !points && up && change >= 900;
    const size = times
        ? Math.round(now / before).toLocaleString('vi-VN') + ' lần'
        : Math.abs(change).toLocaleString('vi-VN', {
              maximumFractionDigits: Math.abs(change) < 10 ? 1 : 0,
          }) + (points ? ' điểm' : '%');
    return (
        <small
            className="admin-delta"
            data-tone={up === upIsGood ? 'good' : 'bad'}
        >
            <b>
                <Icon aria-hidden="true" />
                {(times ? 'Gấp ' : up ? 'Tăng ' : 'Giảm ') + size}
            </b>
            <span> · {previous}</span>
        </small>
    );
}

/** Ranked bars, one colour: the length is the revenue, the text beside it the exact figure. */
function Ranked({
    rows,
    label,
    empty,
}: {
    rows: Share[];
    label: (name: string) => string;
    empty: string;
}) {
    const top = Math.max(...rows.map((row) => row.revenue), 1);
    const total = rows.reduce((sum, row) => sum + row.revenue, 0);
    if (!rows.length) return <p className="admin-muted">{empty}</p>;
    return (
        <ol className="admin-ranked">
            {rows.map((row) => (
                <li key={row.name || '—'}>
                    <span className="admin-ranked-name" title={label(row.name)}>
                        {label(row.name)}
                    </span>
                    <span className="admin-ranked-value">
                        {money(row.revenue)}
                    </span>
                    <span className="admin-ranked-bar" aria-hidden="true">
                        <span
                            style={{
                                width: (row.revenue / top) * 100 + '%',
                            }}
                        />
                    </span>
                    <small>
                        {number(row.quantity)} cái ·{' '}
                        {row.profit === undefined || row.profit === null
                            ? percent(rate(row.revenue, total))
                            : 'lãi ' +
                              compact(row.profit) +
                              ' (' +
                              percent(rate(row.profit, row.revenue)) +
                              ')'}
                    </small>
                </li>
            ))}
        </ol>
    );
}

export default function Reports({
    filters,
    range,
    totals,
    previous,
    series,
    statuses: counts,
    topProducts,
    byBrand,
    byStyle,
    stock,
    customers,
}: {
    filters: { period: Period; demo: boolean };
    range: { from: string; to: string; monthly: boolean };
    totals: Totals;
    previous: Totals;
    series: RevenuePoint[];
    statuses: Record<string, number>;
    topProducts: Share[];
    byBrand: Share[];
    byStyle: Share[];
    stock: {
        on_sale: number;
        hidden: number;
        units: number;
        value: number;
        cost_value: number;
        costed_units: number;
        out: number;
        low: number;
    };
    customers: { new: number; buyers: number };
}) {
    // Keep the current numbers on screen, dimmed, while the next period loads.
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        const stopStart = router.on('start', () => setLoading(true));
        const stopFinish = router.on('finish', () => setLoading(false));
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const period = periods.find((item) => item.key === filters.period)!;
    const demo = filters.demo ? '1' : '';
    const placed = statusOrder.reduce(
        (sum, key) => sum + (counts[key] ?? 0),
        0,
    );
    const cancelRate = rate(totals.cancelled, totals.placed);
    const cancelBefore = rate(previous.cancelled, previous.placed);
    const scope = filters.demo ? 'gồm cả đơn mẫu' : 'chỉ đơn thật';
    // Margin is measured on goods with a known cost; coverage says how much of the goods that is.
    const marginRate = rate(totals.profit, totals.costed);
    const coverage = rate(totals.costed, totals.goods);

    return (
        <>
            <Head title="Báo cáo doanh thu" />
            <PageHeader
                title="Báo cáo doanh thu"
                description={
                    'Doanh số là giá trị đơn đặt trong kỳ, không tính đơn hủy. Lãi gộp là tiền hàng trừ giá nhập (không tính phí giao, chi phí vận hành). Đã thu là tiền COD đã ghi nhận. Mỗi số được so với ' +
                    period.previous +
                    '.'
                }
                actions={
                    <a
                        href={query('/admin/orders/export', {
                            from: range.from,
                            to: range.to,
                        })}
                        className="admin-button admin-button-secondary"
                        download
                    >
                        <Download aria-hidden="true" />
                        Xuất đơn trong kỳ (CSV)
                    </a>
                }
            />

            <div className="admin-report-filters">
                <Tabs
                    label="Khoảng thời gian"
                    items={periods.map((item) => ({
                        href: query('/admin/reports', {
                            period: item.key === '30d' ? '' : item.key,
                            demo,
                        }),
                        label: item.label,
                        current: item.key === filters.period,
                    }))}
                />
                <label className="admin-check">
                    <input
                        type="checkbox"
                        checked={filters.demo}
                        onChange={(event) =>
                            router.get(
                                query('/admin/reports', {
                                    period:
                                        filters.period === '30d'
                                            ? ''
                                            : filters.period,
                                    demo: event.target.checked ? '1' : '',
                                }),
                                {},
                                { preserveScroll: true },
                            )
                        }
                    />
                    Tính cả đơn mẫu
                </label>
                <span className="admin-report-range">
                    {date(range.from)} – {date(range.to)}
                </span>
            </div>

            {filters.demo && (
                <p className="admin-notice" role="status">
                    Đang tính cả đơn mẫu. Số liệu dưới đây gồm dữ liệu thử,
                    không phải doanh thu thật của cửa hàng.
                </p>
            )}

            <div className="admin-report" data-loading={loading}>
                <section aria-labelledby="kpi-title">
                    <h2 id="kpi-title" className="sr-only">
                        Chỉ số chính trong {period.label}
                    </h2>
                    <dl className="admin-metrics">
                        <div>
                            <dt>Doanh số</dt>
                            <dd title={money(totals.sales)}>
                                {tileMoney(totals.sales)}
                                <Delta
                                    now={totals.sales}
                                    before={previous.sales}
                                    show={compact}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>Lãi gộp</dt>
                            {totals.costed > 0 ? (
                                <dd title={money(totals.profit)}>
                                    {tileMoney(totals.profit)}
                                    <small>
                                        Biên {percent(marginRate)}
                                        {coverage < 99.5 &&
                                            ' · tính trên ' +
                                                percent(coverage) +
                                                ' tiền hàng có giá nhập'}
                                    </small>
                                    {previous.costed > 0 && (
                                        <Delta
                                            now={totals.profit}
                                            before={previous.profit}
                                            show={compact}
                                        />
                                    )}
                                </dd>
                            ) : (
                                <dd>
                                    —
                                    <small>
                                        {totals.goods > 0
                                            ? 'Sản phẩm đã bán chưa có giá nhập. '
                                            : 'Chưa có hàng bán trong kỳ. '}
                                        <Link href="/admin/products">
                                            Nhập giá nhập
                                        </Link>
                                    </small>
                                </dd>
                            )}
                        </div>
                        <div>
                            <dt>Đã thu (COD)</dt>
                            <dd title={money(totals.collected)}>
                                {tileMoney(totals.collected)}
                                <Delta
                                    now={totals.collected}
                                    before={previous.collected}
                                    show={compact}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>Đơn không hủy</dt>
                            <dd>
                                {number(totals.orders)}
                                <small>
                                    {number(customers.buyers)} khách ·{' '}
                                    {number(customers.new)} tài khoản mới
                                </small>
                                <Delta
                                    now={totals.orders}
                                    before={previous.orders}
                                    show={number}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>Trung bình mỗi đơn</dt>
                            <dd title={money(totals.average)}>
                                {tileMoney(totals.average)}
                                <Delta
                                    now={totals.average}
                                    before={previous.average}
                                    show={compact}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>Tỉ lệ hủy</dt>
                            <dd>
                                {percent(cancelRate)}
                                <small>
                                    {number(totals.cancelled)} /{' '}
                                    {number(totals.placed)} đơn đặt
                                </small>
                                {previous.placed > 0 && (
                                    <Delta
                                        now={cancelRate}
                                        before={cancelBefore}
                                        show={percent}
                                        upIsGood={false}
                                        points
                                    />
                                )}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section className="admin-panel" aria-labelledby="chart-title">
                    <div className="admin-section-heading">
                        <h2 id="chart-title">
                            Doanh số theo {range.monthly ? 'tháng' : 'ngày'}
                        </h2>
                        <span className="admin-muted">
                            Đơn vị: đồng · {scope}
                        </span>
                    </div>
                    {totals.placed === 0 && totals.collected === 0 ? (
                        <div className="admin-empty">
                            <strong>
                                Chưa có đơn nào trong {period.label} qua.
                            </strong>
                            {filters.demo
                                ? 'Thử chọn khoảng thời gian dài hơn.'
                                : 'Biểu đồ sẽ hiện khi khách đặt đơn đầu tiên. Muốn xem thử cách hiển thị, bật “Tính cả đơn mẫu”.'}
                        </div>
                    ) : (
                        <RevenueChart points={series} monthly={range.monthly} />
                    )}
                </section>

                <div className="admin-grid-main admin-section">
                    <section
                        className="admin-panel"
                        aria-labelledby="top-title"
                    >
                        <div className="admin-section-heading">
                            <h2 id="top-title">Bán nhiều nhất trong kỳ</h2>
                            <span className="admin-muted">
                                theo doanh số · kèm lãi gộp nếu có giá nhập
                            </span>
                        </div>
                        <Ranked
                            rows={topProducts}
                            label={(name) => name}
                            empty="Chưa có sản phẩm nào được bán trong kỳ này."
                        />
                    </section>
                    <div>
                        <section
                            className="admin-panel"
                            aria-labelledby="style-title"
                        >
                            <h2 id="style-title">Theo lối chơi</h2>
                            <Ranked
                                rows={byStyle}
                                label={(name) =>
                                    styles[name] ?? 'Sản phẩm đã xóa'
                                }
                                empty="Chưa có dữ liệu trong kỳ này."
                            />
                        </section>
                        <section
                            className="admin-panel"
                            aria-labelledby="brand-title"
                        >
                            <h2 id="brand-title">Theo hãng</h2>
                            <Ranked
                                rows={byBrand}
                                label={(name) => name || 'Chưa gán hãng'}
                                empty="Chưa có dữ liệu trong kỳ này."
                            />
                        </section>
                    </div>
                </div>

                <div className="admin-two-columns admin-section">
                    <section
                        className="admin-panel"
                        aria-labelledby="status-title"
                    >
                        <div className="admin-section-heading">
                            <h2 id="status-title">Đơn đặt trong kỳ</h2>
                            <span className="admin-muted">
                                {number(placed)} đơn
                            </span>
                        </div>
                        {placed > 0 ? (
                            <>
                                <div className="admin-stack" aria-hidden="true">
                                    {statusOrder
                                        .filter((key) => counts[key])
                                        .map((key) => (
                                            <span
                                                key={key}
                                                data-status={key}
                                                style={{
                                                    flexGrow: counts[key],
                                                }}
                                            />
                                        ))}
                                </div>
                                <ul className="admin-status-list">
                                    {statusOrder.map((key) => (
                                        <li key={key}>
                                            <span
                                                className="admin-key"
                                                data-status={key}
                                                aria-hidden="true"
                                            />
                                            <Link
                                                href={query('/admin/orders', {
                                                    status: key,
                                                })}
                                            >
                                                {statuses[key]}
                                            </Link>
                                            <b>{number(counts[key] ?? 0)}</b>
                                            <small>
                                                {percent(
                                                    rate(
                                                        counts[key] ?? 0,
                                                        placed,
                                                    ),
                                                )}
                                            </small>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <p className="admin-muted">
                                Chưa có đơn nào được đặt trong kỳ này.
                            </p>
                        )}
                    </section>

                    <section
                        className="admin-panel"
                        aria-labelledby="stock-title"
                    >
                        <div className="admin-section-heading">
                            <h2 id="stock-title">Kho hàng hiện tại</h2>
                            <span className="admin-muted">không theo kỳ</span>
                        </div>
                        <dl className="admin-facts">
                            <div>
                                <dt>Sản phẩm đang bán</dt>
                                <dd>{number(stock.on_sale)}</dd>
                            </div>
                            <div>
                                <dt>Sản phẩm đang ẩn</dt>
                                <dd>
                                    <Link href="/admin/products?status=hidden">
                                        {number(stock.hidden)}
                                    </Link>
                                </dd>
                            </div>
                            <div>
                                <dt>Số cái có thể bán</dt>
                                <dd>{number(stock.units)}</dd>
                            </div>
                            <div>
                                <dt>Giá trị tồn kho (theo giá bán)</dt>
                                <dd>{money(stock.value)}</dd>
                            </div>
                            <div>
                                <dt>Giá trị tồn kho (theo giá nhập)</dt>
                                <dd>
                                    {stock.cost_value > 0 ? (
                                        <>
                                            {money(stock.cost_value)}
                                            {stock.costed_units <
                                                stock.units && (
                                                <small>
                                                    {number(stock.costed_units)}
                                                    /{number(stock.units)} cái
                                                    có giá nhập
                                                </small>
                                            )}
                                        </>
                                    ) : (
                                        <span className="admin-muted">
                                            Chưa có giá nhập
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Đang bán nhưng hết hàng</dt>
                                <dd>
                                    <Link
                                        href="/admin/products?status=active&stock=out"
                                        data-tone={
                                            stock.out ? 'danger' : undefined
                                        }
                                    >
                                        {number(stock.out)} sản phẩm
                                    </Link>
                                </dd>
                            </div>
                            <div>
                                <dt>Phiên bản còn 1–5 cái</dt>
                                <dd>
                                    <Link
                                        href="/admin/products?status=active&stock=low"
                                        data-tone={
                                            stock.low ? 'warning' : undefined
                                        }
                                    >
                                        {number(stock.low)} phiên bản
                                    </Link>
                                </dd>
                            </div>
                        </dl>
                        <p className="admin-footnote admin-muted">
                            {filters.demo
                                ? 'Đang tính cả sản phẩm demo.'
                                : 'Không tính sản phẩm demo.'}
                        </p>
                    </section>
                </div>
            </div>
        </>
    );
}
