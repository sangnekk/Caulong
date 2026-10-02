import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { Errors, Field, money, PageHeader } from './shared';

type Settings = {
    shipping_fee: number;
    free_shipping_threshold: number;
    hotline: string;
    contact_email: string;
    contact_address: string;
    contact_chat_url: string;
};

/** What a customer pays for delivery at a given cart value, under the settings being edited. */
const feeFor = (subtotal: number, settings: Settings) =>
    settings.free_shipping_threshold > 0 &&
    subtotal >= settings.free_shipping_threshold
        ? 0
        : settings.shipping_fee;

export default function ShopSettings({ settings }: { settings: Settings }) {
    const form = useForm<Settings>(settings);
    const data = form.data;
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/admin/settings', {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };
    const amount =
        (key: 'shipping_fee' | 'free_shipping_threshold') => (value: string) =>
            form.setData(key, value === '' ? 0 : Math.max(0, Number(value)));
    // A worked example the owner can check: one cart just under the threshold, one at it.
    const below = data.free_shipping_threshold
        ? Math.max(
              data.free_shipping_threshold - 100000,
              Math.round(data.free_shipping_threshold / 2),
          )
        : 800000;

    return (
        <>
            <Head title="Cài đặt cửa hàng" />
            <PageHeader
                title="Cài đặt cửa hàng"
                description="Phí giao hàng và thông tin liên hệ khách nhìn thấy. Lưu xong là áp dụng ngay cho giỏ hàng và đơn mới; đơn đã đặt giữ nguyên số tiền cũ."
            />
            <Errors errors={form.errors} />
            <form onSubmit={submit} noValidate>
                <section
                    className="admin-form-section"
                    aria-labelledby="shipping-title"
                >
                    <h2 id="shipping-title">Giao hàng</h2>
                    <div className="admin-form-grid">
                        <Field
                            name="shipping_fee"
                            label="Phí giao hàng (₫)"
                            error={form.errors.shipping_fee}
                        >
                            <input
                                id="shipping_fee"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={5000000}
                                step={1000}
                                required
                                value={data.shipping_fee}
                                onChange={(e) =>
                                    amount('shipping_fee')(e.target.value)
                                }
                                aria-describedby="shipping_fee-help"
                                aria-invalid={!!form.errors.shipping_fee}
                            />
                            <small id="shipping_fee-help">
                                {data.shipping_fee
                                    ? money(data.shipping_fee) + ' mỗi đơn.'
                                    : 'Để 0: mọi đơn đều miễn phí giao.'}
                            </small>
                        </Field>
                        <Field
                            name="free_shipping_threshold"
                            label="Miễn phí giao cho đơn từ (₫)"
                            error={form.errors.free_shipping_threshold}
                        >
                            <input
                                id="free_shipping_threshold"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={10000}
                                required
                                value={data.free_shipping_threshold}
                                onChange={(e) =>
                                    amount('free_shipping_threshold')(
                                        e.target.value,
                                    )
                                }
                                aria-describedby="free_shipping_threshold-help"
                                aria-invalid={
                                    !!form.errors.free_shipping_threshold
                                }
                            />
                            <small id="free_shipping_threshold-help">
                                {data.free_shipping_threshold
                                    ? 'Tiền hàng từ ' +
                                      money(data.free_shipping_threshold) +
                                      ' được miễn phí giao.'
                                    : 'Để 0: không miễn phí theo giá trị đơn.'}
                            </small>
                        </Field>
                    </div>
                    <div className="admin-example" aria-live="polite">
                        <strong>Ví dụ với cài đặt này</strong>
                        <dl>
                            <div>
                                <dt>Tiền hàng {money(below)}</dt>
                                <dd>
                                    {feeFor(below, data)
                                        ? 'Phí giao ' +
                                          money(feeFor(below, data))
                                        : 'Miễn phí giao'}
                                </dd>
                            </div>
                            {data.free_shipping_threshold > 0 && (
                                <div>
                                    <dt>
                                        Tiền hàng{' '}
                                        {money(data.free_shipping_threshold)}
                                    </dt>
                                    <dd>Miễn phí giao</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="contact-title"
                >
                    <h2 id="contact-title">Liên hệ</h2>
                    <p className="admin-lead">
                        Hiện ở chân trang cửa hàng. Địa chỉ mở bản đồ; khách có
                        thể gọi tổng đài, gửi email hoặc chat qua Zalo.
                    </p>
                    <div className="admin-form-grid">
                        <Field
                            name="hotline"
                            label="Số điện thoại"
                            error={form.errors.hotline}
                        >
                            <input
                                id="hotline"
                                type="tel"
                                inputMode="tel"
                                autoComplete="off"
                                maxLength={20}
                                placeholder="0901 234 567"
                                value={data.hotline}
                                onChange={(e) =>
                                    form.setData('hotline', e.target.value)
                                }
                                aria-invalid={!!form.errors.hotline}
                            />
                        </Field>
                        <Field
                            name="contact_email"
                            label="Email"
                            error={form.errors.contact_email}
                        >
                            <input
                                id="contact_email"
                                type="email"
                                autoComplete="off"
                                maxLength={190}
                                placeholder="lienhe@tencuahang.vn"
                                value={data.contact_email}
                                onChange={(e) =>
                                    form.setData(
                                        'contact_email',
                                        e.target.value,
                                    )
                                }
                                aria-invalid={!!form.errors.contact_email}
                            />
                        </Field>
                        <Field
                            name="contact_address"
                            label="Địa chỉ cửa hàng"
                            error={form.errors.contact_address}
                        >
                            <input
                                id="contact_address"
                                type="text"
                                autoComplete="street-address"
                                maxLength={255}
                                placeholder="36 Thạch Lam, Tân Phú"
                                value={data.contact_address}
                                onChange={(e) =>
                                    form.setData(
                                        'contact_address',
                                        e.target.value,
                                    )
                                }
                                aria-invalid={!!form.errors.contact_address}
                            />
                        </Field>
                        <Field
                            name="contact_chat_url"
                            label="Liên kết chat Zalo"
                            error={form.errors.contact_chat_url}
                        >
                            <input
                                id="contact_chat_url"
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                maxLength={500}
                                placeholder="https://zalo.me/0866815722"
                                value={data.contact_chat_url}
                                onChange={(e) =>
                                    form.setData(
                                        'contact_chat_url',
                                        e.target.value,
                                    )
                                }
                                aria-invalid={!!form.errors.contact_chat_url}
                            />
                        </Field>
                    </div>
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="payment-title"
                >
                    <h2 id="payment-title">Thanh toán</h2>
                    <p className="admin-lead">
                        Cửa hàng đang nhận{' '}
                        <strong>thanh toán khi nhận hàng (COD)</strong>. Thanh
                        toán online chưa được kết nối, nên không có lựa chọn nào
                        để bật ở đây. Khi đã thu tiền từ đơn vị giao hàng, ghi
                        nhận ở{' '}
                        <Link href="/admin/orders?status=delivered&payment=unpaid">
                            đơn đã giao chưa thu
                        </Link>
                        .
                    </p>
                </section>

                <div className="admin-form-actions">
                    <span className="admin-form-hint" aria-live="polite">
                        {form.isDirty
                            ? 'Có thay đổi chưa lưu.'
                            : 'Chưa có thay đổi.'}
                    </span>
                    <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={!form.isDirty || form.processing}
                        onClick={() => {
                            form.reset();
                            form.clearErrors();
                        }}
                    >
                        Hoàn tác
                    </button>
                    <button
                        type="submit"
                        className="admin-button"
                        disabled={form.processing}
                        data-busy={form.processing}
                    >
                        {form.processing ? 'Đang lưu…' : 'Lưu cài đặt'}
                    </button>
                </div>
            </form>
        </>
    );
}
