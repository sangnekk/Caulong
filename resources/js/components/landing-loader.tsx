import { useEffect, useRef, useState } from 'react';

import '../../css/landing-loader.css';

// Tab-scoped: the intro plays once per session so shop navigation / back does not replay it.
export const LANDING_LOADER_SESSION_KEY = 'shop-cau-long:landing-intro-seen';

const POSTER = '/models/hyper-core-poster.png';
const MIN_VISIBLE_MS = 600;
const MAX_VISIBLE_MS = 4000;
const EXIT_MS = 300;

type LandingLoaderProps = {
    /** Fired once the overlay has unmounted (after exit, or immediately when suppressed). */
    onDone?: () => void;
};

const reducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hasSeen = () => {
    try {
        return (
            window.sessionStorage.getItem(LANDING_LOADER_SESSION_KEY) === '1'
        );
    } catch {
        return false;
    }
};

const remember = () => {
    try {
        window.sessionStorage.setItem(LANDING_LOADER_SESSION_KEY, '1');
    } catch {
        // Storage disabled / private mode: overlay simply plays again next visit.
    }
};

export default function LandingLoader({ onDone }: LandingLoaderProps) {
    // Client-side entry: paint the intro on the first React frame, not one effect later.
    const [open, setOpen] = useState(
        () => typeof window !== 'undefined' && !hasSeen(),
    );
    const [exiting, setExiting] = useState(false);
    const skip = useRef<HTMLButtonElement>(null);
    const dismissRef = useRef<() => void>(() => {});
    const done = useRef(false);
    const dismissed = useRef(false);
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    // Client-only decision: server renders nothing, so the overlay cannot hydrate-mismatch.
    useEffect(() => {
        if (hasSeen()) {
            if (!done.current) {
                done.current = true;
                onDoneRef.current?.();
            }
            return;
        }
        setOpen(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        dismissed.current = false;
        const reduced = reducedMotion();
        const body = document.body;
        const previousOverflow = body.style.overflow;
        body.style.overflow = 'hidden';
        skip.current?.focus();

        let cancelled = false;
        const timers: number[] = [];
        const wait = (ms: number, fn: () => void) => {
            if (ms <= 0) {
                fn();
                return;
            }
            timers.push(window.setTimeout(fn, ms));
        };

        const dismiss = () => {
            if (cancelled || dismissed.current) return;
            dismissed.current = true;
            remember();
            setExiting(true);
            wait(reduced ? 0 : EXIT_MS, () => {
                setOpen(false);
                done.current = true;
                onDoneRef.current?.();
            });
        };
        dismissRef.current = dismiss;

        // Ready when the poster has settled (load OR error: it is an enhancement, never a gate)
        // and webfonts are usable. Never sooner than the anti-flash floor.
        const poster = new Image();
        poster.fetchPriority = 'high';
        const posterSettled = new Promise<void>((resolve) => {
            poster.onload = () => resolve();
            poster.onerror = () => resolve();
            poster.src = POSTER;
        });
        const fonts = document.fonts?.ready ?? Promise.resolve();
        const ready = Promise.all([posterSettled, fonts]).then(
            () =>
                new Promise<void>((resolve) => {
                    wait(reduced ? 0 : MIN_VISIBLE_MS, resolve);
                }),
        );
        const ceiling = new Promise<void>((resolve) => {
            // Hard ceiling: a broken network can never trap the visitor here.
            timers.push(window.setTimeout(resolve, MAX_VISIBLE_MS));
        });
        void Promise.race([ready, ceiling]).then(dismiss);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                dismiss();
                return;
            }
            // Single-action dialog: keep Tab on the one control instead of leaking behind it.
            if (event.key === 'Tab') {
                event.preventDefault();
                skip.current?.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            cancelled = true;
            timers.forEach((id) => window.clearTimeout(id));
            document.removeEventListener('keydown', onKeyDown);
            body.style.overflow = previousOverflow;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="landing-loader"
            data-state={exiting ? 'exiting' : 'active'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-loader-title"
            aria-describedby="landing-loader-status"
        >
            <svg
                className="landing-loader__court"
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
                focusable="false"
            >
                <g className="landing-loader__lines">
                    <rect x="360" y="110" width="720" height="680" />
                    <line x1="383" y1="110" x2="383" y2="790" />
                    <line x1="1057" y1="110" x2="1057" y2="790" />
                    <line x1="360" y1="149" x2="1080" y2="149" />
                    <line x1="360" y1="751" x2="1080" y2="751" />
                    <line x1="360" y1="350" x2="1080" y2="350" />
                    <line x1="360" y1="550" x2="1080" y2="550" />
                    <line x1="720" y1="110" x2="720" y2="350" />
                    <line x1="720" y1="550" x2="720" y2="790" />
                    <line
                        className="is-net"
                        x1="322"
                        y1="450"
                        x2="1118"
                        y2="450"
                    />
                </g>
                <path
                    className="landing-loader__trail"
                    d="M390 650 Q720 -60 1050 250"
                />
                <g className="landing-loader__shuttle">
                    <path
                        className="feathers"
                        d="M-6 -3 L-16 -22 M0 -5 L0 -24 M6 -3 L16 -22 M-16 -22 Q0 -30 16 -22"
                    />
                    <circle className="cork" cx="0" cy="0" r="7" />
                </g>
            </svg>
            <div className="landing-loader__panel">
                <p className="landing-loader__brand" id="landing-loader-title">
                    <span>SHOP</span> <strong>CẦU LÔNG</strong>
                </p>
                <p
                    className="landing-loader__status"
                    id="landing-loader-status"
                    role="status"
                    aria-live="polite"
                >
                    Đang chuẩn bị trải nghiệm
                </p>
                <button
                    className="landing-loader__skip"
                    ref={skip}
                    type="button"
                    onClick={() => dismissRef.current()}
                >
                    Bỏ qua
                </button>
            </div>
        </div>
    );
}
