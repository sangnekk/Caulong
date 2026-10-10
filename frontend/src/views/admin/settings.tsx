'use client';

import { Head, Link, useForm } from '@/lib/page';
import type { FormEvent } from 'react';
import { Errors, Field, money, PageHeader } from './shared';

type Settings = {
    shipping_fee: number;
    free_shipping_threshold: number;
    hotline: string;
    contact_email: string;
    contact_address: string;
    contact_chat_url: string;
    segment_vip_spend: number;
    segment_inactive_days: number;
    segment_lost_days: number;
    segment_new_days: number;
    segment_potential_events: number;
    marketing_abandoned_cart: boolean;
    marketing_abandoned_cart_hours: number;
    marketing_winback: boolean;
    marketing_winback_percent: number;
    marketing_winback_valid_days: number;
    marketing_post_purchase: boolean;
    marketing_post_purchase_days: number;
    marketing_vip: boolean;
    marketing_vip_percent: number;
    marketing_vip_valid_days: number;
    /** The stringing service is offered on the storefront. */
    stringing_enabled: boolean;
    /** Dong for stringing one racket, besides the string; 0: said when the racket is handed in. */
    stringing_fee: number;
};
type NumberSetting = {
    [Key in keyof Settings]: Settings[Key] extends number ? Key : never;
}[keyof Settings];

/** The emails that send themselves: a switch each, and the numbers that go with it. */
const automations: {
    key:
        | 'marketing_abandoned_cart'
        | 'marketing_winback'
        | 'marketing_post_purchase'
        | 'marketing_vip';
    title: string;
    about: string;
    numbers: { key: NumberSetting; label: string; max: number }[];
}[] = [
    {
        key: 'marketing_abandoned_cart',
        title: 'Nhắc giỏ hàng bỏ dở',
        about: 'Khách đã đăng nhập thêm vợt vào giỏ rồi không đặt. Email nêu các cây còn hàng. Mỗi khách nhiều nhất một lần mỗi tuần.',
        numbers: [
            {
                key: 'marketing_abandoned_cart_hours',
                label: 'Gửi sau (giờ)',
                max: 72,
            },
        ],
    },
    {
        key: 'marketing_winback',
        title: 'Mời khách cũ quay lại',
        about: 'Khách đã mua nay thuộc nhóm Không hoạt động được tặng một mã giảm giá riêng, dùng một lần. Mỗi khách nhiều nhất một lần trong nửa năm.',
        numbers: [
            { key: 'marketing_winback_percent', label: 'Giảm (%)', max: 50 },
            {
                key: 'marketing_winback_valid_days',
                label: 'Mã dùng trong (ngày)',
                max: 90,
            },
        ],
    },
    {
        key: 'marketing_post_purchase',
        title: 'Mời đánh giá sau khi mua',
        about: 'Vài ngày sau khi đơn đã giao: mời khách đánh giá cây vợt đã nhận, kèm vài cây cùng lối chơi.',
        numbers: [
            {
                key: 'marketing_post_purchase_days',
                label: 'Gửi sau khi giao (ngày)',
                max: 60,
            },
        ],
    },
    {
        key: 'marketing_vip',
        title: 'Cảm ơn khách VIP',
        about: 'Khách vừa vào nhóm VIP nhận một lần duy nhất một mã giảm giá riêng.',
        numbers: [
            { key: 'marketing_vip_percent', label: 'Giảm (%)', max: 50 },
            {
                key: 'marketing_vip_valid_days',
                label: 'Mã dùng trong (ngày)',
                max: 90,
            },
        ],
    },
];

