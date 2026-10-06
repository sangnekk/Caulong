'use client';

import { Head, Link, router, useForm } from '@/lib/page';
import { send } from '@/lib/page/http';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { couponTerms, Errors, Field, PageHeader, segments } from './shared';

type Named = { id: number; name: string };
type Customer = { id: number; name: string; email: string };
type Coupon = {
    id: number;
    code: string;
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    min_order: number;
    max_discount: number | null;
    usage_limit: number | null;
    per_customer_limit: number | null;
    segment: string | null;
    campaign: string | null;
    is_active: boolean;
    starts_on: string;
    expires_on: string;
    customer: Customer | null;
    products: Named[];
    category_ids: number[];
    /** Orders that used it. */
    used: number;
};
type Fields = {
    code: string;
    name: string;
    type: 'percent' | 'fixed';
    value: number | '';
    min_order: number | '';
    max_discount: number | '';
    starts_on: string;
    expires_on: string;
    usage_limit: number | '';
    per_customer_limit: number | '';
    audience: 'all' | 'customer' | 'segment';
    customer_email: string;
    segment: string;
    campaign: string;
    category_ids: number[];
    product_ids: number[];
    is_active: boolean;
};

const amount = (value: string): number | '' =>
    value === '' ? '' : Math.max(0, Math.floor(Number(value)));

