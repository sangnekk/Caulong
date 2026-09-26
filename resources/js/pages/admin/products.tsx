import { Head, Link, useForm } from '@inertiajs/react';
import { Errors, Field, money, Pages } from './shared';
import type { Pagination, Product, Taxonomy } from './shared';

function TaxonomyForm({ kind, title }: { kind: string; title: string }) {
    const form = useForm({ name: '', slug: '' });
    return (
        <details>
            <summary>Thêm {title}</summary>
            <form
                className="admin-taxonomy-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/admin/' + kind, {
                        preserveScroll: true,
                        onSuccess: () => form.reset(),
                    });
                }}
            >
                <Errors errors={form.errors} />
                <Field
                    name={kind + '-name'}
                    label={'Tên ' + title}
                    error={form.errors.name}
                >
                    <input
                        id={kind + '-name'}
                        required
                        maxLength={120}
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        aria-invalid={!!form.errors.name}
                    />
                </Field>
                <Field
                    name={kind + '-slug'}
                    label="Đường dẫn (chữ thường không dấu)"
                    error={form.errors.slug}
                >
                    <input
                        id={kind + '-slug'}
                        required
                        maxLength={160}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        value={form.data.slug}
                        onChange={(event) =>
                            form.setData('slug', event.target.value)
                        }
                        aria-invalid={!!form.errors.slug}
                    />
                </Field>
                <button disabled={form.processing}>
                    {form.processing ? 'Đang thêm…' : 'Thêm ' + title}
                </button>
            </form>
        </details>
    );
}
export default function Products({
    products,
    brands,
    categories,
    filters,
}: {
    products: Pagination<Product>;
    brands: Taxonomy[];
    categories: Taxonomy[];
    filters: { q: string };
}) {
    const search = useForm({ q: filters.q });
    return (
        <>
            <Head title="Quản lý sản phẩm" />
            <div className="admin-heading">
                <h1>Sản phẩm</h1>
                <Link className="admin-button" href="/admin/products/create">
                    Thêm sản phẩm
                </Link>
            </div>
            <form
                className="admin-toolbar"
                onSubmit={(event) => {
                    event.preventDefault();
                    search.get('/admin/products', { preserveState: true });
                }}
            >
                <label htmlFor="q">Tên sản phẩm</label>
                <input
                    id="q"
                    type="search"
                    maxLength={100}
                    value={search.data.q}
                    onChange={(event) =>
                        search.setData('q', event.target.value)
                    }
                />
                <button disabled={search.processing}>Tìm kiếm</button>
            </form>
            <Errors errors={search.errors} />
            {products.data.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Danh sách sản phẩm"
                    tabIndex={0}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Sản phẩm</th>
                                <th scope="col">Phân loại</th>
                                <th scope="col">Hiển thị</th>
                                <th scope="col" className="admin-number">
                                    Giá từ
                                </th>
                                <th scope="col" className="admin-number">
                                    Tồn kho
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.data.map((product) => (
                                <tr key={product.id}>
                                    <th scope="row">
                                        <Link
                                            href={
                                                '/admin/products/' +
                                                product.id +
                                                '/edit'
                                            }
                                        >
                                            {product.name}
                                        </Link>
                                        <small>
                                            {product.variants.length} biến thể
                                            {product.is_demo
                                                ? ' · Dữ liệu mẫu'
                                                : ''}
                                        </small>
                                    </th>
                                    <td>
                                        {product.brand?.name ?? 'Chưa có hãng'}
                                        <small>
                                            {product.category?.name ??
                                                'Chưa phân loại'}
                                        </small>
                                    </td>
                                    <td>
                                        {product.is_active
                                            ? 'Đang bán'
                                            : 'Đã ẩn'}
                                    </td>
                                    <td className="admin-number">
                                        {product.variants.length
                                            ? money(
                                                  Math.min(
                                                      ...product.variants.map(
                                                          (variant) =>
                                                              variant.price,
                                                      ),
                                                  ),
                                              )
                                            : '—'}
                                    </td>
                                    <td className="admin-number">
                                        {product.variants.reduce(
                                            (sum, variant) =>
                                                sum + variant.stock,
                                            0,
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="admin-empty">
                    Chưa có sản phẩm phù hợp. Thêm sản phẩm mới hoặc đổi từ
                    khóa.
                </p>
            )}
            <Pages page={products} />
            <section className="admin-taxonomies">
                <h2>Hãng và danh mục</h2>
                <p className="admin-muted">
                    Hiện có {brands.length} hãng, {categories.length} danh mục.
                    Tạo trước khi gán cho sản phẩm.
                </p>
                <div className="admin-two-columns">
                    <TaxonomyForm kind="brands" title="hãng" />
                    <TaxonomyForm kind="categories" title="danh mục" />
                </div>
            </section>
        </>
    );
}
