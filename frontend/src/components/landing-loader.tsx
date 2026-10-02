import { useEffect, useRef, useState } from 'react';
import RacketBlueprint, {
    BLUEPRINT_BOX,
    BLUEPRINT_SCALE,
    HEAD_CENTER,
    MAIN_COUNT,
    STRING_COUNT,
} from '@/components/racket-blueprint';
import { racketLoad } from '@/lib/racket-load';
import type { RacketAffine } from '@/lib/racket-load';

import '../../css/landing-loader.css';

// A document reload creates a fresh module; an Inertia visit keeps this flag. A link to a
// section (#hoi-dap) goes straight there instead.
let seenInDocument = false;
export const shouldShowLandingIntro = () =>
    typeof window !== 'undefined' && !seenInDocument && !window.location.hash;

// On reload Inertia scrolls back to the saved position one frame after the first render,
// under the intro. The intro is staged on the first screen, so a reload of the landing
// starts at the top (only here: during an SPA visit this state still belongs to the old page).
if (
    shouldShowLandingIntro() &&
    window.location.pathname === '/' &&
    window.history.state?.documentScrollPosition
)
    window.history.replaceState(
        {
            ...window.history.state,
            documentScrollPosition: { top: 0, left: 0 },
        },
        '',
    );

export type RevealMode = 'pull' | 'fade' | 'cut';

const POSTER = '/models/hyper-core-poster.png';
const DRAW_MS = 560;
// Fastest cadence, so even a cached model is strung in about a second.
const STRING_MS = 26;
const SETTLE_MS = 260;
const PULL_MS = 1050;
// Share of the pull after which the drawing hands over to the 3D render beneath it.
const MATERIALIZE_AT = 0.7;
const FADE_MS = 420;
// Slow network: stop waiting here; the story shows the same progress in place.
const CEILING_MS = 10000;

type LandingLoaderProps = {
    /** The landing starts its entrance: court pull-back, 3D, header and copy. */
    onReveal?: (mode: RevealMode) => void;
    /** Fired once the overlay has unmounted (after exit, or immediately when suppressed). */
    onDone?: () => void;
};

const reducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Close-up on the head, on the racket's side of the net and less tilted than the story pose. */
function closeUp(width: number, height: number) {
    const mobile = width < 768;
    const scale = mobile
        ? Math.min((width * 0.64) / 1.72, (height * 0.4) / 2.12)
        : Math.min((height * 0.64) / 2.12, (width * 0.4) / 1.72);
    const angle = (12 * Math.PI) / 180;
    const x = width * (mobile ? 0.5 : 0.63);
    const y = height * (mobile ? 0.33 : 0.47);
    const cos = Math.cos(angle) * scale;
    const sin = Math.sin(angle) * scale;
    const affine: RacketAffine = {
        a: cos,
        b: sin,
        c: -sin,
        d: cos,
        e: x - sin * HEAD_CENTER,
        f: y + cos * HEAD_CENTER,
    };
    return { affine, x, y };
}

// Model-plane affine -> CSS matrix for the svg box laid out at BLUEPRINT_SCALE px per unit.
const toCss = ({ a, b, c, d, e, f }: RacketAffine) =>
    'matrix(' +
    [
        a / BLUEPRINT_SCALE,
        b / BLUEPRINT_SCALE,
        c / BLUEPRINT_SCALE,
        d / BLUEPRINT_SCALE,
        e + a * BLUEPRINT_BOX.x + c * BLUEPRINT_BOX.y,
        f + b * BLUEPRINT_BOX.x + d * BLUEPRINT_BOX.y,
    ].join(',') +
    ')';

