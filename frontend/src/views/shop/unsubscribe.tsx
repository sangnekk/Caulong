'use client';

import { Head, Link, router } from '@/lib/page';
import { useState } from 'react';

/**
 * Opened from the link at the foot of a promotional email, without signing in. Opening it
 * changes nothing; the button does.
 */
export default function Unsubscribe({
    subscribed,
    email,
    action,
}: {
    subscribed: boolean;
    /** The address, partly hidden: enough to recognise it. */
    email: string;
    /** The signed address this page was opened with: the button posts to it. */
    action: string;
}) {
    const [sending, setSending] = useState(false);
    return (
        <>
            <Head title="Email ưu đãi">
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <header className="store-page-heading">
                <div>
                    <h1>Email ưu đãi</h1>
                    <p>
                        Mã giảm giá, nhắc giỏ hàng và lời mời đánh giá gửi tới{' '}
                        <strong>{email}</strong>.
                    </p>
                </div>
            </header>
            <section className="store-empty store-unsubscribe">
                {subscribed ? (
                    <>
                        <h2>Bạn đang nhận email ưu đãi</h2>
                        <p>
                            Bấm nút dưới đây để ngừng. Email về đơn hàng và tài
                            khoản của bạn vẫn được gửi như cũ.
                        </p>
                        <button
                            type="button"
                            className="store-button"
                            disabled={sending}
                            onClick={() => {
                                setSending(true);
                                router.post(
                                    action,
                                    {},
                                    {
                                        preserveScroll: true,
                                        onFinish: () => setSending(false),
                                    },
                                );
                            }}
                        >
                            {sending
                                ? 'Đang ngừng…'
                                : 'Ngừng nhận email ưu đãi'}
                        </button>
                    </>
                ) : (
                    <>
                        <h2 role="status">Đã ngừng gửi email ưu đãi</h2>
                        <p>
                            Địa chỉ này sẽ không nhận email ưu đãi nữa. Email về
                            đơn hàng và tài khoản vẫn được gửi. Bạn bật lại bất
                            cứ lúc nào ở trang tài khoản.
                        </p>
                        <Link href="/account" className="store-button">
                            Mở trang tài khoản
                        </Link>
                    </>
                )}
            </section>
        </>
    );
}
