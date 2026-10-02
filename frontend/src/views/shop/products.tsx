import { Head, Link, router, usePage } from '@inertiajs/react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { DemoBadge, FormErrors, ProductImage } from '@/layouts/shop-layout';
import {
    playStyles,
    vnd,
    type Pagination,
    type Product,
    type ProductFilters,
    type Taxonomy,
} from '@/types/commerce';

type Props = {
    products: Pagination<Product>;
    filters: ProductFilters;
    inStock: number;
    categories: Taxonomy[];
    brands: Taxonomy[];
};

const prices: Record<string, string> = {
    'under-1m': 'Dưới 1 triệu',
    '1m-2m': '1 – 2 triệu',
    '2m-3m': '2 – 3 triệu',
    '3m-4m': '3 – 4 triệu',
    'over-4m': 'Trên 4 triệu',
};
const sorts: Record<string, string> = {
    featured: 'Nổi bật',
    price_asc: 'Giá thấp đến cao',
    price_desc: 'Giá cao đến thấp',
    newest: 'Mới nhất',
};

/** Name only the clicked card's photo, so it alone morphs into the product page photo. */
function heroFrom(event: MouseEvent<Element>) {
    document
        .querySelectorAll<HTMLElement>('.store-product-card .store-image')
        .forEach((figure) => (figure.style.viewTransitionName = ''));
    const figure = event.currentTarget
        .closest('.store-product-card')
        ?.querySelector<HTMLElement>('.store-image');
    if (figure) figure.style.viewTransitionName = 'product-hero';
}

/** Drop empty values and the defaults so URLs stay short and shareable. */
const cleaned = (filters: ProductFilters) =>
    Object.fromEntries(
        Object.entries(filters).filter(
            ([key, value]) =>
                value && !(key === 'sort' && value === 'featured'),
        ),
    );

