import { Form, Head, Link } from '@inertiajs/react';
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

export default function Advisor({
    recommendations,
    filters,
}: {
    recommendations: Recommendation[];
    filters: Filters;
}) {
    return (
        <div className="advisor-page">
            <Head title="Gợi ý chọn vợt" />
            <header className="advisor-intro">
                <h1>Chọn vợt theo nhu cầu của bạn</h1>
                <p>
                    Đặt ngân sách, chọn lối chơi và trình độ để thu hẹp lựa chọn
                    trong danh mục đang có hàng.
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
                            <h2>Thông tin của bạn</h2>
                            <div className="advisor-field">
                                <label htmlFor="advisor-budget">
                                    Ngân sách tối đa (đồng)
                                </label>
                                <input
                                    id="advisor-budget"
                                    name="budget"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    max="1000000000"
                                    step="1"
                                    required
                                    defaultValue={filters.budget ?? ''}
                                    aria-invalid={!!errors.budget}
                                    aria-describedby="advisor-budget-hint advisor-budget-error"
                                />
                                <p id="advisor-budget-hint">
                                    Giá một cây vợt, chưa gồm phí giao hàng.
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
                              ? 'Các lựa chọn theo tiêu chí'
                              : 'Chưa có vợt khớp tiêu chí'}
                    </h2>
                    {filters.budget === null ? (
                        <p>
                            Nhập ngân sách rồi chọn “Xem gợi ý”. Bạn có thể để
                            lối chơi và trình độ ở “Không giới hạn”.
                        </p>
                    ) : recommendations.length === 0 ? (
                        <p>
                            Thử tăng ngân sách hoặc bỏ giới hạn lối chơi, trình
                            độ để tìm thêm lựa chọn đang có hàng.
                        </p>
                    ) : (
                        <>
                            <p>
                                Tối đa 3 mẫu, xếp theo giá phiên bản còn hàng
                                thấp nhất trong ngân sách. Phân loại dựa trên
                                thông tin danh mục, không phải đánh giá hiệu
                                suất.
                            </p>
                            <ul className="advisor-list">
                                {recommendations.map((product) => {
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
                                                        Có phiên bản còn hàng,
                                                        giá không vượt{' '}
                                                        {money(filters.budget!)}
                                                        .
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
