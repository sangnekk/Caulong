import { Form, Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import '../../../css/advisor.css';

type Style = 'attack' | 'speed' | 'balanced';
type Level = 'beginner' | 'intermediate' | 'advanced';
type Filters = {
    budget: number | null;
    style: Style | null;
    level: Level | null;
};
type Recommendation = {
    id: number;
    name: string;
    slug: string;
    image_url: string;
    play_style: Style;
    skill_level: Level | 'all';
    is_demo: boolean;
    variants: {
        id: number;
        name: string;
        price: number;
        stock: number;
        is_active: boolean;
    }[];
};

const styles: Record<Style, string> = {
    attack: 'Tấn công',
    speed: 'Tốc độ',
    balanced: 'Cân bằng',
};
const levels: Record<Level | 'all', string> = {
    beginner: 'Mới chơi',
    intermediate: 'Trung cấp',
    advanced: 'Nâng cao',
    all: 'Mọi trình độ',
};
const money = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(value);
const formatBudget = (value: number | string) => {
    const digits = String(value)
        .replace(/\D/g, '')
        .slice(0, 10)
        .replace(/^0+(?=\d)/, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function Advisor({
    recommendations,
    filters,
}: {
    recommendations: Recommendation[];
    filters: Filters;
}) {
    const [budgetInput, setBudgetInput] = useState(() =>
        formatBudget(filters.budget ?? ''),
    );
    const budgetInputRef = useRef<HTMLInputElement>(null);
    const hasAvailable = recommendations.some((product) =>
        product.variants.some((variant) => variant.stock > 0),
    );

    useEffect(() => {
        setBudgetInput(formatBudget(filters.budget ?? ''));
    }, [filters.budget]);

    return (
        <div className="advisor-page">
            <Head title="Gợi ý chọn vợt" />
            <header className="advisor-intro">
                <h1>Chọn vợt theo nhu cầu của bạn</h1>
                <p>
                    Chọn ngân sách, lối chơi và trình độ. Ưu tiên vợt còn hàng;
                    nếu chưa có, hiện các mẫu phù hợp đang hết hàng.
                </p>
                <p className="advisor-disclosure">
                    Gợi ý theo thông tin bạn chọn, chưa sử dụng AI
                </p>
            </header>
            <div className="advisor-workspace">
                <Form
                    action="/advisor"
                    method="get"
                    className="advisor-form"
                    key={JSON.stringify(filters)}
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="advisor-field">
                                <label htmlFor="advisor-budget">
                                    Ngân sách tối đa (đồng)
                                </label>
                                <input
                                    type="hidden"
                                    name="budget"
                                    value={budgetInput.replace(/\D/g, '')}
                                />
                                <input
                                    ref={budgetInputRef}
                                    id="advisor-budget"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9.]*"
                                    maxLength={13}
                                    required
                                    placeholder="Ví dụ: 1.000.000"
                                    value={budgetInput}
                                    onChange={(event) => {
                                        const inputValue = event.target.value;
                                        const cursor =
                                            event.target.selectionStart ??
                                            inputValue.length;
                                        const digitsBeforeCursor = inputValue
                                            .slice(0, cursor)
                                            .replace(/\D/g, '').length;
                                        const formatted =
                                            formatBudget(inputValue);
                                        setBudgetInput(formatted);
                                        requestAnimationFrame(() => {
                                            const input =
                                                budgetInputRef.current;
                                            if (!input) return;
                                            let nextCursor = 0;
                                            let digitsAtCursor = 0;
                                            while (
                                                nextCursor < formatted.length &&
                                                digitsAtCursor <
                                                    digitsBeforeCursor
                                            ) {
                                                if (
                                                    /\d/.test(
                                                        formatted[nextCursor],
                                                    )
                                                ) {
                                                    digitsAtCursor++;
                                                }
                                                nextCursor++;
                                            }
                                            input.setSelectionRange(
                                                nextCursor,
                                                nextCursor,
                                            );
                                        });
                                    }}
                                    aria-invalid={!!errors.budget}
                                    aria-describedby="advisor-budget-hint advisor-budget-error"
                                />
                                <p id="advisor-budget-hint">
                                    Nhập tối đa 1.000.000.000 ₫.
                                </p>
                                <p
                                    id="advisor-budget-error"
                                    className="advisor-error"
                                    role={errors.budget ? 'alert' : undefined}
                                >
                                    {errors.budget}
                                </p>
                            </div>
                            <div className="advisor-field">
                                <label htmlFor="advisor-style">Lối chơi</label>
                                <select
                                    id="advisor-style"
                                    name="style"
                                    defaultValue={filters.style ?? ''}
                                    aria-invalid={!!errors.style}
                                    aria-describedby="advisor-style-error"
                                >
                                    <option value="">Không giới hạn</option>
                                    {Object.entries(styles).map(
                                        ([value, label]) => (
                                            <option value={value} key={value}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                                <p
                                    id="advisor-style-error"
                                    className="advisor-error"
                                    role={errors.style ? 'alert' : undefined}
                                >
                                    {errors.style}
                                </p>
                            </div>
                            <div className="advisor-field">
                                <label htmlFor="advisor-level">Trình độ</label>
                                <select
                                    id="advisor-level"
                                    name="level"
                                    defaultValue={filters.level ?? ''}
                                    aria-invalid={!!errors.level}
                                    aria-describedby="advisor-level-error"
                                >
                                    <option value="">Không giới hạn</option>
                                    {Object.entries(levels)
                                        .filter(([value]) => value !== 'all')
                                        .map(([value, label]) => (
                                            <option value={value} key={value}>
                                                {label}
                                            </option>
                                        ))}
                                </select>
                                <p
                                    id="advisor-level-error"
                                    className="advisor-error"
                                    role={errors.level ? 'alert' : undefined}
                                >
                                    {errors.level}
                                </p>
                            </div>
                            <button type="submit" disabled={processing}>
                                {processing ? 'Đang tìm vợt…' : 'Xem gợi ý'}
                            </button>
                            <Link href="/advisor" className="advisor-reset">
                                Xóa lựa chọn
                            </Link>
                        </>
                    )}
                </Form>
                <section
                    className="advisor-results"
                    aria-labelledby="advisor-results-title"
                    aria-live="polite"
                >
                    <h2 id="advisor-results-title">
                        {filters.budget === null
                            ? 'Bắt đầu từ điều bạn cần'
                            : recommendations.length
                              ? hasAvailable
                                  ? 'Các lựa chọn theo tiêu chí'
                                  : 'Vợt khớp tiêu chí nhưng đang hết hàng'
                              : 'Chưa có vợt khớp tiêu chí'}
                    </h2>
                    {filters.budget === null ? (
                        <p>
                            Nhập ngân sách rồi chọn “Xem gợi ý”. Bạn có thể để
                            lối chơi và trình độ ở “Không giới hạn”.
                        </p>
                    ) : recommendations.length === 0 ? (
                        <>
                            <p>
                                Chưa có vợt trong danh mục khớp đủ các tiêu chí.
                                Thử tăng ngân sách hoặc bỏ bớt giới hạn để tìm
                                thêm lựa chọn.
                            </p>
                            {(filters.style || filters.level) && (
                                <Link
                                    href={`/advisor?budget=${filters.budget}`}
                                    className="advisor-broaden"
                                >
                                    Bỏ giới hạn lối chơi và trình độ
                                </Link>
                            )}
                        </>
                    ) : (
                        <>
                            <p>
                                {hasAvailable
                                    ? 'Tối đa 3 mẫu, ưu tiên phiên bản còn hàng và xếp theo giá thấp nhất trong ngân sách.'
                                    : 'Các mẫu dưới đây khớp tiêu chí nhưng phiên bản trong tầm giá hiện đã hết hàng.'}{' '}
                                Phân loại dựa trên thông tin danh mục, không
                                phải đánh giá hiệu suất.
                            </p>
                            <ul className="advisor-list">
                                {recommendations.map((product) => {
                                    const available = product.variants.some(
                                        (variant) => variant.stock > 0,
                                    );
                                    const price = Math.min(
                                        ...product.variants.map(
                                            (variant) => variant.price,
                                        ),
                                    );
                                    return (
                                        <li
                                            key={product.id}
                                            className="advisor-product"
                                        >
                                            <figure>
                                                <img
                                                    src={product.image_url}
                                                    alt=""
                                                    width="144"
                                                    height="168"
                                                    loading="lazy"
                                                />
                                                {product.image_url ===
                                                    '/models/hyper-core-poster.png' && (
                                                    <figcaption>
                                                        Hình minh họa
                                                    </figcaption>
                                                )}
                                            </figure>
                                            <div>
                                                {product.is_demo && (
                                                    <span className="advisor-demo">
                                                        Sản phẩm demo
                                                    </span>
                                                )}
                                                {!available && (
                                                    <span className="advisor-stock">
                                                        Tạm hết hàng
                                                    </span>
                                                )}
                                                <h3>
                                                    <Link
                                                        href={
                                                            '/products/' +
                                                            product.slug
                                                        }
                                                    >
                                                        {product.name}
                                                    </Link>
                                                </h3>
                                                <p className="advisor-price">
                                                    Từ {money(price)}
                                                </p>
                                                <ul className="advisor-reasons">
                                                    <li>
                                                        {available
                                                            ? 'Có phiên bản còn hàng, giá không vượt ' +
                                                              money(
                                                                  filters.budget!,
                                                              ) +
                                                              '.'
                                                            : 'Phiên bản trong tầm giá hiện đã hết hàng.'}
                                                    </li>
                                                    <li>
                                                        Lối chơi trong danh mục:{' '}
                                                        {
                                                            styles[
                                                                product
                                                                    .play_style
                                                            ]
                                                        }
                                                        {filters.style
                                                            ? ', khớp lựa chọn của bạn'
                                                            : ''}
                                                        .
                                                    </li>
                                                    <li>
                                                        Trình độ trong danh mục:{' '}
                                                        {
                                                            levels[
                                                                product
                                                                    .skill_level
                                                            ]
                                                        }
                                                        {filters.level &&
                                                        product.skill_level !==
                                                            'all'
                                                            ? ', khớp lựa chọn của bạn'
                                                            : ''}
                                                        .
                                                    </li>
                                                </ul>
                                                <Link
                                                    href={
                                                        '/products/' +
                                                        product.slug
                                                    }
                                                    className="advisor-detail"
                                                >
                                                    Xem phiên bản và thông tin
                                                    vợt
                                                    <span className="sr-only">
                                                        {' '}
                                                        {product.name}
                                                    </span>
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                    <Link href="/products" className="advisor-browse">
                        Xem toàn bộ danh mục
                    </Link>
                </section>
            </div>
        </div>
    );
}