export default function Products({
    products,
    filters,
    inStock,
    categories,
    brands,
}: Props) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [q, setQ] = useState(filters.q ?? '');
    const [loading, setLoading] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const typing = useRef<number | undefined>(undefined);

    // Every choice applies at once: no separate "apply" step to find and press.
    const visit = (next: Partial<ProductFilters>) => {
        window.clearTimeout(typing.current);
        router.get('/products', cleaned({ ...filters, q, ...next }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };
    const onType = (value: string) => {
        setQ(value);
        window.clearTimeout(typing.current);
        if (value.trim() === (filters.q ?? '')) return;
        typing.current = window.setTimeout(
            () => visit({ q: value.trim() }),
            450,
        );
    };
    useEffect(() => () => window.clearTimeout(typing.current), []);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit({ q: q.trim() });
    };

    const nameOf = (list: Taxonomy[], slug: string) =>
        list.find((item) => item.slug === slug)?.name ?? slug;
    const chips = [
        filters.q && { key: 'q', label: '“' + filters.q + '”' },
        filters.category && {
            key: 'category',
            label: nameOf(categories, filters.category),
        },
        filters.brand && { key: 'brand', label: nameOf(brands, filters.brand) },
        filters.style && {
            key: 'style',
            label: playStyles[filters.style as keyof typeof playStyles],
        },
        filters.price && { key: 'price', label: prices[filters.price] },
        filters.stock && { key: 'stock', label: 'Còn hàng' },
    ].filter(Boolean) as { key: keyof ProductFilters; label: string }[];
    const panelCount = chips.filter((chip) => chip.key !== 'q').length;

    const select = (
        key: keyof ProductFilters,
        label: string,
        all: string,
        options: [string, string][],
    ) => (
        <div className="store-field">
            <label htmlFor={'filter-' + key}>{label}</label>
            <select
                id={'filter-' + key}
                value={filters[key] ?? ''}
                onChange={(event) => visit({ [key]: event.target.value })}
            >
                {all && <option value="">{all}</option>}
                {options.map(([value, text]) => (
                    <option key={value} value={value}>
                        {text}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <>
            <Head title="Cửa hàng cầu lông" />
            <header className="store-page-heading">
                <div>
                    <h1>Chọn vợt cho cuộc chơi của bạn</h1>
                    <p>
                        Lọc theo lối chơi, thương hiệu và mức giá. Hàng còn luôn
                        hiện trước.
                    </p>
                </div>
                <Link href="/advisor" className="store-pill-link">
                    Cần gợi ý chọn vợt?
                </Link>
            </header>

            <form
                className="store-search-row"
                onSubmit={submit}
                role="search"
                aria-label="Tìm sản phẩm"
            >
                <label htmlFor="q" className="store-sr-only">
                    Tìm sản phẩm
                </label>
                <div className="store-search-box">
                    <Search aria-hidden="true" size={18} />
                    <input
                        id="q"
                        type="search"
                        maxLength={100}
                        placeholder="Tìm theo tên vợt hoặc hãng"
                        value={q}
                        onChange={(event) => onType(event.target.value)}
                        enterKeyHint="search"
                    />
                </div>
                <button
                    type="button"
                    className="store-filter-toggle"
                    aria-expanded={panelOpen}
                    aria-controls="store-filter-panel"
                    onClick={() => setPanelOpen((open) => !open)}
                >
                    <SlidersHorizontal size={18} aria-hidden="true" />
                    Bộ lọc
                    {panelCount > 0 && <span>{panelCount}</span>}
                </button>
            </form>

            <div
                id="store-filter-panel"
                className="store-filters"
                data-open={panelOpen}
            >
                {select(
                    'brand',
                    'Thương hiệu',
                    'Tất cả thương hiệu',
                    brands.map((item) => [item.slug, item.name]),
                )}
                {select(
                    'style',
                    'Lối chơi',
                    'Tất cả lối chơi',
                    Object.entries(playStyles),
                )}
                {select(
                    'price',
                    'Mức giá',
                    'Mọi mức giá',
                    Object.entries(prices),
                )}
                {categories.length > 1 &&
                    select(
                        'category',
                        'Danh mục',
                        'Tất cả danh mục',
                        categories.map((item) => [item.slug, item.name]),
                    )}
                {select('sort', 'Sắp xếp', '', Object.entries(sorts))}
            </div>
            <FormErrors errors={errors} />

            <div className="store-results" aria-live="polite">
                <p>
                    <strong>{products.total.toLocaleString('vi-VN')}</strong>{' '}
                    sản phẩm
                    {products.last_page > 1 &&
                        ' · trang ' +
                            products.current_page +
                            '/' +
                            products.last_page}
                </p>
                <label className="store-switch">
                    <input
                        type="checkbox"
                        checked={filters.stock === 'in'}
                        onChange={(event) =>
                            visit({ stock: event.target.checked ? 'in' : '' })
                        }
                    />
                    <span>
                        Chỉ hàng còn{' '}
                        <small>({inStock.toLocaleString('vi-VN')})</small>
                    </span>
                </label>
            </div>

            {chips.length > 0 && (
                <ul className="store-chips" aria-label="Bộ lọc đang dùng">
                    {chips.map((chip) => (
                        <li key={chip.key}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (chip.key === 'q') setQ('');
                                    visit({ [chip.key]: '' });
                                }}
                                aria-label={'Bỏ lọc ' + chip.label}
                            >
                                {chip.label}
                                <X size={15} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                    {chips.length > 1 && (
                        <li>
                            <Link
                                href="/products"
                                className="store-chips-clear"
                                preserveScroll
                                onClick={() => setQ('')}
                            >
                                Xóa tất cả
                            </Link>
                        </li>
                    )}
                </ul>
            )}

            {products.data.length ? (
                <div className="store-product-grid" data-loading={loading}>
                    {products.data.map((product) => {
                        const variants = product.variants.filter(
                            (variant) => variant.is_active,
                        );
                        const price = variants.length
                            ? Math.min(
                                  ...variants.map((variant) => variant.price),
                              )
                            : null;
                        const available = variants.some(
                            (variant) => variant.stock > 0,
                        );
                        return (
                            <article
                                className="store-product-card"
                                key={product.id}
                                data-available={available}
                            >
                                <ProductImage
                                    src={product.image_url}
                                    name={product.name}
                                />
                                <div className="store-product-meta">
                                    <span>
                                        {product.brand?.name ??
                                            product.category?.name ??
                                            'Vợt cầu lông'}
                                    </span>
                                    {product.is_demo && <DemoBadge />}
                                </div>
                                <h2>
                                    {/* The whole card is this one link (see .store-card-link). */}
                                    <Link
                                        href={'/products/' + product.slug}
                                        className="store-card-link"
                                        prefetch="hover"
                                        onClick={heroFrom}
                                    >
                                        {product.name}
                                    </Link>
                                </h2>
                                <p>{playStyles[product.play_style]}</p>
                                <div className="store-product-price">
                                    <strong>
                                        {price === null
                                            ? 'Chưa có giá'
                                            : 'Từ ' + vnd(price)}
                                    </strong>
                                    <span
                                        className={
                                            available
                                                ? 'store-stock'
                                                : 'store-out'
                                        }
                                    >
                                        {available ? 'Còn hàng' : 'Hết hàng'}
                                    </span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <section className="store-empty">
                    <h2>Chưa tìm thấy sản phẩm phù hợp</h2>
                    <p>Thử bớt điều kiện hoặc tìm bằng tên khác.</p>
                    <Link
                        className="store-button"
                        href="/products"
                        onClick={() => setQ('')}
                    >
                        Xem tất cả sản phẩm
                    </Link>
                </section>
            )}
            {products.last_page > 1 && (
                <nav
                    className="store-pagination"
                    aria-label="Phân trang sản phẩm"
                >
                    {products.links.map((link, index) => {
                        const edge =
                            index === 0
                                ? 'prev'
                                : index === products.links.length - 1
                                  ? 'next'
                                  : null;
                        const label =
                            edge === 'prev'
                                ? 'Trước'
                                : edge === 'next'
                                  ? 'Sau'
                                  : link.label.replace(/<[^>]*>/g, '');
                        return link.url ? (
                            <Link
                                key={index}
                                href={link.url}
                                data-edge={edge ?? undefined}
                                aria-current={link.active ? 'page' : undefined}
                                aria-label={edge ? undefined : 'Trang ' + label}
                            >
                                {label}
                            </Link>
                        ) : (
                            <span
                                key={index}
                                data-edge={edge ?? undefined}
                                aria-disabled="true"
                            >
                                {label}
                            </span>
                        );
                    })}
                </nav>
            )}
        </>
    );
}
