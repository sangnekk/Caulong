'use client';

import { ArrowLeft, Check } from 'lucide-react';
import { Link } from '@/lib/page';
import BrandMark from '@/components/brand-mark';
import { courtView } from '@/lib/court-view';
import type { AuthLayoutProps } from '@/types';
import '@/css/brand-ui.css';

// The same lit court as the landing, projected once; the account doors open onto the hall.
const COURT = courtView('tall');

function Court() {
    const [cx, cy] = COURT.centre;
    return (
        <svg
            className="auth-court"
            viewBox={'0 0 ' + COURT.width + ' ' + COURT.height}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <linearGradient
                    id="auth-court-floor"
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1={COURT.horizon}
                    x2="0"
                    y2={COURT.height}
                >
                    <stop offset="0" stopColor="var(--arena-far)" />
                    <stop offset="1" stopColor="var(--arena-floor)" />
                </linearGradient>
                <radialGradient
                    id="auth-court-light"
                    gradientUnits="userSpaceOnUse"
                    cx={cx}
                    cy={cy}
                    r={COURT.height * 0.62}
                    gradientTransform={
                        'translate(' +
                        cx +
                        ' ' +
                        cy +
                        ') scale(1.35 0.62) translate(' +
                        -cx +
                        ' ' +
                        -cy +
                        ')'
                    }
                >
                    <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
                    <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
            </defs>
            <path d={COURT.floor} fill="url(#auth-court-floor)" />
            <path className="court-mat" d={COURT.court} />
            <path className="court-lines" d={COURT.lines} />
            <path className="court-shadow" d={COURT.shadow} />
            <path className="court-net" d={COURT.net} />
            <path className="court-mesh" d={COURT.mesh} />
            <path className="court-tape" d={COURT.tape} />
            <path className="court-posts" d={COURT.posts} />
            <rect
                className="court-light"
                width={COURT.width}
                height={COURT.height}
                fill="url(#auth-court-light)"
            />
        </svg>
    );
}

function Brand() {
    return (
        <Link href="/" className="auth-brand">
            <BrandMark size={28} />
            <span>
                Shop <strong>Cầu Lông</strong>
            </span>
        </Link>
    );
}

/** Sign-in, sign-up, password and two-factor screens: the hall on one side, the form on paper. */
export default function AuthCourtLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="auth-shell brand-ui" lang="vi">
            <aside className="auth-hall" aria-label="Shop Cầu Lông">
                <Court />
                <img
                    className="auth-racket"
                    src="/models/hyper-core-poster.png"
                    alt=""
                    width="680"
                    height="800"
                    decoding="async"
                />
                <Brand />
                <div className="auth-hall-copy">
                    <p>Tài khoản Shop Cầu Lông</p>
                    <h2>Theo dõi đơn, vợt đang đan và những cây bạn để ý.</h2>
                    <ul>
                        <li>
                            <Check size={16} aria-hidden="true" />
                            Xem lại đơn hàng và yêu cầu đan dây
                        </li>
                        <li>
                            <Check size={16} aria-hidden="true" />
                            Lưu vợt yêu thích, viết đánh giá sau khi nhận
                        </li>
                        <li>
                            <Check size={16} aria-hidden="true" />
                            Không cần tài khoản vẫn đặt hàng được
                        </li>
                    </ul>
                </div>
            </aside>
            <main className="auth-panel">
                <div className="auth-top">
                    <Brand />
                    <Link href="/products" className="auth-back">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Về cửa hàng
                    </Link>
                </div>
                <div className="auth-body">
                    <header className="auth-heading">
                        <h1>{title}</h1>
                        {description && <p>{description}</p>}
                    </header>
                    {children}
                </div>
            </main>
        </div>
    );
}