export default function LandingLoader({
    onReveal,
    onDone,
}: LandingLoaderProps) {
    // Client-side entry: paint the intro on the first React frame, not one effect later.
    const [open, setOpen] = useState(shouldShowLandingIntro);
    const [stage, setStage] = useState<'stringing' | 'pulling' | 'fading'>(
        'stringing',
    );
    const [strung, setStrung] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [framing, setFraming] = useState(() =>
        typeof window === 'undefined'
            ? null
            : closeUp(window.innerWidth, window.innerHeight),
    );
    const root = useRef<HTMLDivElement>(null);
    const drawing = useRef<SVGSVGElement>(null);
    const skip = useRef<HTMLButtonElement>(null);
    const dismissRef = useRef<() => void>(() => {});
    const done = useRef(false);
    const callbacks = useRef({ onReveal, onDone });
    callbacks.current = { onReveal, onDone };

    useEffect(() => {
        if (!open && !done.current) {
            done.current = true;
            callbacks.current.onDone?.();
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        const reduced = reducedMotion();
        const landing =
            root.current?.closest<HTMLElement>('.badminton-landing');
        const body = document.body;
        const previousOverflow = body.style.overflow;
        // The intro is staged on the story's first screen: hold the page there until it hands
        // over, whatever restores a scroll position in the meantime (browser, Inertia, anchor).
        const pin = () => {
            if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
        };
        pin();
        window.addEventListener('scroll', pin);
        body.style.overflow = 'hidden';
        skip.current?.focus();

        let cancelled = false;
        let dismissed = false;
        let frame = 0;
        let count = 0;
        let lastString = 0;
        let fullAt = 0;
        let near = closeUp(window.innerWidth, window.innerHeight);
        const timers: number[] = [];
        const wait = (ms: number, fn: () => void) => {
            timers.push(window.setTimeout(fn, ms));
        };
        const frameCourt = () => {
            landing?.style.setProperty('--intro-x', near.x + 'px');
            landing?.style.setProperty('--intro-y', near.y + 'px');
        };
        frameCourt();

        // The poster stands in for the racket whenever the 3D is not what we reveal.
        let posterSettled = false;
        const poster = new Image();
        poster.onload = poster.onerror = () => {
            posterSettled = true;
        };
        poster.src = POSTER;
        let fontsReady = !document.fonts;
        void document.fonts?.ready.then(() => {
            fontsReady = true;
        });

        const finish = () => {
            if (cancelled) return;
            body.style.overflow = previousOverflow;
            setOpen(false);
            done.current = true;
            callbacks.current.onDone?.();
        };

        const reveal = (interrupted: boolean) => {
            if (cancelled || dismissed) return;
            dismissed = true;
            seenInDocument = true;
            cancelAnimationFrame(frame);
            const load = racketLoad.get();
            const target =
                !interrupted && !reduced && load.phase === 'ready'
                    ? load.measure?.()
                    : null;
            const mode: RevealMode = reduced ? 'cut' : target ? 'pull' : 'fade';
            callbacks.current.onReveal?.(mode);
            if (mode === 'cut') {
                finish();
                return;
            }
            if (target && drawing.current) {
                setStage('pulling');
                drawing.current.animate(
                    [
                        { transform: toCss(near.affine) },
                        { transform: toCss(target) },
                    ],
                    {
                        duration: PULL_MS,
                        easing: 'cubic-bezier(0.7, 0, 0.16, 1)',
                        fill: 'forwards',
                    },
                );
                wait(PULL_MS * MATERIALIZE_AT, () => setStage('fading'));
                wait(PULL_MS * MATERIALIZE_AT + FADE_MS, finish);
                return;
            }
            setStage('fading');
            wait(FADE_MS, finish);
        };
        dismissRef.current = () => reveal(true);

        const started = performance.now();
        const tick = (now: number) => {
            frame = requestAnimationFrame(tick);
            const load = racketLoad.get();
            const settled =
                load.phase === 'ready' ||
                load.phase === 'static' ||
                load.phase === 'error';
            // The last string waits for the render to be usable, not just downloaded.
            const target = settled
                ? STRING_COUNT
                : Math.min(
                      STRING_COUNT - 1,
                      Math.floor(load.progress * STRING_COUNT),
                  );
            if (
                count < target &&
                now - started >= (reduced ? 0 : DRAW_MS * 0.7) &&
                (reduced || now - lastString >= STRING_MS)
            ) {
                count = reduced ? target : count + 1;
                lastString = now;
                if (count === STRING_COUNT) fullAt = now;
                setStrung(count);
            }
            if (settled) setLoaded(true);
            const posterReady = load.phase === 'ready' || posterSettled;
            if (
                count === STRING_COUNT &&
                settled &&
                posterReady &&
                fontsReady &&
                now - fullAt >= (reduced ? 0 : SETTLE_MS)
            )
                reveal(false);
            else if (now - started >= CEILING_MS) reveal(true);
        };
        frame = requestAnimationFrame(tick);

        const onResize = () => {
            if (dismissed) return;
            near = closeUp(window.innerWidth, window.innerHeight);
            frameCourt();
            setFraming(near);
        };
        window.addEventListener('resize', onResize);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                reveal(true);
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
            cancelAnimationFrame(frame);
            timers.forEach((id) => window.clearTimeout(id));
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', pin);
            document.removeEventListener('keydown', onKeyDown);
            body.style.overflow = previousOverflow;
        };
    }, [open]);

    if (!open || !framing) return null;

    const crosses = strung > MAIN_COUNT;
    const complete = strung === STRING_COUNT;

    return (
        <div
            ref={root}
            className="landing-loader"
            data-state={stage}
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-loader-title"
            aria-describedby="landing-loader-status"
        >
            <RacketBlueprint
                ref={drawing}
                strung={strung}
                className="landing-loader__drawing"
                style={{ transform: toCss(framing.affine) }}
            />
            <h2 className="landing-loader__title" id="landing-loader-title">
                Shop Cầu Lông
            </h2>
            <div className="landing-loader__bar">
                <p className="landing-loader__count" aria-hidden="true">
                    <span>
                        {complete
                            ? 'Căng xong'
                            : crosses
                              ? 'Đan dây ngang'
                              : 'Căng dây dọc'}
                    </span>
                    <b>
                        {complete
                            ? '44 dây'
                            : crosses
                              ? strung - MAIN_COUNT + '/24'
                              : strung + '/20'}
                    </b>
                </p>
                <p
                    className="landing-loader__status"
                    id="landing-loader-status"
                    role="status"
                    aria-live="polite"
                >
                    {loaded
                        ? 'Vợt đã sẵn sàng.'
                        : 'Đang chuẩn bị vợt 3D. Bạn có thể bỏ qua.'}
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
