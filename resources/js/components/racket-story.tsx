import { Link } from '@inertiajs/react';
import { ArrowDown, ArrowRight, Pause, Play } from 'lucide-react';
import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import type { CSSProperties } from 'react';
import { courtView } from '@/lib/court-view';
import { downloadRacketModel, onRacketDownload } from '@/lib/racket-download';
import { racketLoad, useRacketLoad } from '@/lib/racket-load';
import type { RacketScene } from '@/lib/racket-scene';
import '../../css/racket-story.css';

const Viewer = lazy(() => import('@/components/racket-viewer'));
const STATIC_QUERY = '(prefers-reduced-motion: reduce), (max-height: 550px)';

// The 5 MB model is the long pole: start it with this chunk, alongside three.js.
if (typeof window !== 'undefined' && !window.matchMedia(STATIC_QUERY).matches)
    void downloadRacketModel().catch(() => {
        // The viewer retries and shows its own error state.
    });
// Each chapter: one sentence in two halves (the second quieter), then one short paragraph.
const chapters = [
    {
        label: 'Tổng thể',
        title: ['Hiểu cây vợt', 'trước khi chọn.'],
        text: 'Khung, thân, cán, mặt dây: mỗi phần đổi một chút cảm giác trong tay. Xem gần từng phần, rồi chọn cây hợp với lối chơi của bạn.',
    },
    {
        label: 'Đầu vợt',
        title: ['Khung vợt', 'giữ cả mặt dây.'],
        text: 'Vành khung chịu lực căng của toàn bộ mặt dây. Mỗi lỗ luồn dây có một ống gen nhỏ để dây không cọ vào cạnh khung.',
    },
    {
        label: 'Thân vợt',
        title: ['Thân vợt', 'truyền lực cổ tay.'],
        text: 'Thanh mảnh nối cán với đầu vợt, uốn nhẹ theo mỗi cú vung. Cứng hay dẻo là cảm giác nên thử bằng chính tay mình.',
    },
    {
        label: 'Cán vợt',
        title: ['Cán vợt,', 'nơi bàn tay quyết định.'],
        text: 'Độ dày, lớp quấn và độ bám cho biết bạn cầm chắc hay phải gồng tay. Phần đang phóng gần là lớp quấn cán.',
    },
    {
        label: 'Mặt dây',
        title: ['Mặt dây,', 'nơi cầu chạm.'],
        text: 'Dây dọc đan qua dây ngang thành mặt lưới. Lưới trên mô hình được thêm để minh họa, không phải thông số căng dây.',
    },
    {
        label: 'Chọn vợt',
        title: ['Giờ là lúc', 'chọn cây của bạn.'],
        text: 'Thử độ nặng, độ dễ vung và cảm giác cầm. Cửa hàng lọc sẵn theo lối chơi để bạn bắt đầu.',
    },
] as const;
const smooth = (value: number) => value * value * (3 - 2 * value);

/** Doubles court to scale (13.40 × 6.10 m), drawn in metres. */
// Projected once per layout; the court is still, only the racket and camera move.
const COURTS = { wide: courtView('wide'), tall: courtView('tall') };

function CourtArena() {
    return (
        <div className="court-plan">
            {(['wide', 'tall'] as const).map((kind) => {
                const view = COURTS[kind];
                const [cx, cy] = view.centre;
                return (
                    <svg
                        key={kind}
                        className={'court-view court-view--' + kind}
                        viewBox={'0 0 ' + view.width + ' ' + view.height}
                        preserveAspectRatio="xMidYMid slice"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <defs>
                            <linearGradient
                                id={'court-floor-' + kind}
                                gradientUnits="userSpaceOnUse"
                                x1="0"
                                y1={view.horizon}
                                x2="0"
                                y2={view.height}
                            >
                                <stop offset="0" stopColor="var(--arena-far)" />
                                <stop
                                    offset="1"
                                    stopColor="var(--arena-floor)"
                                />
                            </linearGradient>
                            <radialGradient
                                id={'court-light-' + kind}
                                gradientUnits="userSpaceOnUse"
                                cx={cx}
                                cy={cy}
                                r={view.height * 0.62}
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
                                <stop
                                    offset="0"
                                    stopColor="#fff"
                                    stopOpacity="0.16"
                                />
                                <stop
                                    offset="0.55"
                                    stopColor="#fff"
                                    stopOpacity="0.05"
                                />
                                <stop
                                    offset="1"
                                    stopColor="#fff"
                                    stopOpacity="0"
                                />
                            </radialGradient>
                        </defs>
                        <path
                            className="court-floor"
                            d={view.floor}
                            fill={'url(#court-floor-' + kind + ')'}
                        />
                        <path className="court-mat" d={view.court} />
                        <path className="court-lines" d={view.lines} />
                        <path className="court-shadow" d={view.shadow} />
                        <path className="court-net" d={view.net} />
                        <path className="court-mesh" d={view.mesh} />
                        <path className="court-tape" d={view.tape} />
                        <path className="court-posts" d={view.posts} />
                        <rect
                            className="court-light"
                            width={view.width}
                            height={view.height}
                            fill={'url(#court-light-' + kind + ')'}
                        />
                    </svg>
                );
            })}
        </div>
    );
}

