'use client';

import { Link } from '@/lib/page';
import { KeyRound, ReceiptText, UserRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useNoRecording } from '@/lib/analytics';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import '@/css/brand-ui.css';

const tabs = [
    { title: 'Đơn hàng & tài khoản', href: '/account', icon: ReceiptText },
    { title: 'Hồ sơ', href: edit(), icon: UserRound },
    { title: 'Bảo mật đăng nhập', href: editSecurity(), icon: KeyRound },
];

/** The account's own settings, inside the store: same header, same paper, Vietnamese. */
export default function SettingsLayout({ children }: PropsWithChildren) {
    // Settings are never recorded by Clarity, as on the sign-in pages.
    useNoRecording();
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <div className="store-settings">
            <header className="store-page-heading">
                <div>
                    <h1>Cài đặt tài khoản</h1>
                    <p>Hồ sơ, mật khẩu, xác thực hai lớp và passkey của bạn.</p>
                </div>
            </header>
            <nav className="store-settings-tabs" aria-label="Cài đặt tài khoản">
                {tabs.map(({ title, href, icon: Icon }) => {
                    const current = isCurrentOrParentUrl(href);
                    return (
                        <Link
                            key={title}
                            href={href}
                            aria-current={current ? 'page' : undefined}
                        >
                            <Icon size={17} aria-hidden="true" />
                            {title}
                        </Link>
                    );
                })}
            </nav>
            <section className="store-settings-body brand-ui">
                {children}
            </section>
        </div>
    );
}
