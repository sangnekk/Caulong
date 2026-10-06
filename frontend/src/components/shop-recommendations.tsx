'use client';

import { useEffect, useState } from 'react';
import { ProductStrip } from '@/components/shop-product-card';
import { send } from '@/lib/page/http';
import { rememberViewed, useViewedProducts } from '@/lib/recently-viewed';
import type { Recommendations as Lists } from '@/types/commerce';

/**
 * The lists a store page adds once it is on screen: products this browser looked at lately
 * and, with `suggest`, suggestions for this visitor. On a product page (`productId`) the
 * product is remembered as viewed and left out of both lists.
 *
 * They are extras at the foot of the page: when the request fails they simply do not appear.
 */
export default function Recommendations({
    productId,
    suggest = false,
}: {
    productId?: number;
    suggest?: boolean;
}) {
    const viewed = useViewedProducts().filter((id) => id !== productId);
    const ids = viewed.join(',');
    const [loaded, setLoaded] = useState<{
        key: string;
        lists: Lists | null;
    } | null>(null);
    const key = ids + '|' + (productId ?? '') + '|' + suggest;

    useEffect(() => {
        if (productId) rememberViewed(productId);
    }, [productId]);

    useEffect(() => {
        if (!ids && !suggest) return;
        const controller = new AbortController();
        send(
            'get',
            '/recommendations',
            { viewed: ids || undefined, product: productId, suggest },
            { expects: 'json', signal: controller.signal },
        )
            .then((response) =>
                response.ok ? (response.json() as Promise<Lists>) : null,
            )
            .then((lists) => setLoaded({ key, lists }))
            .catch(() => {
                if (!controller.signal.aborted) setLoaded({ key, lists: null });
            });
        return () => controller.abort();
    }, [ids, key, productId, suggest]);

    const loading = loaded?.key !== key;
    const lists = loading ? null : loaded.lists;
    return (
        <>
            {lists?.basis && (
                <ProductStrip
                    id="store-suggested"
                    title={
                        lists.basis === 'personal'
                            ? 'Gợi ý cho bạn'
                            : 'Bán chạy gần đây'
                    }
                    note={
                        lists.basis === 'personal'
                            ? 'Dựa trên những cây vợt bạn đã xem, đã lưu hoặc đã mua.'
                            : 'Theo số lượng khách đặt trong 90 ngày qua.'
                    }
                    cards={lists.suggested}
                />
            )}
            <ProductStrip
                id="store-viewed"
                title="Vừa xem"
                cards={lists?.viewed ?? []}
                pending={loading ? Math.min(viewed.length, 4) : 0}
            />
        </>
    );
}