/** Searches products as the admin types and adds the ones picked to the list. */
function ProductPicker({
    picked,
    onChange,
}: {
    picked: Named[];
    onChange: (products: Named[]) => void;
}) {
    const [q, setQ] = useState('');
    const [found, setFound] = useState<{ q: string; items: Named[] } | null>(
        null,
    );
    const term = q.trim();
    useEffect(() => {
        if (term.length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            send(
                'get',
                '/admin/coupons/products',
                { q: term },
                { expects: 'json', signal: controller.signal },
            )
                .then((response) =>
                    response.ok ? (response.json() as Promise<Named[]>) : [],
                )
                .then((items) => setFound({ q: term, items }))
                .catch(() => {});
        }, 300);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [term]);
    const results =
        term.length >= 2 && found?.q === term
            ? found.items.filter(
                  (item) => !picked.some((product) => product.id === item.id),
              )
            : null;

    return (
        <div className="admin-picker">
            <label htmlFor="product-search">Chỉ các sản phẩm</label>
            <input
                id="product-search"
                type="search"
                value={q}
                maxLength={100}
                autoComplete="off"
                placeholder="Gõ tên hoặc mã hàng (SKU) để tìm"
                onChange={(event) => setQ(event.target.value)}
            />
            {results &&
                (results.length ? (
                    <ul className="admin-picker-results">
                        {results.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    className="admin-button-ghost"
                                    onClick={() => {
                                        onChange([...picked, item]);
                                        setQ('');
                                    }}
                                >
                                    Thêm · {item.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="admin-muted" role="status">
                        Không tìm thấy sản phẩm nào khác khớp “{term}”.
                    </p>
                ))}
            {picked.length > 0 && (
                <ul className="admin-picker-chosen">
                    {picked.map((product) => (
                        <li key={product.id}>
                            {product.name}
                            <button
                                type="button"
                                className="admin-button-ghost"
                                aria-label={'Bỏ ' + product.name}
                                onClick={() =>
                                    onChange(
                                        picked.filter(
                                            (item) => item.id !== product.id,
                                        ),
                                    )
                                }
                            >
                                <X aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function CouponForm({
    coupon,
    customer,
    suggestedCode,
    categories,
    segments: segmentKeys,
}: {
    coupon: Coupon | null;
    /** Create only: the customer whose page the admin came from. */
    customer: Customer | null;
    /** Create only: a random code nobody can guess. */
    suggestedCode: string | null;
    categories: Named[];
    segments: string[];
}) {
    const owner = coupon?.customer ?? customer;
    const form = useForm<Fields>({
        // A coupon for one customer starts with a code nobody else could guess.
        code: coupon?.code ?? (customer ? (suggestedCode ?? '') : ''),
        name: coupon?.name ?? '',
        type: coupon?.type ?? 'percent',
        value: coupon?.value ?? '',
        min_order: coupon?.min_order || '',
        max_discount: coupon?.max_discount ?? '',
        starts_on: coupon?.starts_on ?? '',
        expires_on: coupon?.expires_on ?? '',
        usage_limit: coupon ? (coupon.usage_limit ?? '') : customer ? 1 : '',
        per_customer_limit: coupon ? (coupon.per_customer_limit ?? '') : 1,
        audience: owner ? 'customer' : coupon?.segment ? 'segment' : 'all',
        customer_email: owner?.email ?? '',
        segment: coupon?.segment ?? '',
        campaign: coupon?.campaign ?? '',
        category_ids: coupon?.category_ids ?? [],
        product_ids: coupon?.products.map((product) => product.id) ?? [],
        is_active: coupon?.is_active ?? true,
    });
    const [products, setProducts] = useState<Named[]>(coupon?.products ?? []);
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState('');
    const data = form.data;
    const errors = form.errors as Record<string, string | undefined>;
    const percent = data.type === 'percent';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        // A new coupon lands on its own edit page, with this form as it was just saved.
        const saved = { onSuccess: () => form.setDefaults() };
        if (coupon)
            form.put('/admin/coupons/' + coupon.id, {
                preserveScroll: true,
                ...saved,
            });
        else form.post('/admin/coupons', saved);
    };
    const remove = () => {
        if (!coupon || !window.confirm('Xóa mã ' + coupon.code + '?')) return;
        setRemoving(true);
        setRemoveError('');
        router.delete('/admin/coupons/' + coupon.id, {
            onError: (failed) =>
                setRemoveError(failed.coupon ?? 'Chưa xóa được mã.'),
            onFinish: () => setRemoving(false),
        });
    };
    const preview =
        data.value !== '' && data.value > 0
            ? couponTerms({
                  type: data.type,
                  value: data.value,
                  max_discount: percent ? data.max_discount || null : null,
                  min_order: data.min_order || 0,
              })
            : null;

    return (
        <>
            <Head title={coupon ? 'Mã ' + coupon.code : 'Tạo mã giảm giá'} />
            <PageHeader
                back={{ href: '/admin/coupons', label: 'Mã giảm giá' }}
                title={coupon ? 'Mã ' + coupon.code : 'Tạo mã giảm giá'}
                description={
                    coupon
                        ? coupon.used > 0
                            ? 'Đã dùng trong ' +
                              coupon.used +
                              ' đơn. Đơn đã đặt giữ nguyên số tiền đã giảm dù bạn sửa mã.'
                            : 'Chưa có đơn nào dùng mã này.'
                        : 'Khách nhập mã ở giỏ hàng. Mức giảm tính trên tiền hàng, không tính phí giao.'
                }
            />
            <Errors errors={{ ...errors, remove: removeError || undefined }} />
            <form onSubmit={submit} noValidate>
                <section
                    className="admin-form-section"
                    aria-labelledby="coupon-terms"
                >
                    <h2 id="coupon-terms">Mã và mức giảm</h2>
                    <div className="admin-form-grid">
                        <Field name="code" label="Mã" error={errors.code}>
                            <input
                                id="code"
                                required
                                maxLength={40}
                                autoComplete="off"
                                spellCheck={false}
                                value={data.code}
                                onChange={(event) =>
                                    form.setData(
                                        'code',
                                        event.target.value.toUpperCase(),
                                    )
                                }
                                aria-invalid={!!errors.code}
                                aria-describedby="code-help"
                            />
                            <small id="code-help">
                                Chữ không dấu, số, gạch ngang. Khách gõ hoa hay
                                thường đều được.
                                {suggestedCode &&
                                    data.code !== suggestedCode && (
                                        <>
                                            {' '}
                                            <button
                                                type="button"
                                                className="admin-link-button"
                                                onClick={() =>
                                                    form.setData(
                                                        'code',
                                                        suggestedCode,
                                                    )
                                                }
                                            >
                                                Dùng mã ngẫu nhiên{' '}
                                                {suggestedCode}
                                            </button>
                                        </>
                                    )}
                            </small>
                        </Field>
                        <Field
                            name="name"
                            label="Tên khách nhìn thấy"
                            error={errors.name}
                        >
                            <input
                                id="name"
                                required
                                maxLength={120}
                                placeholder="Giảm 10% cho đơn đầu tiên"
                                value={data.name}
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                                aria-invalid={!!errors.name}
                            />
                        </Field>
                        <Field
                            name="type"
                            label="Cách giảm"
                            error={errors.type}
                        >
                            <select
                                id="type"
                                value={data.type}
                                onChange={(event) =>
                                    form.setData(
                                        'type',
                                        event.target.value as Fields['type'],
                                    )
                                }
                            >
                                <option value="percent">
                                    Theo phần trăm tiền hàng
                                </option>
                                <option value="fixed">Một số tiền</option>
                            </select>
                        </Field>
                        <Field
                            name="value"
                            label={percent ? 'Giảm (%)' : 'Giảm (₫)'}
                            error={errors.value}
                        >
                            <input
                                id="value"
                                type="number"
                                inputMode="numeric"
                                required
                                min={1}
                                max={percent ? 100 : undefined}
                                step={percent ? 1 : 1000}
                                value={data.value}
                                onChange={(event) =>
                                    form.setData(
                                        'value',
                                        amount(event.target.value),
                                    )
                                }
                                aria-invalid={!!errors.value}
                            />
                        </Field>
                        {percent && (
                            <Field
                                name="max_discount"
                                label="Giảm tối đa (₫)"
                                error={errors.max_discount}
                            >
                                <input
                                    id="max_discount"
                                    type="number"
                                    inputMode="numeric"
                                    min={1000}
                                    step={1000}
                                    placeholder="Không giới hạn"
                                    value={data.max_discount}
                                    onChange={(event) =>
                                        form.setData(
                                            'max_discount',
                                            amount(event.target.value),
                                        )
                                    }
                                    aria-invalid={!!errors.max_discount}
                                />
                            </Field>
                        )}
                        <Field
                            name="min_order"
                            label="Cho đơn có tiền hàng từ (₫)"
                            error={errors.min_order}
                        >
                            <input
                                id="min_order"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={10000}
                                placeholder="Không yêu cầu"
                                value={data.min_order}
                                onChange={(event) =>
                                    form.setData(
                                        'min_order',
                                        amount(event.target.value),
                                    )
                                }
                                aria-invalid={!!errors.min_order}
                            />
                        </Field>
                    </div>
                    {preview && (
                        <p className="admin-lead" aria-live="polite">
                            Khách sẽ thấy: <strong>{preview}</strong>.
                        </p>
                    )}
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="coupon-audience"
                >
                    <h2 id="coupon-audience">Ai được dùng</h2>
                    <div
                        className="admin-checks"
                        role="radiogroup"
                        aria-labelledby="coupon-audience"
                    >
                        {(
                            [
                                ['all', 'Mọi khách'],
                                ['customer', 'Riêng một khách hàng'],
                                ['segment', 'Một nhóm khách hàng'],
                            ] as const
                        ).map(([value, label]) => (
                            <label key={value}>
                                <input
                                    type="radio"
                                    name="audience"
                                    value={value}
                                    checked={data.audience === value}
                                    onChange={() =>
                                        form.setData('audience', value)
                                    }
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                    {data.audience === 'customer' && (
                        <Field
                            name="customer_email"
                            label="Email tài khoản của khách"
                            error={errors.customer_email}
                        >
                            <input
                                id="customer_email"
                                type="email"
                                required
                                maxLength={190}
                                autoComplete="off"
                                value={data.customer_email}
                                onChange={(event) =>
                                    form.setData(
                                        'customer_email',
                                        event.target.value,
                                    )
                                }
                                aria-invalid={!!errors.customer_email}
                                aria-describedby="customer_email-help"
                            />
                            <small id="customer_email-help">
                                {owner && owner.email === data.customer_email
                                    ? owner.name +
                                      '. Chỉ tài khoản này dùng được mã, khi đã đăng nhập.'
                                    : 'Chỉ tài khoản này dùng được mã, khi đã đăng nhập.'}
                            </small>
                        </Field>
                    )}
                    {data.audience === 'segment' && (
                        <Field
                            name="segment"
                            label="Nhóm khách hàng"
                            error={errors.segment}
                        >
                            <select
                                id="segment"
                                required
                                value={data.segment}
                                onChange={(event) =>
                                    form.setData('segment', event.target.value)
                                }
                                aria-invalid={!!errors.segment}
                                aria-describedby="segment-help"
                            >
                                <option value="">Chọn nhóm</option>
                                {segmentKeys.map((key) => (
                                    <option key={key} value={key}>
                                        {segments[key]?.[0] ?? key}
                                    </option>
                                ))}
                            </select>
                            <small id="segment-help">
                                Khách phải đăng nhập và đang thuộc nhóm này lúc
                                dùng mã. Ngưỡng của từng nhóm ở{' '}
                                <Link href="/admin/settings">Cài đặt</Link>.
                            </small>
                        </Field>
                    )}
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="coupon-limits"
                >
                    <h2 id="coupon-limits">Thời gian và giới hạn</h2>
                    <div className="admin-form-grid">
                        <Field
                            name="starts_on"
                            label="Dùng được từ ngày"
                            error={errors.starts_on}
                        >
                            <input
                                id="starts_on"
                                type="date"
                                value={data.starts_on}
                                onChange={(event) =>
                                    form.setData(
                                        'starts_on',
                                        event.target.value,
                                    )
                                }
                                aria-invalid={!!errors.starts_on}
                            />
                            <small>Để trống: dùng được ngay.</small>
                        </Field>
                        <Field
                            name="expires_on"
                            label="Đến hết ngày"
                            error={errors.expires_on}
                        >
                            <input
                                id="expires_on"
                                type="date"
                                min={data.starts_on || undefined}
                                value={data.expires_on}
                                onChange={(event) =>
                                    form.setData(
                                        'expires_on',
                                        event.target.value,
                                    )
                                }
                                aria-invalid={!!errors.expires_on}
                            />
                            <small>Để trống: không hết hạn.</small>
                        </Field>
                        <Field
                            name="usage_limit"
                            label="Tổng số đơn được dùng"
                            error={errors.usage_limit}
                        >
                            <input
                                id="usage_limit"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                placeholder="Không giới hạn"
                                value={data.usage_limit}
                                onChange={(event) =>
                                    form.setData(
                                        'usage_limit',
                                        amount(event.target.value),
                                    )
                                }
                                aria-invalid={!!errors.usage_limit}
                            />
                        </Field>
                        <Field
                            name="per_customer_limit"
                            label="Số đơn mỗi khách được dùng"
                            error={errors.per_customer_limit}
                        >
                            <input
                                id="per_customer_limit"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                placeholder="Không giới hạn"
                                value={data.per_customer_limit}
                                onChange={(event) =>
                                    form.setData(
                                        'per_customer_limit',
                                        amount(event.target.value),
                                    )
                                }
                                aria-invalid={!!errors.per_customer_limit}
                                aria-describedby="per_customer_limit-help"
                            />
                            <small id="per_customer_limit-help">
                                Tính theo tài khoản, và theo số điện thoại nhận
                                hàng với khách không đăng nhập.
                            </small>
                        </Field>
                        <Field
                            name="campaign"
                            label="Chiến dịch"
                            error={errors.campaign}
                        >
                            <input
                                id="campaign"
                                maxLength={80}
                                placeholder="Ví dụ: Khai trương tháng 10"
                                value={data.campaign}
                                onChange={(event) =>
                                    form.setData('campaign', event.target.value)
                                }
                                aria-invalid={!!errors.campaign}
                            />
                            <small>
                                Chỉ để bạn gom và tìm các mã cùng đợt; khách
                                không thấy.
                            </small>
                        </Field>
                    </div>
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="coupon-products"
                >
                    <h2 id="coupon-products">Sản phẩm được giảm</h2>
                    <p className="admin-lead">
                        Để trống cả hai: mã tính trên mọi sản phẩm thật trong
                        giỏ. Chọn danh mục hoặc sản phẩm thì mã chỉ tính trên
                        các món đó.
                    </p>
                    {categories.length > 0 && (
                        <fieldset className="admin-fieldset">
                            <legend>Chỉ các danh mục</legend>
                            <div className="admin-checks">
                                {categories.map((category) => (
                                    <label key={category.id}>
                                        <input
                                            type="checkbox"
                                            checked={data.category_ids.includes(
                                                category.id,
                                            )}
                                            onChange={(event) =>
                                                form.setData(
                                                    'category_ids',
                                                    event.target.checked
                                                        ? [
                                                              ...data.category_ids,
                                                              category.id,
                                                          ]
                                                        : data.category_ids.filter(
                                                              (id) =>
                                                                  id !==
                                                                  category.id,
                                                          ),
                                                )
                                            }
                                        />
                                        {category.name}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}
                    <ProductPicker
                        picked={products}
                        onChange={(next) => {
                            setProducts(next);
                            form.setData(
                                'product_ids',
                                next.map((product) => product.id),
                            );
                        }}
                    />
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="coupon-state"
                >
                    <h2 id="coupon-state">Trạng thái</h2>
                    <label className="admin-check">
                        <input
                            type="checkbox"
                            checked={data.is_active}
                            onChange={(event) =>
                                form.setData('is_active', event.target.checked)
                            }
                        />
                        Đang bật: khách dùng được mã trong thời gian hiệu lực
                    </label>
                </section>

                <div className="admin-form-actions">
                    {coupon && (
                        <button
                            type="button"
                            className="admin-button-danger"
                            disabled={removing || form.processing}
                            data-busy={removing}
                            onClick={remove}
                        >
                            Xóa mã
                        </button>
                    )}
                    <span className="admin-form-hint" aria-live="polite">
                        {form.isDirty
                            ? 'Có thay đổi chưa lưu.'
                            : coupon
                              ? 'Chưa có thay đổi.'
                              : ''}
                    </span>
                    <button
                        type="submit"
                        className="admin-button"
                        disabled={form.processing}
                        data-busy={form.processing}
                    >
                        {form.processing
                            ? 'Đang lưu…'
                            : coupon
                              ? 'Lưu mã'
                              : 'Tạo mã'}
                    </button>
                </div>
            </form>
        </>
    );
}