/** The customer groups' thresholds, in the order the form shows them. */
const segmentRules: {
    key: NumberSetting;
    label: string;
    help: (value: number) => string;
    step?: number;
}[] = [
    {
        key: 'segment_vip_spend',
        label: 'Khách VIP: đã thu từ (₫)',
        help: (value) =>
            'Khách có tổng tiền đã thu từ ' + money(value) + ' là VIP.',
        step: 100000,
    },
    {
        key: 'segment_inactive_days',
        label: 'Không hoạt động: số ngày không mua',
        help: (value) =>
            'Khách đã mua mà ' +
            value +
            ' ngày chưa đặt đơn mới (trừ khách VIP).',
    },
    {
        key: 'segment_lost_days',
        label: 'Đã mất: số ngày không có dấu hiệu gì',
        help: (value) =>
            'Không đơn, không ghé cửa hàng trong ' + value + ' ngày.',
    },
    {
        key: 'segment_new_days',
        label: 'Khách mới: số ngày sau khi đăng ký',
        help: (value) =>
            'Tài khoản chưa mua, đăng ký trong ' + value + ' ngày gần đây.',
    },
    {
        key: 'segment_potential_events',
        label: 'Tiềm năng: số lượt quan tâm trong 30 ngày',
        help: (value) =>
            'Chưa mua nhưng đã xem, lưu hoặc thêm giỏ từ ' + value + ' lượt.',
    },
];

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
                description="Phí giao hàng, thông tin liên hệ khách nhìn thấy và cách xếp nhóm khách hàng. Lưu xong là áp dụng ngay cho giỏ hàng và đơn mới; đơn đã đặt giữ nguyên số tiền cũ."
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
                    aria-labelledby="segments-title"
                >
                    <h2 id="segments-title">Nhóm khách hàng</h2>
                    <p className="admin-lead">
                        Mỗi tài khoản khách được xếp vào một nhóm theo đơn hàng
                        và hoạt động của họ: Mới, Tiềm năng, Đang mua, VIP,
                        Không hoạt động, Đã mất. Nhóm được xếp lại mỗi ngày, mỗi
                        khi khách đặt hoặc trả tiền đơn, và ngay sau khi bạn đổi
                        các ngưỡng dưới đây. Xem theo nhóm ở{' '}
                        <Link href="/admin/customers">Khách hàng</Link>; tặng mã
                        cho một nhóm ở{' '}
                        <Link href="/admin/coupons">Mã giảm giá</Link>.
                    </p>
                    <div className="admin-form-grid">
                        {segmentRules.map(({ key, label, help, step }) => (
                            <Field
                                key={key}
                                name={key}
                                label={label}
                                error={
                                    (
                                        form.errors as Record<
                                            string,
                                            string | undefined
                                        >
                                    )[key]
                                }
                            >
                                <input
                                    id={key}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    step={step ?? 1}
                                    required
                                    value={data[key]}
                                    onChange={(e) =>
                                        form.setData(
                                            key,
                                            e.target.value === ''
                                                ? 0
                                                : Math.max(
                                                      0,
                                                      Math.floor(
                                                          Number(
                                                              e.target.value,
                                                          ),
                                                      ),
                                                  ),
                                        )
                                    }
                                    aria-describedby={key + '-help'}
                                />
                                <small id={key + '-help'}>
                                    {help(Number(data[key]))}
                                </small>
                            </Field>
                        ))}
                    </div>
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="automation-title"
                >
                    <h2 id="automation-title">Email tự động</h2>
                    <p className="admin-lead">
                        Các email cửa hàng tự gửi theo lịch. Mỗi loại chỉ chạy
                        khi bạn bật, và chỉ gửi cho khách{' '}
                        <strong>đã đồng ý nhận email ưu đãi</strong> (ô chọn khi
                        đăng ký hoặc ở trang tài khoản); email nào cũng có liên
                        kết để khách ngừng nhận. Xem những gì đã gửi ở{' '}
                        <Link href="/admin/emails">Email đã gửi</Link>. Email về
                        đơn hàng và tài khoản luôn được gửi, không phụ thuộc các
                        công tắc này.
                    </p>
                    {automations.map(({ key, title, about, numbers }) => (
                        <fieldset key={key} className="admin-automation">
                            <legend className="sr-only">{title}</legend>
                            <label className="admin-check">
                                <input
                                    type="checkbox"
                                    checked={data[key]}
                                    onChange={(e) =>
                                        form.setData(key, e.target.checked)
                                    }
                                />
                                {title}
                            </label>
                            <p className="admin-muted">{about}</p>
                            <div className="admin-automation-numbers">
                                {numbers.map((number) => (
                                    <Field
                                        key={number.key}
                                        name={number.key}
                                        label={number.label}
                                        error={
                                            (
                                                form.errors as Record<
                                                    string,
                                                    string | undefined
                                                >
                                            )[number.key]
                                        }
                                    >
                                        <input
                                            id={number.key}
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={number.max}
                                            required
                                            disabled={!data[key]}
                                            value={data[number.key]}
                                            onChange={(e) =>
                                                form.setData(
                                                    number.key,
                                                    e.target.value === ''
                                                        ? 0
                                                        : Math.max(
                                                              0,
                                                              Math.floor(
                                                                  Number(
                                                                      e.target
                                                                          .value,
                                                                  ),
                                                              ),
                                                          ),
                                                )
                                            }
                                        />
                                    </Field>
                                ))}
                            </div>
                        </fieldset>
                    ))}
                </section>

                <section
                    className="admin-form-section"
                    aria-labelledby="stringing-title"
                >
                    <h2 id="stringing-title">Dịch vụ đan dây</h2>
                    <p className="admin-lead">
                        Khách gửi yêu cầu ở trang Đan dây của cửa hàng, mang vợt
                        tới và trả tiền khi nhận lại. Các loại dây và giá từng
                        loại ở{' '}
                        <Link href="/admin/service-strings">
                            Dây đan và giá
                        </Link>
                        ; yêu cầu của khách ở{' '}
                        <Link href="/admin/service-orders">Đan dây</Link>.
                    </p>
                    <label className="admin-check">
                        <input
                            type="checkbox"
                            checked={data.stringing_enabled}
                            onChange={(e) =>
                                form.setData(
                                    'stringing_enabled',
                                    e.target.checked,
                                )
                            }
                        />
                        Nhận yêu cầu đan dây trên website
                    </label>
                    <div className="admin-form-grid">
                        <Field
                            name="stringing_fee"
                            label="Phí công đan mỗi cây (₫)"
                            error={form.errors.stringing_fee}
                        >
                            <input
                                id="stringing_fee"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={5000000}
                                step={1000}
                                required
                                value={data.stringing_fee}
                                onChange={(e) =>
                                    form.setData(
                                        'stringing_fee',
                                        e.target.value === ''
                                            ? 0
                                            : Math.max(
                                                  0,
                                                  Math.floor(
                                                      Number(e.target.value),
                                                  ),
                                              ),
                                    )
                                }
                                aria-describedby="stringing_fee-help"
                                aria-invalid={!!form.errors.stringing_fee}
                            />
                            <small id="stringing_fee-help">
                                {data.stringing_fee
                                    ? 'Cộng ' +
                                      money(data.stringing_fee) +
                                      ' cho mỗi cây vợt, ngoài tiền dây.'
                                    : 'Để 0: trang Đan dây ghi “báo khi nhận vợt”, bạn nhập số tiền ở từng yêu cầu.'}
                            </small>
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
