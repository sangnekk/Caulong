import { Head, Link, useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Errors, Field, PageHeader } from './shared';

type Item = {
    id: number;
    name: string;
    slug: string;
    products: number;
    active: number;
};

// "Vợt cầu lông" → "vot-cau-long": a suggestion the admin can still edit.
const slugify = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

function List({
    kind,
    title,
    noun,
    items,
    linkToProducts,
}: {
    kind: 'brands' | 'categories';
    title: string;
    noun: string;
    items: Item[];
    linkToProducts: boolean;
}) {
    const form = useForm({ name: '', slug: '' });
    // The slug follows the name until the admin types in it.
    const [slugEdited, setSlugEdited] = useState(false);
    return (
        <section
            className="admin-panel admin-panel-flush"
            aria-labelledby={kind + '-title'}
        >
            <div className="admin-section-heading">
                <h2 id={kind + '-title'}>
                    {title} ({items.length})
                </h2>
            </div>
            {items.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label={title}
                    tabIndex={0}
                >
                    <table className="admin-table-compact">
                        <thead>
                            <tr>
                                <th scope="col">Tên</th>
                                <th scope="col" className="admin-number">
                                    Đang bán
                                </th>
                                <th scope="col" className="admin-number">
                                    Tổng sản phẩm
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <th scope="row">
                                        {linkToProducts ? (
                                            <Link
                                                href={
                                                    '/admin/products?brand=' +
                                                    item.id
                                                }
                                            >
                                                {item.name}
                                            </Link>
                                        ) : (
                                            item.name
                                        )}
                                        <small>
                                            <code>{item.slug}</code>
                                        </small>
                                    </th>
                                    <td className="admin-number">
                                        {item.active}
                                    </td>
                                    <td className="admin-number">
                                        {item.products}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="admin-muted admin-panel-note">
                    Chưa có {noun} nào. Thêm ở bên dưới.
                </p>
            )}
            <form
                className="admin-taxonomy-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/admin/' + kind, {
                        preserveScroll: true,
                        onSuccess: () => {
                            form.reset();
                            setSlugEdited(false);
                        },
                    });
                }}
            >
                <Field
                    name={kind + '-name'}
                    label={'Tên ' + noun + ' mới'}
                    error={form.errors.name}
                >
                    <input
                        id={kind + '-name'}
                        required
                        maxLength={120}
                        value={form.data.name}
                        onChange={(event) => {
                            const name = event.target.value;
                            form.setData({
                                name,
                                slug: slugEdited
                                    ? form.data.slug
                                    : slugify(name),
                            });
                        }}
                        aria-invalid={!!form.errors.name}
                    />
                </Field>
                <Field
                    name={kind + '-slug'}
                    label="Đường dẫn"
                    error={form.errors.slug}
                >
                    <input
                        id={kind + '-slug'}
                        required
                        maxLength={160}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        title="Chữ thường không dấu, số và dấu gạch nối"
                        value={form.data.slug}
                        onChange={(event) => {
                            setSlugEdited(true);
                            form.setData('slug', event.target.value);
                        }}
                        aria-invalid={!!form.errors.slug}
                    />
                </Field>
                <button disabled={form.processing} data-busy={form.processing}>
                    <Plus aria-hidden="true" />
                    {form.processing ? 'Đang thêm…' : 'Thêm ' + noun}
                </button>
            </form>
            {Object.keys(form.errors).length > 0 && (
                <div className="admin-panel-note">
                    <Errors errors={form.errors} />
                </div>
            )}
        </section>
    );
}

export default function Taxonomies({
    brands,
    categories,
}: {
    brands: Item[];
    categories: Item[];
}) {
    return (
        <>
            <Head title="Hãng & danh mục" />
            <PageHeader
                title="Hãng & danh mục"
                description="Dùng để phân loại sản phẩm và làm bộ lọc ở cửa hàng. Cửa hàng chỉ hiện hãng, danh mục đang có hàng bán."
            />
            <div className="admin-two-columns">
                <List
                    kind="brands"
                    title="Hãng"
                    noun="hãng"
                    items={brands}
                    linkToProducts
                />
                <List
                    kind="categories"
                    title="Danh mục"
                    noun="danh mục"
                    items={categories}
                    linkToProducts={false}
                />
            </div>
        </>
    );
}
