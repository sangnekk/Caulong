import { Head, Link, useForm } from '@inertiajs/react';
import type { ChangeEvent, FormEvent } from 'react';
import { Errors, Field } from './shared';
import type { Product, Taxonomy, Variant } from './shared';

type FormVariant = Variant & { expected_stock: number };
type FormData = {
    name: string;
    slug: string;
    description: string;
    brand_id: number | '';
    category_id: number | '';
    play_style: string;
    skill_level: string;
    is_active: boolean;
    is_featured: boolean;
    is_demo: boolean;
    specs: Record<string, string>;
    variants: FormVariant[];
    image: File | null;
};
const specLabels: Record<string, string> = {
    weight: 'Trọng lượng',
    balance: 'Điểm cân bằng',
    stiffness: 'Độ cứng',
    material: 'Vật liệu',
    max_tension: 'Sức căng tối đa',
};
const emptyVariant = (): FormVariant => ({
    id: 0,
    sku: '',
    name: '',
    price: 0,
    stock: 0,
    expected_stock: 0,
    is_active: true,
});

function initial(product: Product | null): FormData {
    return {
        name: product?.name ?? '',
        slug: product?.slug ?? '',
        description: product?.description ?? '',
        brand_id: product?.brand_id ?? '',
        category_id: product?.category_id ?? '',
        play_style: product?.play_style ?? 'balanced',
        skill_level: product?.skill_level ?? 'all',
        is_active: product?.is_active ?? false,
        is_featured: product?.is_featured ?? false,
        is_demo: product?.is_demo ?? false,
        specs: {
            weight: '',
            balance: '',
            stiffness: '',
            material: '',
            max_tension: '',
            ...product?.specs,
        },
        variants: product?.variants?.map((v) => ({
            ...v,
            expected_stock: v.stock,
        })) ?? [emptyVariant()],
        image: null,
    };
}

