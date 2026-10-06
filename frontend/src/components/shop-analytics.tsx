'use client';

import { useEffect } from 'react';
import {
    CLARITY_ID,
    askAgain,
    choose,
    startClarity,
    stopClarity,
    useChoice,
} from '@/lib/analytics';
import { usePage } from '@/lib/page';
import type { ShopSharedProps } from '@/types/commerce';

/**
 * Microsoft Clarity on store pages, when the shop has a project (NEXT_PUBLIC_CLARITY_ID):
 * asks the visitor once and records only after a yes. Staff are never recorded. `ask` off
 * (the landing) honours an earlier answer without putting the question on screen.
 */
export default function ShopAnalytics({ ask = true }: { ask?: boolean }) {
    const staff = !!usePage<ShopSharedProps>().props.shop?.is_admin;
    const choice = useChoice();
    useEffect(() => {
        // Not known yet while the page hydrates.
        if (choice === undefined) return;
        if (staff || choice !== 'granted') stopClarity();
        else startClarity();
    }, [choice, staff]);

    if (!CLARITY_ID || staff || !ask || choice !== null) return null;
    return (
        <aside className="store-consent" aria-label="Quyền riêng tư">
            <p>
                <strong>Giúp shop cải thiện trang?</strong> Nếu bạn đồng ý,
                Microsoft Clarity ghi lại cách bạn dùng cửa hàng: trang đã xem,
                chỗ bấm, cuộn. Những gì bạn nhập (tên, địa chỉ, mật khẩu, tin
                nhắn) không được ghi lại.
            </p>
            <div>
                <button
                    type="button"
                    className="store-button"
                    onClick={() => choose('granted')}
                >
                    Đồng ý
                </button>
                <button
                    type="button"
                    className="store-button store-button-secondary"
                    onClick={() => choose('denied')}
                >
                    Không
                </button>
            </div>
        </aside>
    );
}

/** In the footer, once the visitor has answered: says what they chose and lets them change it. */
export function AnalyticsChoice() {
    const staff = !!usePage<ShopSharedProps>().props.shop?.is_admin;
    const choice = useChoice();
    if (!CLARITY_ID || staff || !choice) return null;
    return (
        <p className="store-consent-choice">
            {choice === 'granted'
                ? 'Bạn đang cho phép ghi lại cách dùng trang.'
                : 'Trang không ghi lại cách bạn dùng cửa hàng.'}{' '}
            <button type="button" onClick={askAgain}>
                Đổi lựa chọn
            </button>
        </p>
    );
}
