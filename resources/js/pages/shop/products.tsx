import { Head, Link, useForm } from '@inertiajs/react';
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
    categories: Taxonomy[];
    brands: Taxonomy[];
};

export default function Products({
    products,
    filters,
    categories,
    brands,
}: Props) {
    const form = useForm<ProductFilters>({
        q: filters.q ?? '',
        category: filters.category ?? '',
        brand: filters.brand ?? '',
        style: filters.style ?? '',
        sort: filters.sort || 'featured',
    });
    return (
        <>
            <Head title="Cửa hàng cầu lông" />
            <header className="store-page-heading">
                <div>
                    <h1>Chọn vợt cho cuộc chơi của bạn</h1>
                    <p>
                        Lọc theo lối chơi, thương hiệu và mức giá. Xem từng
                        phiên bản trước khi chọn.
                    </p>
                </div>
                <Link href="/advisor" className="store-text-link">
                    Cần gợi ý chọn vợt?
                </Link>
            </header>
            <form
                className="store-filters"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.get('/products', { preserveState: true });
                }}
                aria-label="Lọc sản phẩm"
            >
                <div className="store-field store-search">
                    <label htmlFor="q">Tìm sản phẩm</label>
                    <input
                        id="q"
                        type="search"
                        maxLength={100}
                        placeholder="Tên vợt bạn muốn tìm"
                        value={form.data.q}
                        onChange={(event) =>
                            form.setData('q', event.target.value)
                        }
                    />
                </div>
                <div className="store-field">
                    <label htmlFor="category">Danh mục</label>
                    <select
                        id="category"
                        value={form.data.category}
                        onChange={(event) =>
                            form.setData('category', event.target.value)
                        }
                    >
                        <option value="">Tất cả danh mục</option>
                        {categories.map((item) => (
                            <option key={item.id} value={item.slug}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="store-field">
                    <label htmlFor="brand">Thương hiệu</label>
                    <select
                        id="brand"
                        value={form.data.brand}
                        onChange={(event) =>
                            form.setData('brand', event.target.value)
                        }
                    >
                        <option value="">Tất cả thương hiệu</option>
                        {brands.map((item) => (
                            <option key={item.id} value={item.slug}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="store-field">
                    <label htmlFor="style">Lối chơi</label>
                    <select
                        id="style"
                        value={form.data.style}
                        onChange={(event) =>
                            form.setData('style', event.target.value)
                        }
                    >
                        <option value="">Tất cả lối chơi</option>
                        {Object.entries(playStyles).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="store-field">
                    <label htmlFor="sort">Sắp xếp</label>
                    <select
                        id="sort"
                        value={form.data.sort}
                        onChange={(event) =>
                            form.setData('sort', event.target.value)
                        }
                    >
                        <option value="featured">Nổi bật</option>
                        <option value="price_asc">Giá thấp đến cao</option>
                        <option value="price_desc">Giá cao đến thấp</option>
                        <option value="newest">Mới nhất</option>
                    </select>
                </div>
                <div className="store-filter-actions">
                    <button className="store-button" disabled={form.processing}>
                        {form.processing ? 'Đang lọc…' : 'Áp dụng'}
                    </button>
                    <Link href="/products" className="store-text-link">
                        Xóa bộ lọc
                    </Link>
                </div>
            </form>
            <FormErrors errors={form.errors} />
            <div className="store-results" aria-live="polite">
                <p>
                    {products.total} sản phẩm
                    {products.from !== null && (
                        <>
                            {' '}
                            · Đang xem {products.from}–{products.to}
                        </>
                    )}
                </p>
                <span>Giá theo phiên bản · Đơn vị VND</span>
            </div>
            {products.data.length ? (
                <div className="store-product-grid">
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
                            >
                                <Link
                                    href={'/products/' + product.slug}
                                    className="store-product-photo"
                                    aria-label={'Xem ' + product.name}
                                >
                                    <ProductImage
                                        src={product.image_url}
                                        name={product.name}
                                    />
                                </Link>
                                <div className="store-product-meta">
                                    <span>
                                        {product.brand?.name ??
                                            product.category?.name ??
                                            'Vợt cầu lông'}
                                    </span>
                                    {product.is_demo && <DemoBadge />}
                                </div>
                                <h2>
                                    <Link href={'/products/' + product.slug}>
                                        {product.name}
                                    </Link>
                                </h2>
                                <p>{playStyles[product.play_style]}</p>
                                <div className="store-product-price">
                                    <strong>
                                        {price === null
                                            ? 'Chưa có phiên bản bán'
                                            : 'Từ ' + vnd(price)}
                                    </strong>
                                    <span
                                        className={
                                            available
                                                ? 'store-stock'
                                                : 'store-muted'
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
                    <Link className="store-button" href="/products">
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
                        const label =
                            index === 0
                                ? 'Trước'
                                : index === products.links.length - 1
                                  ? 'Sau'
                                  : link.label.replace(/<[^>]*>/g, '');
                        return link.url ? (
                            <Link
                                key={index}
                                href={link.url}
                                aria-current={link.active ? 'page' : undefined}
                            >
                                {label}
                            </Link>
                        ) : (
                            <span key={index} aria-disabled="true">
                                {label}
                            </span>
                        );
                    })}
                </nav>
            )}
        </>
    );
}
