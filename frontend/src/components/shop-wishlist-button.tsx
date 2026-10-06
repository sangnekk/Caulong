'use client';

import { Heart } from 'lucide-react';
import { useState } from 'react';
import { mark } from '@/lib/analytics';
import { Link, router } from '@/lib/page';

/**
 * Saves the product to the customer's list, or takes it off. The button's own state is the
 * confirmation. `saved` null: nobody is signed in, and the button leads to the sign-in page.
 */
export default function WishlistButton({
    slug,
    saved,
}: {
    slug: string;
    saved: boolean | null;
}) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState('');

    if (saved === null)
        return (
            <Link href="/login" className="store-wish">
                <Heart size={18} aria-hidden="true" />
                Đăng nhập để lưu sản phẩm
            </Link>
        );

    const toggle = () => {
        setBusy(true);
        setFailed('');
        router.visit('/wishlist/' + slug, {
            method: saved ? 'delete' : 'post',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                if (!saved) mark('wishlist_added');
            },
            onError: (errors) =>
                setFailed(errors.wishlist ?? 'Chưa lưu được. Thử lại sau.'),
            onFinish: () => setBusy(false),
        });
    };
    return (
        <>
            <button
                type="button"
                className="store-wish"
                aria-pressed={saved}
                disabled={busy}
                onClick={toggle}
            >
                <Heart size={18} aria-hidden="true" />
                {saved ? 'Đã lưu vào yêu thích' : 'Lưu vào yêu thích'}
            </button>
            {failed && (
                <p className="store-field-error" role="alert">
                    {failed}
                </p>
            )}
        </>
    );
}
