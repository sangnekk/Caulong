'use client';

import { Head, Link, useForm, usePage } from '@/lib/page';
import { FormErrors, ShopContact } from '@/layouts/shop-layout';
import { vnd } from '@/types/commerce';

/** What the shop offers (App\Services\StringingService::offer). */
type Service = {
    /** Requests are taken online; the owner can switch this off. */
    enabled: boolean;
    /** Dong for stringing one racket, besides the string. 0: said when the racket is handed in. */
    fee: number;
    tension: { min: number; max: number };
    max_rackets: number;
    strings: { id: number; label: string; price: number }[];
};
type Fields = {
    booking_token: string;
    name: string;
    phone: string;
    email: string;
    service_type: 'shop_string' | 'own_string';
    racket: string;
    service_string_id: number | '';
    string_name: string;
    tension_kg: number | '';
    quantity: number;
    preferred_at: string;
    notes: string;
};

function FieldError({ id, message }: { id: string; message?: string }) {
    return message ? (
        <p id={id} className="store-field-error">
            {message}
        </p>
    ) : null;
}

export default function Services({
    service,
    bookingToken,
}: {
    service: Service;
    bookingToken: string;
}) {
    // A signed-in customer starts from their account's name and email; both stay editable.
    const { user } = usePage().props.auth;
    const hasStrings = service.strings.length > 0;
    const form = useForm<Fields>({
        booking_token: bookingToken,
        name: user?.name ?? '',
        phone: '',
        email: user?.email ?? '',
        service_type: hasStrings ? 'shop_string' : 'own_string',
        racket: '',
        service_string_id: '',
        string_name: '',
        tension_kg: '',
        quantity: 1,
        preferred_at: '',
        notes: '',
    });
    const data = form.data;
    const errors = form.errors as Record<string, string | undefined>;
    const describedBy = (name: string) =>
        errors[name] ? name + '-error' : undefined;
    const string =
        data.service_type === 'shop_string'
            ? service.strings.find((item) => item.id === data.service_string_id)
            : undefined;
    // An estimate for the page; the shop works the figure out again when the form arrives.
    const each = (string?.price ?? 0) + service.fee;
    const total = each * data.quantity;

    return (
        <>
            <Head title="Dịch vụ đan dây vợt" />
            <header className="store-page-heading">
                <div>
                    <h1>Đan dây vợt</h1>
                    <p>
                        Gửi yêu cầu trước, mang vợt tới cửa hàng, nhận lại khi
                        đan xong. Bạn thanh toán lúc nhận vợt.
                    </p>
                </div>
                <Link href="/products" className="store-text-link">
                    Xem vợt đang bán
                </Link>
            </header>
            {!service.enabled ? (
                <section className="store-empty">
                    <h2>Cửa hàng đang tạm ngưng nhận đặt lịch đan dây</h2>
                    <p>
                        Bạn vẫn có thể liên hệ cửa hàng để hỏi lịch đan gần
                        nhất.
                    </p>
                    <ShopContact />
                </section>
            ) : (
                <form
                    className="store-two-column"
                    // Name, phone and email: masked in Clarity recordings.
                    data-clarity-mask="true"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/service-orders', { preserveScroll: true });
                    }}
                >
                    <div className="store-checkout-fields">
                        <FormErrors errors={form.errors} />
                        {errors.booking_token && (
                            <p>
                                <Link
                                    href="/services"
                                    className="store-text-link"
                                >
                                    Tải lại trang để gửi lại yêu cầu
                                </Link>
                            </p>
                        )}
                        <fieldset disabled={form.processing}>
                            <legend>Vợt và dây</legend>
                            <div className="store-field">
                                <label htmlFor="racket">
                                    Cây vợt cần đan <span>(bắt buộc)</span>
                                </label>
                                <input
                                    id="racket"
                                    name="racket"
                                    required
                                    maxLength={160}
                                    placeholder="Hãng và tên vợt, ví dụ: Astrox 88D Pro 4U"
                                    value={data.racket}
                                    aria-invalid={!!errors.racket}
                                    aria-describedby={describedBy('racket')}
                                    onChange={(event) =>
                                        form.setData(
                                            'racket',
                                            event.target.value,
                                        )
                                    }
                                />
                                <FieldError
                                    id="racket-error"
                                    message={errors.racket}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="quantity">
                                    Số vợt <span>(cùng dây và mức căng)</span>
                                </label>
                                <input
                                    id="quantity"
                                    name="quantity"
                                    type="number"
                                    inputMode="numeric"
                                    required
                                    min={1}
                                    max={service.max_rackets}
                                    value={data.quantity}
                                    aria-invalid={!!errors.quantity}
                                    aria-describedby={describedBy('quantity')}
                                    onChange={(event) =>
                                        form.setData(
                                            'quantity',
                                            Math.max(
                                                1,
                                                Math.floor(
                                                    Number(event.target.value),
                                                ) || 1,
                                            ),
                                        )
                                    }
                                />
                                <FieldError
                                    id="quantity-error"
                                    message={errors.quantity}
                                />
                            </div>
                            <div
                                className="store-choice"
                                role="radiogroup"
                                aria-labelledby="service-type-label"
                            >
                                <span
                                    id="service-type-label"
                                    className="store-choice-label"
                                >
                                    Dây
                                </span>
                                {hasStrings && (
                                    <label className="store-payment">
                                        <input
                                            type="radio"
                                            name="service_type"
                                            value="shop_string"
                                            checked={
                                                data.service_type ===
                                                'shop_string'
                                            }
                                            onChange={() =>
                                                form.setData(
                                                    'service_type',
                                                    'shop_string',
                                                )
                                            }
                                        />
                                        <span>
                                            Dùng dây của cửa hàng
                                            <small>
                                                Chọn một loại trong bảng giá.
                                            </small>
                                        </span>
                                    </label>
                                )}
                                <label className="store-payment">
                                    <input
                                        type="radio"
                                        name="service_type"
                                        value="own_string"
                                        checked={
                                            data.service_type === 'own_string'
                                        }
                                        onChange={() =>
                                            form.setData(
                                                'service_type',
                                                'own_string',
                                            )
                                        }
                                    />
                                    <span>
                                        Tôi mang dây tới
                                        <small>Chỉ tính công đan.</small>
                                    </span>
                                </label>
                                {!hasStrings && (
                                    <p className="store-hint">
                                        Cửa hàng chưa đăng danh sách dây. Bạn
                                        mang dây tới, hoặc nhắn cửa hàng để được
                                        tư vấn dây.
                                    </p>
                                )}
                                <FieldError
                                    id="service_type-error"
                                    message={errors.service_type}
                                />
                            </div>
                            {data.service_type === 'shop_string' ? (
                                <div className="store-field">
                                    <label htmlFor="service_string_id">
                                        Loại dây <span>(bắt buộc)</span>
                                    </label>
                                    <select
                                        id="service_string_id"
                                        name="service_string_id"
                                        required
                                        value={data.service_string_id}
                                        aria-invalid={
                                            !!errors.service_string_id
                                        }
                                        aria-describedby={describedBy(
                                            'service_string_id',
                                        )}
                                        onChange={(event) =>
                                            form.setData(
                                                'service_string_id',
                                                event.target.value === ''
                                                    ? ''
                                                    : Number(
                                                          event.target.value,
                                                      ),
                                            )
                                        }
                                    >
                                        <option value="">Chọn loại dây</option>
                                        {service.strings.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.label} · {vnd(item.price)}
                                            </option>
                                        ))}
                                    </select>
                                    <FieldError
                                        id="service_string_id-error"
                                        message={errors.service_string_id}
                                    />
                                </div>
                            ) : (
                                <div className="store-field">
                                    <label htmlFor="string_name">
                                        Tên dây của bạn{' '}
                                        <span>(không bắt buộc)</span>
                                    </label>
                                    <input
                                        id="string_name"
                                        name="string_name"
                                        maxLength={120}
                                        value={data.string_name}
                                        aria-invalid={!!errors.string_name}
                                        aria-describedby={describedBy(
                                            'string_name',
                                        )}
                                        onChange={(event) =>
                                            form.setData(
                                                'string_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <FieldError
                                        id="string_name-error"
                                        message={errors.string_name}
                                    />
                                </div>
                            )}
                            <div className="store-field">
                                <label htmlFor="tension_kg">
                                    Mức căng (kg) <span>(bắt buộc)</span>
                                </label>
                                <input
                                    id="tension_kg"
                                    name="tension_kg"
                                    type="number"
                                    inputMode="decimal"
                                    required
                                    min={service.tension.min}
                                    max={service.tension.max}
                                    step={0.5}
                                    value={data.tension_kg}
                                    aria-invalid={!!errors.tension_kg}
                                    aria-describedby={
                                        errors.tension_kg
                                            ? 'tension_kg-error'
                                            : 'tension_kg-help'
                                    }
                                    onChange={(event) =>
                                        form.setData(
                                            'tension_kg',
                                            event.target.value === ''
                                                ? ''
                                                : Number(event.target.value),
                                        )
                                    }
                                />
                                <p id="tension_kg-help" className="store-hint">
                                    Từ {service.tension.min} đến{' '}
                                    {service.tension.max} kg, cách nhau nửa kg.
                                    Chưa chắc thì ghi mức đang dùng và nói thêm
                                    ở phần ghi chú để kỹ thuật viên tư vấn.
                                </p>
                                <FieldError
                                    id="tension_kg-error"
                                    message={errors.tension_kg}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="preferred_at">
                                    Bạn định mang vợt tới lúc nào?{' '}
                                    <span>(không bắt buộc)</span>
                                </label>
                                <input
                                    id="preferred_at"
                                    name="preferred_at"
                                    type="datetime-local"
                                    value={data.preferred_at}
                                    aria-invalid={!!errors.preferred_at}
                                    aria-describedby={describedBy(
                                        'preferred_at',
                                    )}
                                    onChange={(event) =>
                                        form.setData(
                                            'preferred_at',
                                            event.target.value,
                                        )
                                    }
                                />
                                <FieldError
                                    id="preferred_at-error"
                                    message={errors.preferred_at}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="notes">
                                    Ghi chú <span>(không bắt buộc)</span>
                                </label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    maxLength={1000}
                                    rows={3}
                                    placeholder="Ví dụ: đan 4 nút, giữ lại cuốn cán cũ"
                                    value={data.notes}
                                    aria-invalid={!!errors.notes}
                                    aria-describedby={describedBy('notes')}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                />
                                <FieldError
                                    id="notes-error"
                                    message={errors.notes}
                                />
                            </div>
                        </fieldset>
                        <fieldset disabled={form.processing}>
                            <legend>Liên hệ</legend>
                            <div className="store-field">
                                <label htmlFor="name">
                                    Họ và tên <span>(bắt buộc)</span>
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    autoComplete="name"
                                    required
                                    maxLength={120}
                                    value={data.name}
                                    aria-invalid={!!errors.name}
                                    aria-describedby={describedBy('name')}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                />
                                <FieldError
                                    id="name-error"
                                    message={errors.name}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="phone">
                                    Số điện thoại <span>(bắt buộc)</span>
                                </label>
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    autoComplete="tel"
                                    required
                                    maxLength={20}
                                    placeholder="Ví dụ: 0912345678"
                                    value={data.phone}
                                    aria-invalid={!!errors.phone}
                                    aria-describedby={describedBy('phone')}
                                    onChange={(event) =>
                                        form.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                />
                                <FieldError
                                    id="phone-error"
                                    message={errors.phone}
                                />
                            </div>
                            <div className="store-field">
                                <label htmlFor="email">
                                    Email <span>(không bắt buộc)</span>
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    maxLength={190}
                                    value={data.email}
                                    aria-invalid={!!errors.email}
                                    aria-describedby={
                                        errors.email
                                            ? 'email-error'
                                            : 'email-help'
                                    }
                                    onChange={(event) =>
                                        form.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                />
                                <p id="email-help" className="store-hint">
                                    Có email thì cửa hàng báo ngay khi vợt đan
                                    xong.
                                </p>
                                <FieldError
                                    id="email-error"
                                    message={errors.email}
                                />
                            </div>
                        </fieldset>
                    </div>
                    <aside className="store-summary">
                        <h2>Bảng giá</h2>
                        <dl className="store-specs">
                            <div>
                                <dt>Công đan mỗi cây</dt>
                                <dd>
                                    {service.fee > 0
                                        ? vnd(service.fee)
                                        : 'Báo khi nhận vợt'}
                                </dd>
                            </div>
                            {service.strings.map((item) => (
                                <div key={item.id}>
                                    <dt>{item.label}</dt>
                                    <dd>{vnd(item.price)}</dd>
                                </div>
                            ))}
                        </dl>
                        <h2>Tạm tính</h2>
                        <dl className="store-totals" aria-live="polite">
                            {string && (
                                <div>
                                    <dt>
                                        Dây × {data.quantity}
                                        <br />
                                        <small>{string.label}</small>
                                    </dt>
                                    <dd>{vnd(string.price * data.quantity)}</dd>
                                </div>
                            )}
                            <div>
                                <dt>Công đan × {data.quantity}</dt>
                                <dd>
                                    {service.fee > 0
                                        ? vnd(service.fee * data.quantity)
                                        : 'Báo khi nhận vợt'}
                                </dd>
                            </div>
                            <div className="store-total">
                                <dt>Trả khi nhận vợt</dt>
                                <dd>
                                    {total > 0 ? vnd(total) : 'Cửa hàng báo'}
                                    {total > 0 &&
                                        service.fee === 0 &&
                                        ' + công'}
                                </dd>
                            </div>
                        </dl>
                        <button
                            type="submit"
                            className="store-button store-full"
                            disabled={form.processing}
                        >
                            {form.processing
                                ? 'Đang gửi…'
                                : 'Gửi yêu cầu đan dây'}
                        </button>
                        <p className="store-hint">
                            Chưa cần thanh toán. Cửa hàng gọi lại để hẹn lúc bạn
                            mang vợt tới.
                        </p>
                    </aside>
                </form>
            )}
        </>
    );
}
