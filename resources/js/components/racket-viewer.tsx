import { RotateCcw, RotateCw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { RacketPart, RacketScene } from '@/lib/racket-scene';

type Props = {
    part?: RacketPart;
    className?: string;
    story?: boolean;
    onReady?: (scene: RacketScene | null) => void;
};
const styles = [
    '.rv-viewer{position:relative;min-width:0;color:inherit;width:100%;height:100%;display:flex;flex-direction:column}',
    '.rv-viewer .rv-stage{position:relative;width:100%;min-height:0;flex:1;touch-action:pan-y}',
    '.rv-viewer .rv-canvas,.rv-viewer .rv-poster{position:absolute;inset:0;width:100%;height:100%}',
    '.rv-viewer .rv-poster{object-fit:contain;pointer-events:none}',
    '.rv-viewer .rv-controls{display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}',
    '.rv-viewer .rv-controls button,.rv-viewer .rv-retry{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border:1px solid oklch(1 0 0 / .4);border-radius:50%;background:oklch(.25 .065 260);color:oklch(1 0 0);cursor:pointer}',
    '.rv-viewer .rv-controls button:hover:not(:disabled),.rv-viewer .rv-retry:hover{background:oklch(.36 .09 260)}',
    '.rv-viewer .rv-controls button:disabled{opacity:.4;cursor:default}',
    '.rv-viewer button:focus-visible{outline:3px solid oklch(.91 .14 115);outline-offset:4px}',
    '.rv-viewer .rv-retry{border-radius:6px;padding:0 16px;gap:8px;margin-top:8px}',
    '.rv-viewer .rv-caption{font-size:12px;line-height:1.6;text-align:center;margin:14px 0 0}',
    '.rv-viewer .rv-status{font-size:13px;text-align:center;min-height:22px;margin:6px 0 0}',
    '.rv-viewer .rv-error{text-align:center}',
    '.rv-viewer.rv-story .rv-stage{position:absolute;inset:0;height:100%}',
    '@media(prefers-reduced-motion:reduce){.rv-viewer *{animation:none!important;transition:none!important}}',
].join('');

export default function RacketViewer({
    part = 'all',
    className = '',
    story = false,
    onReady,
}: Props) {
    const host = useRef<HTMLDivElement>(null);
    const scene = useRef<RacketScene | null>(null);
    const selectedPart = useRef(part);
    const readyCallback = useRef(onReady);
    useEffect(() => {
        readyCallback.current = onReady;
    }, [onReady]);
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading',
    );
    const descriptionId = useId();
    useEffect(() => {
        selectedPart.current = part;
        scene.current?.setPart(part);
    }, [part]);
    useEffect(() => {
        const element = host.current;
        if (!element) return;
        const controller = new AbortController();
        let activeScene: RacketScene | null = null;
        let started = false;
        let failed = false;
        let observer: IntersectionObserver | undefined;
        const fail = () => {
            if (controller.signal.aborted) return;
            failed = true;
            activeScene?.dispose();
            scene.current = null;
            readyCallback.current?.(null);
            setStatus('error');
        };
        const start = async () => {
            if (started || controller.signal.aborted) return;
            started = true;
            observer?.disconnect();
            try {
                const { createRacketScene } =
                    await import('@/lib/racket-scene');
                if (controller.signal.aborted) return;
                const instance = await createRacketScene(
                    element,
                    controller.signal,
                    fail,
                );
                if (controller.signal.aborted) {
                    instance.dispose();
                    return;
                }
                activeScene = instance;
                scene.current = instance;
                instance.setPart(selectedPart.current);
                if (story) instance.setProgress(0);
                if (!failed) {
                    setStatus('ready');
                    readyCallback.current?.(instance);
                }
            } catch {
                fail();
            }
        };
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) void start();
                },
                { rootMargin: '160px' },
            );
            observer.observe(element);
        } else void start();
        return () => {
            controller.abort();
            observer?.disconnect();
            activeScene?.dispose();
            if (scene.current === activeScene) scene.current = null;
            readyCallback.current?.(null);
        };
    }, [attempt, story]);
    const controls = [
        {
            label: 'Xoay trái',
            Icon: RotateCcw,
            action: () => scene.current?.rotate(-1),
        },
        {
            label: 'Xoay phải',
            Icon: RotateCw,
            action: () => scene.current?.rotate(1),
        },
        {
            label: 'Phóng to',
            Icon: ZoomIn,
            action: () => scene.current?.zoom(1),
        },
        {
            label: 'Thu nhỏ',
            Icon: ZoomOut,
            action: () => scene.current?.zoom(-1),
        },
        {
            label: 'Đặt lại góc nhìn',
            Icon: RefreshCw,
            action: () => scene.current?.reset(),
        },
    ];
    return (
        <div
            className={'rv-viewer ' + (story ? 'rv-story ' : '') + className}
            data-status={status}
        >
            <style>{styles}</style>
            <div
                className="rv-stage"
                role={story ? undefined : 'img'}
                aria-hidden={story || undefined}
                aria-label={
                    story
                        ? undefined
                        : 'Mô hình vợt Hyper Core8000 của ghks1120'
                }
                aria-describedby={story ? undefined : descriptionId}
            >
                {
                    <img
                        className="rv-poster"
                        src="/models/hyper-core-poster.png"
                        alt=""
                        width={700}
                        height={700}
                        decoding="async"
                        fetchPriority="high"
                    />
                }
                <div className="rv-canvas" ref={host} />
            </div>
            {!story && (
                <div
                    className="rv-controls"
                    role="group"
                    aria-label="Điều khiển vợt 3D"
                >
                    {controls.map(({ label, Icon, action }) => (
                        <button
                            key={label}
                            type="button"
                            aria-label={label}
                            title={label}
                            disabled={status !== 'ready'}
                            onClick={action}
                        >
                            <Icon
                                size={18}
                                strokeWidth={1.6}
                                aria-hidden="true"
                            />
                        </button>
                    ))}
                </div>
            )}
            <div
                className="rv-loading-track"
                hidden={status !== 'loading'}
                aria-hidden="true"
            >
                <span />
            </div>
            <p className="rv-status" role="status" aria-live="polite">
                {status === 'ready'
                    ? story
                        ? 'Cuộn để xem từng bộ phận'
                        : 'Kéo ngang để xoay · Dùng nút để phóng to'
                    : status === 'loading'
                      ? 'Đang tải và chuẩn bị hình vợt. Bạn vẫn có thể xem bản tĩnh.'
                      : 'Chưa tải được vợt xoay. Bạn có thể xem ảnh hoặc thử lại.'}
            </p>
            {status === 'error' && (
                <div className="rv-error">
                    <button
                        className="rv-retry"
                        type="button"
                        onClick={() => {
                            setStatus('loading');
                            setAttempt((value) => value + 1);
                        }}
                    >
                        <RefreshCw size={16} aria-hidden="true" /> Tải lại hình
                        vợt
                    </button>
                </div>
            )}
            {!story && (
                <p className="rv-caption" id={descriptionId}>
                    Hyper Core8000 · ghks1120 · CC BY 4.0. Mặt dây đan được bổ
                    sung để minh họa.
                </p>
            )}
        </div>
    );
}
