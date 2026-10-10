'use client';

import { Head, Link, useForm } from '@/lib/page';
import type { FormEvent } from 'react';
import { Errors, Field, PageHeader } from './shared';

type ServiceString = {
    id: number;
    name: string;
    brand: string | null;
    gauge: string | null;
    /** Dong for the string of one racket. */
    price: number;
    is_active: boolean;
    /** As customers read it: brand, name, thickness. */
    label: string;
    /** Requests that asked for this string. */
    requests: number;
};
type Fields = {
    name: string;
    brand: string;
    gauge: string;
    price: number | '';
    is_active: boolean;
};

const amount = (value: string): number | '' =>
    value === '' ? '' : Math.max(0, Math.floor(Number(value)));

/** The fields of one string: the same for a new one and for one already in the list. */
function StringFields({
    form,
    prefix,
}: {
    form: ReturnType<typeof useForm<Fields>>;
    /** Keeps the ids of each row's fields apart. */
    prefix: string;
}) {
    const errors = form.errors as Record<string, string | undefined>;
    return (
        <div className="admin-form-grid">
            <Field name={prefix + 'name'} label="Tên dây" error={errors.name}>
                <input
                    id={prefix + 'name'}
                    required
                    maxLength={120}
                    value={form.data.name}
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                    aria-invalid={!!errors.name}
                />
            </Field>
            <Field name={prefix + 'brand'} label="Hãng" error={errors.brand}>
                <input
                    id={prefix + 'brand'}
                    maxLength={80}
                    value={form.data.brand}
                    onChange={(event) =>
                        form.setData('brand', event.target.value)
                    }
                    aria-invalid={!!errors.brand}
                />
            </Field>
            <Field name={prefix + 'gauge'} label="Cỡ dây" error={errors.gauge}>
                <input
                    id={prefix + 'gauge'}
                    maxLength={20}
                    placeholder="0.68 mm"
                    value={form.data.gauge}
                    onChange={(event) =>
                        form.setData('gauge', event.target.value)
                    }
                    aria-invalid={!!errors.gauge}
                />
            </Field>
            <Field
                name={prefix + 'price'}
                label="Giá dây cho một cây (₫)"
                error={errors.price}
            >
                <input
                    id={prefix + 'price'}
                    type="number"
                    inputMode="numeric"
                    required
                    min={0}
                    step={1000}
                    value={form.data.price}
                    onChange={(event) =>
                        form.setData('price', amount(event.target.value))
                    }
                    aria-invalid={!!errors.price}
                />
            </Field>
        </div>
    );
}

function Row({ string }: { string: ServiceString }) {
    const form = useForm<Fields>({
        name: string.name,
        brand: string.brand ?? '',
        gauge: string.gauge ?? '',
        price: string.price,
        is_active: string.is_active,
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/admin/service-strings/' + string.id, {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };
    return (
        <li className="admin-panel">
            <form onSubmit={submit} aria-label={'Sửa dây ' + string.label}>
                <div className="admin-section-heading">
                    <h3>
                        {string.label}{' '}
                        {!string.is_active && (
                            <span className="admin-badge">Tạm ngưng</span>
                        )}
                    </h3>
                    <span className="admin-muted">
                        {string.requests > 0
                            ? string.requests + ' yêu cầu đã chọn'
                            : 'Chưa có yêu cầu nào chọn'}
                    </span>
                </div>
                <StringFields
                    form={form}
                    prefix={'string-' + string.id + '-'}
                />
                <div className="admin-string-actions">
                    <label className="admin-check">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(event) =>
                                form.setData('is_active', event.target.checked)
                            }
                        />
                        Đang dùng (khách chọn được)
                    </label>
                    <button
                        type="submit"
                        className="admin-button-secondary"
                        disabled={form.processing || !form.isDirty}
                        data-busy={form.processing}
                    >
                        {form.processing ? 'Đang lưu…' : 'Lưu'}
                    </button>
                </div>
            </form>
        </li>
    );
}

export default function ServiceStrings({
    strings,
}: {
    strings: ServiceString[];
}) {
    const form = useForm<Fields>({
        name: '',
        brand: '',
        gauge: '',
        price: '',
        is_active: true,
    });
    const add = (event: FormEvent) => {
        event.preventDefault();
        form.post('/admin/service-strings', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title="Dây đan" />
            <PageHeader
                back={{ href: '/admin/service-orders', label: 'Đan dây' }}
                title="Dây đan và giá"
                description={
                    <>
                        Các loại dây cửa hàng dùng để đan cho khách, mỗi loại
                        một giá cho một cây vợt. Phí công đan đặt ở{' '}
                        <Link href="/admin/settings">Cài đặt</Link>. Dây ở đây
                        không phải sản phẩm bán lẻ và không tính tồn kho.
                    </>
                }
            />

            <section className="admin-panel" aria-labelledby="add-title">
                <h2 id="add-title">Thêm dây</h2>
                <Errors errors={form.errors} />
                <form onSubmit={add}>
                    <StringFields form={form} prefix="new-" />
                    <div className="admin-string-actions">
                        <button
                            type="submit"
                            className="admin-button"
                            disabled={form.processing}
                            data-busy={form.processing}
                        >
                            {form.processing ? 'Đang thêm…' : 'Thêm dây'}
                        </button>
                    </div>
                </form>
            </section>

            <h2 className="admin-list-title">
                Danh sách dây ({strings.length})
            </h2>
            {strings.length ? (
                <ul className="admin-string-list">
                    {strings.map((string) => (
                        // Saved values come back as new props: the row starts over from them.
                        <Row
                            key={
                                string.id +
                                ':' +
                                string.label +
                                ':' +
                                string.price +
                                ':' +
                                string.is_active
                            }
                            string={string}
                        />
                    ))}
                </ul>
            ) : (
                <div className="admin-empty">
                    <strong>Chưa có loại dây nào.</strong>
                    Khi chưa có dây, khách chỉ đặt được dịch vụ đan với dây họ
                    tự mang tới.
                </div>
            )}
        </>
    );
}