/** The wait the intro already showed, continued in place when the visitor skips it. */
function StringingMeter() {
    const { progress } = useRacketLoad();
    return (
        <span className="stringing-meter" aria-hidden="true">
            <span style={{ transform: 'scaleX(' + progress + ')' }} />
        </span>
    );
}

export default function RacketStory() {
    const root = useRef<HTMLElement>(null);
    const scene = useRef<RacketScene | null>(null);
    const progress = useRef(0);
    const marker = useRef<HTMLDivElement>(null);
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia(STATIC_QUERY).matches,
    );
    const [ready, setReady] = useState(false);
    const [reading, setReading] = useState(false);
    const [active, setActive] = useState(0);
    const cinematic = !reduced && !reading;
    const onReady = useCallback((value: RacketScene | null) => {
        scene.current = value;
        value?.setProgress(progress.current);
        setReady(Boolean(value));
        if (!value) return;
        racketLoad.set({
            phase: 'ready',
            progress: 1,
            measure: () => {
                const affine = value.getScreenAffine();
                const host = root.current
                    ?.querySelector('.rv-canvas')
                    ?.getBoundingClientRect();
                if (!affine || !host) return null;
                return {
                    ...affine,
                    e: affine.e + host.left,
                    f: affine.f + host.top,
                };
            },
        });
    }, []);
    const onProgress = useCallback((fraction: number) => {
        if (racketLoad.get().phase !== 'ready')
            racketLoad.set({ phase: 'loading', progress: fraction });
    }, []);
    const onFail = useCallback(() => {
        racketLoad.set({ phase: 'error', measure: null });
    }, []);

    useEffect(() => {
        if (!cinematic) {
            racketLoad.set({ phase: 'static', progress: 1, measure: null });
            return () =>
                racketLoad.set({ phase: 'idle', progress: 0, measure: null });
        }
        racketLoad.set({ phase: 'loading', progress: 0, measure: null });
        // Bytes count before the viewer chunk has even arrived.
        const stop = onRacketDownload((fraction) =>
            onProgress(fraction * 0.86),
        );
        return () => {
            stop();
            racketLoad.set({ phase: 'idle', progress: 0, measure: null });
        };
    }, [cinematic, onProgress]);

    useEffect(() => {
        const media = matchMedia(STATIC_QUERY);
        const change = () => setReduced(media.matches);
        change();
        media.addEventListener('change', change);
        return () => media.removeEventListener('change', change);
    }, []);

    useEffect(() => {
        const element = root.current;
        if (!element || !cinematic) return;
        const stage = element.querySelector<HTMLElement>('.story-stage')!;
        const panels = [
            ...element.querySelectorAll<HTMLElement>('.story-panel'),
        ];
        const bar = element.querySelector<HTMLElement>('.story-progress span')!;
        let frame = 0,
            previous = -1,
            start = 0,
            range = 1,
            target = 0,
            current = 0,
            lastTime = 0;
        let stageWidth = 1,
            stageHeight = 1,
            markerWidth = 0;
        let alive = true;
        const opacity = panels.map(() => -1);
        const measure = () => {
            start = scrollY + element.getBoundingClientRect().top;
            stageWidth = stage.clientWidth;
            stageHeight = stage.offsetHeight;
            markerWidth = 0;
            range = Math.max(1, element.offsetHeight - stageHeight);
            const anchor =
                element.querySelector<HTMLElement>('.material-anchor');
            if (anchor) anchor.style.top = range / (chapters.length - 1) + 'px';
        };
        const paint = (amount: number) => {
            progress.current = amount;
            // Keep the introduction readable until textures and the first frame are ready.
            const chapter = (ready ? amount : 0) * (chapters.length - 1);
            const index = Math.round(chapter);
            bar.style.transform = 'scaleX(' + amount + ')';
            panels.forEach((panel, i) => {
                const fade =
                    1 -
                    smooth(
                        Math.max(
                            0,
                            Math.min(1, (Math.abs(chapter - i) - 0.18) / 0.36),
                        ),
                    );
                if (fade !== opacity[i]) {
                    panel.style.opacity = String(fade);
                    panel.style.transform =
                        'translate3d(0,' + (i - chapter) * 18 + 'px,0)';
                    opacity[i] = fade;
                }
                if (previous !== index) {
                    panel.inert = i !== index;
                    panel.setAttribute('aria-hidden', String(i !== index));
                }
            });
            scene.current?.setProgress(amount);
            const point = scene.current?.getAnnotation();
            if (marker.current) {
                marker.current.hidden = !point;
                if (point) {
                    const label = marker.current.querySelector('span')!;
                    if (label.textContent !== point.label) {
                        label.textContent = point.label;
                        markerWidth = 0;
                    }
                    // Measure once per label; flip the callout when it would leave the stage.
                    if (!markerWidth) markerWidth = marker.current.offsetWidth;
                    const x = (point.x * stageWidth) / 100;
                    const left =
                        point.x > 65 || x + markerWidth > stageWidth - 12;
                    marker.current.style.transform =
                        'translate3d(' +
                        x +
                        'px,' +
                        (point.y * stageHeight) / 100 +
                        'px,0) translate(' +
                        (left ? '-100%' : '0') +
                        ',-50%)';
                    marker.current.dataset.side = left ? 'left' : 'right';
                }
            }
            if (previous !== index) {
                previous = index;
                element.dataset.chapter = String(index);
                setActive(index);
            }
        };
        const update = (time: number) => {
            frame = 0;
            if (!alive || document.hidden) return;
            const delta = Math.min(50, lastTime ? time - lastTime : 16);
            lastTime = time;
            current += (target - current) * (1 - Math.exp(-delta / 65));
            if (Math.abs(target - current) < 0.00015) current = target;
            paint(current);
            if (current !== target) frame = requestAnimationFrame(update);
            else lastTime = 0;
        };
        const schedule = () => {
            target = Math.max(0, Math.min(1, (scrollY - start) / range));
            if (!frame && !document.hidden)
                frame = requestAnimationFrame(update);
        };
        const resize = () => {
            measure();
            schedule();
        };
        const visibility = () => {
            if (document.hidden) {
                cancelAnimationFrame(frame);
                frame = 0;
                lastTime = 0;
            } else schedule();
        };
        measure();
        current = target = Math.max(0, Math.min(1, (scrollY - start) / range));
        paint(current);
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', visibility);
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        observer.observe(stage);
        void document.fonts.ready.then(() => {
            if (alive) resize();
        });
        return () => {
            alive = false;
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', visibility);
            if (marker.current) marker.current.hidden = true;
            panels.forEach((panel) => {
                panel.style.opacity = '';
                panel.style.transform = '';
                panel.inert = false;
                panel.removeAttribute('aria-hidden');
            });
        };
    }, [cinematic, ready]);

    const goTo = (index: number) => {
        const element = root.current;
        if (!element) return;
        if (!cinematic) {
            element.querySelectorAll('.story-panel')[index]?.scrollIntoView();
            return;
        }
        const stageHeight =
            element.querySelector<HTMLElement>('.story-stage')!.offsetHeight;
        window.scrollTo({
            top:
                scrollY +
                element.getBoundingClientRect().top +
                ((element.offsetHeight - stageHeight) * index) /
                    (chapters.length - 1),
            behavior: 'instant',
        });
    };

    return (
        <section
            ref={root}
            id="kham-pha-vot"
            className={
                'racket-story ' + (cinematic ? 'is-cinematic' : 'is-reading')
            }
            aria-label="Câu chuyện Hyper Core8000"
            data-surface="night"
            data-chapter="0"
            data-ready={ready}
            aria-busy={cinematic && !ready}
        >
            {cinematic && (
                <span
                    id="cac-bo-phan"
                    className="story-anchor material-anchor"
                />
            )}
            <div className="story-stage">
                <div className="story-backdrop" aria-hidden="true">
                    <CourtArena />
                </div>
                <div className="story-model">
                    {cinematic ? (
                        <Suspense
                            fallback={
                                <img
                                    src="/models/hyper-core-poster.png"
                                    alt="Hyper Core8000"
                                    width="700"
                                    height="800"
                                />
                            }
                        >
                            <Viewer
                                story
                                onReady={onReady}
                                onProgress={onProgress}
                                onFail={onFail}
                            />
                        </Suspense>
                    ) : (
                        <img
                            src="/models/hyper-core-poster.png"
                            alt="Hyper Core8000 với mặt dây đan minh họa bổ sung"
                            width="700"
                            height="800"
                        />
                    )}
                </div>
                <div
                    ref={marker}
                    className="anatomy-marker"
                    aria-hidden="true"
                    hidden
                >
                    <i />
                    <span />
                </div>
                <div className="story-panels">
                    {chapters.map((chapter, index) => {
                        const Heading = index === 0 ? 'h1' : 'h2';
                        return (
                            <article
                                key={chapter.label}
                                id={
                                    !cinematic && index === 1
                                        ? 'cac-bo-phan'
                                        : undefined
                                }
                                className="story-panel"
                                style={{ '--chapter': index } as CSSProperties}
                            >
                                <div className="story-copy">
                                    <Heading>
                                        <span className="story-line">
                                            <span>{chapter.title[0]}</span>
                                        </span>{' '}
                                        <span className="story-line">
                                            <span>{chapter.title[1]}</span>
                                        </span>
                                    </Heading>
                                    <p className="story-description">
                                        {chapter.text}
                                    </p>
                                    {index === 0 && (
                                        <div className="story-actions">
                                            <button
                                                className="story-next"
                                                disabled={cinematic && !ready}
                                                onClick={() => goTo(1)}
                                            >
                                                {cinematic && !ready ? (
                                                    <>
                                                        Đang căng dây…
                                                        <StringingMeter />
                                                    </>
                                                ) : (
                                                    <>
                                                        Xem từng phần{' '}
                                                        <ArrowDown size={18} />
                                                    </>
                                                )}
                                            </button>
                                            <Link
                                                className="story-store"
                                                href="/products"
                                                prefetch="hover"
                                                viewTransition
                                            >
                                                Vào cửa hàng{' '}
                                                <ArrowRight size={17} />
                                            </Link>
                                        </div>
                                    )}
                                    {index === 5 && (
                                        <div className="story-actions">
                                            <Link
                                                className="landing-button light-button"
                                                href="/products"
                                                prefetch="hover"
                                                viewTransition
                                            >
                                                Xem vợt trong cửa hàng{' '}
                                                <ArrowRight size={18} />
                                            </Link>
                                            <a
                                                className="story-store"
                                                href="#bo-suu-tap"
                                            >
                                                Chọn theo lối chơi
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
                <div className="story-bottom">
                    <nav
                        className="story-chapters"
                        aria-label="Các chương giới thiệu"
                    >
                        {chapters.map((chapter, index) => (
                            <button
                                key={chapter.label}
                                aria-current={
                                    cinematic && active === index
                                        ? 'step'
                                        : undefined
                                }
                                aria-label={'Đến chương ' + chapter.label}
                                onClick={() => goTo(index)}
                            >
                                <span className="chapter-label">
                                    {chapter.label}
                                </span>
                            </button>
                        ))}
                        <a className="story-skip" href="#bo-suu-tap">
                            Bỏ qua <ArrowDown size={13} aria-hidden="true" />
                        </a>
                    </nav>
                    <p className="story-caption" aria-hidden="true">
                        Hyper Core8000 · mô hình 3D
                    </p>
                    {!reduced && (
                        <button
                            className="story-mode"
                            onClick={() => setReading(!reading)}
                            aria-pressed={reading}
                        >
                            {reading ? <Play size={14} /> : <Pause size={14} />}
                            {reading
                                ? 'Xem lại mô hình 3D'
                                : 'Đọc bản không có 3D'}
                        </button>
                    )}
                </div>
                <div className="story-progress" aria-hidden="true">
                    <span />
                </div>
            </div>
        </section>
    );
}
