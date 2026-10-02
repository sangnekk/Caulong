import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export type RevenuePoint = {
    key: string;
    sales: number;
    collected: number;
    orders: number;
    profit?: number;
};

// Plot box in px. The x-axis band is part of the height, so labels never spill out of the card.
const PLOT = 220;
const TOP = 22;
const AXIS = 28;
const LEFT = 52;
const RIGHT = 10;

const money = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);

/** Axis and peak labels: 500k, 1,5 tr, 2 tỷ. */
export const compact = (value: number) => {
    const format = (amount: number, digits: number) =>
        amount.toLocaleString('vi-VN', { maximumFractionDigits: digits });
    if (value >= 1e9) return format(value / 1e9, 2) + ' tỷ';
    if (value >= 1e6) return format(value / 1e6, 1) + ' tr';
    if (value >= 1e3) return format(value / 1e3, 0) + 'k';
    return format(value, 0);
};

const parts = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return { year, month, day: day ?? 1 };
};
const tick = (key: string, monthly: boolean, first: boolean) => {
    const { year, month, day } = parts(key);
    if (!monthly) return day + '/' + month;
    return month === 1 || first
        ? 'T' + month + '/' + String(year).slice(2)
        : 'T' + month;
};
export const pointLabel = (key: string, monthly: boolean) => {
    const { year, month, day } = parts(key);
    if (monthly) return 'Tháng ' + month + '/' + year;
    const label = new Date(year, month - 1, day).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

/** 4–6 round steps (1, 2, 2.5, 5 × 10ⁿ) from zero past the largest value. */
const scale = (max: number) => {
    const raw = max / 4;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step =
        [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
    const count = Math.ceil(max / step);
    return Array.from({ length: count + 1 }, (_, index) => index * step);
};

/** A column: square on the baseline, 4px rounded at the value end. */
const column = (x: number, width: number, top: number, base: number) => {
    const r = Math.min(4, width / 2, base - top);
    return (
        `M${x},${base}V${top + r}` +
        `A${r},${r} 0 0 1 ${x + r},${top}H${x + width - r}` +
        `A${r},${r} 0 0 1 ${x + width},${top + r}V${base}Z`
    );
};

/**
 * Order value (columns) and COD collected (line) per day or month, on one money axis.
 * Hover, touch or arrow keys show one point; the table below carries every value.
 */
export default function RevenueChart({
    points,
    monthly,
}: {
    points: RevenuePoint[];
    monthly: boolean;
}) {
    const frame = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(720);
    const [active, setActive] = useState<number | null>(null);
    const titleId = useId();

    useLayoutEffect(() => {
        const element = frame.current;
        if (!element) return;
        setWidth(Math.round(element.clientWidth));
        const observer = new ResizeObserver(([entry]) =>
            setWidth(Math.round(entry.contentRect.width)),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const unit = monthly ? 'tháng' : 'ngày';
    const max = Math.max(
        ...points.map((point) => Math.max(point.sales, point.collected)),
    );
    const plotWidth = Math.max(width - LEFT - RIGHT, 1);
    const band = plotWidth / points.length;
    const barWidth = Math.max(1, Math.min(24, band * 0.62, band - 2));
    const ticks = max > 0 ? scale(max) : [0];
    const top = ticks[ticks.length - 1] || 1;
    const y = (value: number) => TOP + PLOT - (value / top) * PLOT;
    const center = (index: number) => LEFT + band * index + band / 2;
    const peak = points.reduce(
        (best, point, index) =>
            point.sales > points[best].sales ? index : best,
        0,
    );
    // Keep roughly one label per 64px, always ending on the latest point.
    const every = Math.max(1, Math.ceil(points.length / (plotWidth / 64)));
    const line = points
        .map(
            (point, index) =>
                (index ? 'L' : 'M') +
                center(index).toFixed(1) +
                ',' +
                y(point.collected).toFixed(1),
        )
        .join('');

    const pick = (event: PointerEvent<SVGSVGElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const index = Math.floor((event.clientX - box.left - LEFT) / band);
        setActive(Math.min(points.length - 1, Math.max(0, index)));
    };
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const last = points.length - 1;
        const current = active ?? last;
        const next = {
            ArrowLeft: current - 1,
            ArrowRight: current + 1,
            Home: 0,
            End: last,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setActive(Math.min(last, Math.max(0, next)));
    };

    const shown = active === null ? null : points[active];
    // Profit is listed, not drawn: it only exists where costs were entered.
    const withProfit = points.some((point) => point.profit);
    const x = active === null ? 0 : center(active);
    const summary =
        'Doanh số cao nhất ' +
        money(points[peak].sales) +
        ' vào ' +
        pointLabel(points[peak].key, monthly).toLowerCase() +
        '.';

    return (
        <div className="admin-chart">
            <ul className="admin-legend">
                <li>
                    <span className="admin-key" aria-hidden="true" />
                    Doanh số
                    <small>đơn đặt, không tính đơn hủy</small>
                </li>
                <li>
                    <span
                        className="admin-key"
                        data-shape="line"
                        aria-hidden="true"
                    />
                    Đã thu
                    <small>tiền COD ghi nhận trong {unit}</small>
                </li>
            </ul>
            <div
                ref={frame}
                className="admin-chart-frame"
                tabIndex={0}
                role="group"
                aria-label={
                    'Biểu đồ doanh số theo ' +
                    unit +
                    '. Dùng phím mũi tên trái, phải để xem từng ' +
                    unit +
                    '.'
                }
                onKeyDown={onKey}
                onFocus={() => setActive((index) => index ?? points.length - 1)}
                onBlur={() => setActive(null)}
            >
                <svg
                    width={width}
                    height={TOP + PLOT + AXIS}
                    aria-labelledby={titleId}
                    role="img"
                    onPointerMove={pick}
                    onPointerDown={pick}
                    onPointerLeave={() => setActive(null)}
                >
                    <title id={titleId}>
                        {'Doanh số và tiền đã thu theo ' +
                            unit +
                            '. ' +
                            summary}
                    </title>
                    {ticks.slice(1).map((value) => (
                        <line
                            key={value}
                            className="admin-chart-grid"
                            x1={LEFT}
                            x2={width - RIGHT}
                            y1={Math.round(y(value)) + 0.5}
                            y2={Math.round(y(value)) + 0.5}
                        />
                    ))}
                    {ticks.map((value) => (
                        <text
                            key={value}
                            x={LEFT - 8}
                            y={y(value)}
                            dy="0.32em"
                            textAnchor="end"
                        >
                            {compact(value)}
                        </text>
                    ))}
                    {active !== null && (
                        <rect
                            className="admin-chart-wash"
                            x={LEFT + band * active}
                            y={TOP}
                            width={band}
                            height={PLOT}
                        />
                    )}
                    {points.map((point, index) =>
                        point.sales > 0 ? (
                            <path
                                key={point.key}
                                className="admin-chart-bar"
                                d={column(
                                    center(index) - barWidth / 2,
                                    barWidth,
                                    y(point.sales),
                                    TOP + PLOT,
                                )}
                            />
                        ) : null,
                    )}
                    <line
                        className="admin-chart-base"
                        x1={LEFT}
                        x2={width - RIGHT}
                        y1={TOP + PLOT + 0.5}
                        y2={TOP + PLOT + 0.5}
                    />
                    <path className="admin-chart-line" d={line} />
                    {points[peak].sales > 0 && active === null && (
                        <text
                            className="admin-chart-peak"
                            x={Math.min(
                                Math.max(center(peak), LEFT + 20),
                                width - RIGHT - 20,
                            )}
                            y={y(points[peak].sales) - 7}
                            textAnchor="middle"
                        >
                            {compact(points[peak].sales)}
                        </text>
                    )}
                    {shown && (
                        <circle
                            className="admin-chart-dot"
                            cx={x}
                            cy={y(shown.collected)}
                            r={4}
                        />
                    )}
                    {points.map((point, index) =>
                        (points.length - 1 - index) % every === 0 ? (
                            <text
                                key={point.key}
                                x={center(index)}
                                y={TOP + PLOT + 18}
                                textAnchor="middle"
                            >
                                {tick(point.key, monthly, index === 0)}
                            </text>
                        ) : null,
                    )}
                </svg>
                {shown && (
                    <div
                        className="admin-chart-tip"
                        data-side={x > width - 240 ? 'left' : 'right'}
                        style={{ left: x }}
                        aria-hidden="true"
                    >
                        <strong>{pointLabel(shown.key, monthly)}</strong>
                        <dl>
                            <div>
                                <dt>
                                    <span className="admin-key" />
                                    Doanh số
                                </dt>
                                <dd>{money(shown.sales)}</dd>
                            </div>
                            <div>
                                <dt>
                                    <span
                                        className="admin-key"
                                        data-shape="line"
                                    />
                                    Đã thu
                                </dt>
                                <dd>{money(shown.collected)}</dd>
                            </div>
                            {withProfit && (
                                <div>
                                    <dt>Lãi gộp</dt>
                                    <dd>{money(shown.profit ?? 0)}</dd>
                                </div>
                            )}
                            <div>
                                <dt>Số đơn</dt>
                                <dd>{shown.orders}</dd>
                            </div>
                        </dl>
                    </div>
                )}
            </div>
            <p className="sr-only" aria-live="polite">
                {shown
                    ? pointLabel(shown.key, monthly) +
                      ': doanh số ' +
                      money(shown.sales) +
                      ', đã thu ' +
                      money(shown.collected) +
                      ', ' +
                      shown.orders +
                      ' đơn.'
                    : ''}
            </p>
            <details className="admin-chart-table">
                <summary>Xem số liệu dạng bảng</summary>
                <div className="admin-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">
                                    {monthly ? 'Tháng' : 'Ngày'}
                                </th>
                                <th scope="col" className="admin-number">
                                    Doanh số
                                </th>
                                <th scope="col" className="admin-number">
                                    Đã thu
                                </th>
                                {withProfit && (
                                    <th scope="col" className="admin-number">
                                        Lãi gộp
                                    </th>
                                )}
                                <th scope="col" className="admin-number">
                                    Số đơn
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...points].reverse().map((point) => (
                                <tr key={point.key}>
                                    <th scope="row">
                                        {pointLabel(point.key, monthly)}
                                    </th>
                                    <td className="admin-number">
                                        {money(point.sales)}
                                    </td>
                                    <td className="admin-number">
                                        {money(point.collected)}
                                    </td>
                                    {withProfit && (
                                        <td className="admin-number">
                                            {money(point.profit ?? 0)}
                                        </td>
                                    )}
                                    <td className="admin-number">
                                        {point.orders}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
}
