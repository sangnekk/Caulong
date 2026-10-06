'use client';

import { mark } from '@/lib/analytics';
import { Link, useForm } from '@/lib/page';
import type { ProductReviews, ReviewViewer } from '@/types/commerce';

const BODY_LIMIT = 2000;
const words = ['Rất tệ', 'Chưa tốt', 'Tạm được', 'Tốt', 'Rất tốt'];
const states: Record<string, string> = {
    pending:
        'Đánh giá của bạn đang chờ cửa hàng duyệt. Bạn có thể sửa rồi gửi lại.',
    published:
        'Đánh giá của bạn đang hiện ở đây. Sửa lời bình thì cửa hàng sẽ duyệt lại.',
    hidden: 'Cửa hàng đã ẩn đánh giá của bạn. Bạn có thể sửa rồi gửi lại.',
};

/** A rating out of five drawn as stars; halves show for an average. */
export function Stars({ rating }: { rating: number }) {
    return (
        <span
            className="store-stars"
            role="img"
            aria-label={rating.toLocaleString('vi-VN') + ' trên 5 sao'}
        >
            <span style={{ width: (rating / 5) * 100 + '%' }} />
        </span>
    );
}

function ReviewForm({
    slug,
    mine,
}: {
    slug: string;
    mine: NonNullable<ReviewViewer>['mine'];
}) {
    const form = useForm({ rating: mine?.rating ?? 0, body: mine?.body ?? '' });
    const errors = form.errors as Record<string, string | undefined>;
    return (
        <form
            className="store-review-form"
            // What a customer writes is theirs: Clarity never records this block.
            data-clarity-mask="true"
            onSubmit={(event) => {
                event.preventDefault();
                form.post('/products/' + slug + '/reviews', {
                    preserveScroll: true,
                    onSuccess: () => mark('review_submitted'),
                });
            }}
        >
            <h3>{mine ? 'Đánh giá của bạn' : 'Viết đánh giá'}</h3>
            {mine && <p className="store-hint">{states[mine.status]}</p>}
            <fieldset className="store-rating" disabled={form.processing}>
                <legend>Bạn chấm mấy sao?</legend>
                <div>
                    {words.map((word, index) => {
                        const value = index + 1;
                        return (
                            <label
                                key={value}
                                data-on={value <= form.data.rating}
                            >
                                <input
                                    type="radio"
                                    name="rating"
                                    value={value}
                                    required
                                    checked={form.data.rating === value}
                                    onChange={() =>
                                        form.setData('rating', value)
                                    }
                                />
                                <span aria-hidden="true">★</span>
                                <span className="store-sr-only">
                                    {value} sao: {word}
                                </span>
                            </label>
                        );
                    })}
                    <span className="store-muted" aria-hidden="true">
                        {words[form.data.rating - 1] ?? ''}
                    </span>
                </div>
                {(errors.rating ?? errors.review) && (
                    <p className="store-field-error">
                        {errors.rating ?? errors.review}
                    </p>
                )}
            </fieldset>
            <div className="store-field">
                <label htmlFor="review-body">
                    Lời bình <span>(không bắt buộc)</span>
                </label>
                <textarea
                    id="review-body"
                    rows={4}
                    maxLength={BODY_LIMIT}
                    value={form.data.body}
                    disabled={form.processing}
                    aria-invalid={!!errors.body}
                    aria-describedby="review-body-hint"
                    onChange={(event) =>
                        form.setData('body', event.target.value)
                    }
                />
                <p id="review-body-hint" className="store-hint">
                    Chỉ chấm sao thì hiện ngay; có lời bình thì hiện sau khi cửa
                    hàng đọc.
                </p>
                {errors.body && (
                    <p className="store-field-error">{errors.body}</p>
                )}
            </div>
            <button
                className="store-button"
                disabled={form.processing || form.data.rating < 1}
            >
                {form.processing
                    ? 'Đang gửi…'
                    : mine
                      ? 'Gửi lại đánh giá'
                      : 'Gửi đánh giá'}
            </button>
        </form>
    );
}

/**
 * Reviews of a product: the average, the latest published ones, and the form for a customer
 * who received it. Only real, delivered orders lead to a review, so a new product has none.
 */
export default function Reviews({
    slug,
    reviews,
    viewer,
}: {
    slug: string;
    reviews: ProductReviews;
    /** null: nobody is signed in. */
    viewer: ReviewViewer;
}) {
    return (
        <section
            className="store-reviews"
            id="danh-gia"
            aria-labelledby="reviews-title"
        >
            <header>
                <h2 id="reviews-title">Đánh giá từ khách đã mua</h2>
                {reviews.average !== null && (
                    <p className="store-reviews-summary">
                        <strong>
                            {reviews.average.toLocaleString('vi-VN', {
                                minimumFractionDigits: 1,
                            })}
                        </strong>
                        <Stars rating={reviews.average} />
                        <span className="store-muted">
                            {reviews.count} đánh giá
                        </span>
                    </p>
                )}
            </header>
            <div className="store-reviews-body">
                {reviews.items.length ? (
                    <ul className="store-review-list">
                        {reviews.items.map((review) => (
                            <li key={review.id}>
                                <p className="store-review-meta">
                                    <Stars rating={review.rating} />
                                    <strong>{review.author}</strong>
                                    <time dateTime={review.created_at}>
                                        {new Date(
                                            review.created_at,
                                        ).toLocaleDateString('vi-VN')}
                                    </time>
                                </p>
                                {review.body && (
                                    <p className="store-review-text">
                                        {review.body}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="store-muted">
                        Chưa có đánh giá nào. Khách đã nhận cây vợt này có thể
                        viết đánh giá đầu tiên.
                    </p>
                )}
                {viewer === null ? (
                    <p className="store-reviews-note">
                        Đã mua sản phẩm này?{' '}
                        <Link href="/login">Đăng nhập</Link> bằng tài khoản đặt
                        hàng để viết đánh giá.
                    </p>
                ) : viewer.eligible ? (
                    <ReviewForm slug={slug} mine={viewer.mine} />
                ) : (
                    <p className="store-reviews-note">
                        Bạn viết được đánh giá sau khi đã nhận cây vợt này từ
                        một đơn đặt bằng tài khoản của mình.
                    </p>
                )}
            </div>
        </section>
    );
}