export default function ProductForm({
    product,
    brands,
    categories,
}: {
    product: Product | null;
    brands: Taxonomy[];
    categories: Taxonomy[];
}) {
    const form = useForm<FormData>(initial(product));
    const updateVariant = (
        index: number,
        key: keyof FormVariant,
        value: string | number | boolean,
    ) =>
        form.setData(
            'variants',
            form.data.variants.map((variant, i) =>
                i === index ? { ...variant, [key]: value } : variant,
            ),
        );
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const url = product
            ? '/admin/products/' + product.id
            : '/admin/products';
        const options = { forceFormData: true, preserveScroll: true };
        if (product) {
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(url, options);
        } else form.post(url, options);
    };
    const imageChange = (event: ChangeEvent<HTMLInputElement>) =>
        form.setData('image', event.target.files?.[0] ?? null);
    return (
        <>
            <Head title={product ? 'Sửa ' + product.name : 'Thêm sản phẩm'} />
            <div className="admin-heading">
                <div>
                    <Link href="/admin/products" className="admin-back">
                        ← Sản phẩm
                    </Link>
                    <h1>{product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h1>
                </div>
            </div>
            <Errors errors={form.errors} />
            <form
                className="admin-product-form"
                onSubmit={submit}
                encType="multipart/form-data"
            >
                <section className="admin-form-section">
                    <h2>Thông tin cơ bản</h2>
                    <div className="admin-form-grid">
                        <Field
                            name="name"
                            label="Tên sản phẩm"
                            error={form.errors.name}
                        >
                            <input
                                id="name"
                                required
                                maxLength={160}
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                                aria-invalid={!!form.errors.name}
                            />
                        </Field>
                        <Field
                            name="slug"
                            label="Đường dẫn"
                            error={form.errors.slug}
                        >
                            <input
                                id="slug"
                                required
                                maxLength={180}
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                value={form.data.slug}
                                onChange={(e) =>
                                    form.setData('slug', e.target.value)
                                }
                                aria-describedby="slug-help"
                                aria-invalid={!!form.errors.slug}
                            />
                            <small id="slug-help">
                                Chữ thường không dấu, số, dấu gạch nối.
                            </small>
                        </Field>
                        <Field
                            name="brand_id"
                            label="Hãng"
                            error={form.errors.brand_id}
                        >
                            <select
                                id="brand_id"
                                value={form.data.brand_id}
                                onChange={(e) =>
                                    form.setData(
                                        'brand_id',
                                        e.target.value
                                            ? Number(e.target.value)
                                            : '',
                                    )
                                }
                            >
                                <option value="">Chưa chọn</option>
                                {brands.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            name="category_id"
                            label="Danh mục"
                            error={form.errors.category_id}
                        >
                            <select
                                id="category_id"
                                value={form.data.category_id}
                                onChange={(e) =>
                                    form.setData(
                                        'category_id',
                                        e.target.value
                                            ? Number(e.target.value)
                                            : '',
                                    )
                                }
                            >
                                <option value="">Chưa chọn</option>
                                {categories.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <Field
                        name="description"
                        label="Mô tả"
                        error={form.errors.description}
                    >
                        <textarea
                            id="description"
                            required
                            maxLength={20000}
                            rows={5}
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                    </Field>
                </section>
                <section className="admin-form-section">
                    <h2>Phân loại sản phẩm</h2>
                    <div className="admin-form-grid">
                        <Field name="play_style" label="Lối chơi">
                            <select
                                id="play_style"
                                value={form.data.play_style}
                                onChange={(e) =>
                                    form.setData('play_style', e.target.value)
                                }
                            >
                                <option value="attack">Công</option>
                                <option value="speed">Tốc độ</option>
                                <option value="balanced">Cân bằng</option>
                            </select>
                        </Field>
                        <Field name="skill_level" label="Trình độ">
                            <select
                                id="skill_level"
                                value={form.data.skill_level}
                                onChange={(e) =>
                                    form.setData('skill_level', e.target.value)
                                }
                            >
                                <option value="all">Mọi trình độ</option>
                                <option value="beginner">Mới chơi</option>
                                <option value="intermediate">Trung cấp</option>
                                <option value="advanced">Nâng cao</option>
                            </select>
                        </Field>
                    </div>
                    <div className="admin-checks">
                        <label>
                            <input
                                type="checkbox"
                                checked={form.data.is_active}
                                onChange={(e) =>
                                    form.setData('is_active', e.target.checked)
                                }
                            />{' '}
                            Đang bán
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={form.data.is_featured}
                                onChange={(e) =>
                                    form.setData(
                                        'is_featured',
                                        e.target.checked,
                                    )
                                }
                            />{' '}
                            Nổi bật
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={form.data.is_demo}
                                onChange={(e) =>
                                    form.setData('is_demo', e.target.checked)
                                }
                            />{' '}
                            Dữ liệu mẫu
                        </label>
                    </div>
                </section>
                <section className="admin-form-section">
                    <h2>Ảnh sản phẩm</h2>
                    {product?.image_url && (
                        <img
                            className="admin-product-preview"
                            src={product.image_url}
                            alt={'Ảnh ' + product.name}
                        />
                    )}
                    <Field
                        name="image"
                        label="Ảnh mới (không bắt buộc)"
                        error={form.errors.image}
                    >
                        <input
                            id="image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={imageChange}
                            aria-describedby="image-help"
                        />
                        <small id="image-help">
                            JPEG, PNG hoặc WebP, tối đa 5 MB.
                        </small>
                    </Field>
                </section>
                <section className="admin-form-section">
                    <div className="admin-section-heading">
                        <div>
                            <h2>Biến thể và tồn kho</h2>
                            <p className="admin-muted">
                                Tồn kho được đối chiếu với lúc mở trang. Không
                                xóa biến thể khi bỏ khỏi biểu mẫu.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="admin-button admin-button-secondary"
                            onClick={() =>
                                form.setData('variants', [
                                    ...form.data.variants,
                                    emptyVariant(),
                                ])
                            }
                        >
                            + Thêm biến thể
                        </button>
                    </div>
                    <div className="admin-variants">
                        {form.data.variants.map((variant, index) => (
                            <fieldset
                                className="admin-variant"
                                key={variant.id || 'new-' + index}
                            >
                                <legend>Biến thể {index + 1}</legend>
                                <input
                                    type="hidden"
                                    name={'variants[' + index + '][id]'}
                                    value={variant.id || ''}
                                />
                                <input
                                    type="hidden"
                                    name={
                                        'variants[' +
                                        index +
                                        '][expected_stock]'
                                    }
                                    value={variant.expected_stock}
                                />
                                <Field
                                    name={'variants.' + index + '.sku'}
                                    label="SKU"
                                    error={
                                        (
                                            form.errors as Record<
                                                string,
                                                string | undefined
                                            >
                                        )['variants.' + index + '.sku']
                                    }
                                >
                                    <input
                                        id={'variant-' + index + '-sku'}
                                        required
                                        maxLength={80}
                                        value={variant.sku}
                                        onChange={(e) =>
                                            updateVariant(
                                                index,
                                                'sku',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    name={'variants.' + index + '.name'}
                                    label="Tên biến thể"
                                    error={
                                        (
                                            form.errors as Record<
                                                string,
                                                string | undefined
                                            >
                                        )['variants.' + index + '.name']
                                    }
                                >
                                    <input
                                        id={'variant-' + index + '-name'}
                                        required
                                        maxLength={120}
                                        value={variant.name}
                                        onChange={(e) =>
                                            updateVariant(
                                                index,
                                                'name',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    name={'variants.' + index + '.price'}
                                    label="Giá (VND)"
                                    error={
                                        (
                                            form.errors as Record<
                                                string,
                                                string | undefined
                                            >
                                        )['variants.' + index + '.price']
                                    }
                                >
                                    <input
                                        id={'variant-' + index + '-price'}
                                        required
                                        type="number"
                                        min="0"
                                        max="1000000000"
                                        step="1"
                                        value={variant.price}
                                        onChange={(e) =>
                                            updateVariant(
                                                index,
                                                'price',
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    name={'variants.' + index + '.stock'}
                                    label="Tồn kho"
                                    error={
                                        (
                                            form.errors as Record<
                                                string,
                                                string | undefined
                                            >
                                        )['variants.' + index + '.stock']
                                    }
                                >
                                    <input
                                        id={'variant-' + index + '-stock'}
                                        required
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        step="1"
                                        value={variant.stock}
                                        onChange={(e) =>
                                            updateVariant(
                                                index,
                                                'stock',
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                    <small>
                                        Giá trị ban đầu:{' '}
                                        {variant.expected_stock}
                                    </small>
                                </Field>
                                <label className="admin-variant-active">
                                    <input
                                        type="checkbox"
                                        checked={variant.is_active}
                                        onChange={(e) =>
                                            updateVariant(
                                                index,
                                                'is_active',
                                                e.target.checked,
                                            )
                                        }
                                    />{' '}
                                    Đang bán
                                </label>
                            </fieldset>
                        ))}
                    </div>
                </section>
                <section className="admin-form-section">
                    <h2>Thông số kỹ thuật</h2>
                    <div className="admin-form-grid">
                        {Object.entries(specLabels).map(([key, label]) => (
                            <Field
                                key={key}
                                name={'specs.' + key}
                                label={label}
                            >
                                <input
                                    id={'spec-' + key}
                                    maxLength={200}
                                    value={form.data.specs[key] ?? ''}
                                    onChange={(e) =>
                                        form.setData('specs', {
                                            ...form.data.specs,
                                            [key]: e.target.value,
                                        })
                                    }
                                />
                            </Field>
                        ))}
                    </div>
                </section>
                <div className="admin-form-actions">
                    <Link
                        href="/admin/products"
                        className="admin-button admin-button-secondary"
                    >
                        Hủy
                    </Link>
                    <button className="admin-button" disabled={form.processing}>
                        {form.processing ? 'Đang lưu…' : 'Lưu sản phẩm'}
                    </button>
                </div>
            </form>
        </>
    );
}
