'use client';

import { Head, Link, router } from '@/lib/page';
import { useState } from 'react';
import {
    dateTime,
    PageHeader,
    Pages,
    query,
    ReviewStatus,
    Stars,
    Tabs,
} from './shared';
import type { Pagination, ReviewState } from './shared';

type Review = {
    id: number;
    rating: number;
    body: string | null;
    status: ReviewState;
    created_at: string;
    product: { id: number; name: string; slug: string };
    customer: { id: number; name: string; email: string };
};

const tabs: [ReviewState, string][] = [
    ['pending', 'Chờ duyệt'],
    ['published', 'Đang hiện'],
    ['hidden', 'Đã ẩn'],
];
const empty: Record<ReviewState, string> = {
    pending: 'Không có đánh giá nào chờ duyệt.',
    published: 'Chưa có đánh giá nào đang hiện ở cửa hàng.',
    hidden: 'Chưa ẩn đánh giá nào.',
};

export default function Reviews({
    reviews,
    status,
    counts,
}: {
    reviews: Pagination<Review>;
    status: ReviewState;
    counts: Record<ReviewState, number>;
}) {
    const [saving, setSaving] = useState<number | null>(null);
    const set = (review: Review, next: 'published' | 'hidden') => {
        setSaving(review.id);
        router.patch(
            '/admin/reviews/' + review.id,
            { status: next },
            { preserveScroll: true, onFinish: () => setSaving(null) },
        );
    };

    return (
        <>
            <Head title="Đánh giá sản phẩm" />
            <PageHeader
                title="Đánh giá sản phẩm"
                description="Chỉ khách đã nhận hàng mới viết được đánh giá. Đánh giá chỉ có số sao hiện ngay; đánh giá có lời bình chờ bạn đọc trước khi hiện ở trang sản phẩm."
            />
            <Tabs
                label="Lọc theo trạng thái"
                items={tabs.map(([value, label]) => ({
                    href: query('/admin/reviews', {
                        status: value === 'pending' ? '' : value,
                    }),
                    label,
                    count: counts[value],
                    current: status === value,
                }))}
            />
            {reviews.data.length ? (
                <ul className="admin-reviews">
                    {reviews.data.map((review) => (
                        <li key={review.id} className="admin-panel">
                            <div className="admin-review-head">
                                <Stars rating={review.rating} />
                                <ReviewStatus status={review.status} />
                                <span className="admin-muted">
                                    {dateTime(review.created_at)}
                                </span>
                            </div>
                            <p className="admin-review-about">
                                <Link href={'/products/' + review.product.slug}>
                                    {review.product.name}
                                </Link>
                                {' · '}
                                <Link
                                    href={
                                        '/admin/customers/' + review.customer.id
                                    }
                                >
                                    {review.customer.name}
                                </Link>
                            </p>
                            {review.body ? (
                                <p className="admin-review-body">
                                    {review.body}
                                </p>
                            ) : (
                                <p className="admin-muted">
                                    Chỉ chấm sao, không viết lời bình.
                                </p>
                            )}
                            <div className="admin-review-actions">
                                {review.status !== 'published' && (
                                    <button
                                        type="button"
                                        className="admin-button admin-button-small"
                                        disabled={saving !== null}
                                        data-busy={saving === review.id}
                                        onClick={() => set(review, 'published')}
                                    >
                                        Hiện ở cửa hàng
                                    </button>
                                )}
                                {review.status !== 'hidden' && (
                                    <button
                                        type="button"
                                        className="admin-button-secondary admin-button-small"
                                        disabled={saving !== null}
                                        data-busy={saving === review.id}
                                        onClick={() => set(review, 'hidden')}
                                    >
                                        Ẩn
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="admin-empty">
                    <strong>{empty[status]}</strong>
                    Đánh giá mới của khách sẽ hiện ở đây.
                </div>
            )}
            <Pages page={reviews} noun="đánh giá" />
        </>
    );
}
