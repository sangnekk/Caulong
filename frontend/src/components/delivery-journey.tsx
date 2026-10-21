'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Bike,
    Check,
    Heart,
    MapPin,
    PackageCheck,
    Pause,
    Play,
    RotateCcw,
} from 'lucide-react';
import {
    DELIVERY_MORPH_SECONDS,
    deliveryMotion,
    drawDeliveryMorph,
    drawDeliveryScene,
    type DeliveryMorph,
    type DeliveryStage,
} from '@/lib/delivery-scene';
import '@/css/delivery-demo.css';

export const stages = {
    packing: {
        title: 'Gói ghém xong',
        description:
            'Cẩn thận từng chút một. Vợt được bọc bảo vệ, đóng hộp và sẵn sàng lên đường.',
        label: 'Gói ghém xong',
        note: 'Cẩn thận từng chút một',
    },
    shipping: {
        title: 'Vợt xinh đang tới bạn!',
        description:
            'Đã gói ghém cẩn thận. Giờ thì cùng bé shipper lên đường thôi.',
        label: 'Đang giao hàng',
        note: 'Mang theo một chút háo hức',
    },
    approaching: {
        title: 'Sắp tới rồi, bạn ơi!',
        description:
            'Bé shipper đang tới gần nhà. Bạn nhớ để ý điện thoại nhé.',
        label: 'Đang trên đường tới',
        note: 'Chặng cuối, thêm một nụ cười',
    },
};

function DeliveryCanvas({
    stage,
    paused,
    replay,
    stillTime,
    fastForward,
    onComplete,
}: {
    stage: DeliveryStage;
    paused: boolean;
    replay: number;
    stillTime?: number;
    fastForward: boolean;
    onComplete?: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const racketRef = useRef<HTMLImageElement | null>(null);
    const playback = useRef({
        target: stage,
        stage: 'packing' as DeliveryStage,
        time: 0,
        replay,
        origin: { travel: 0, wheel: 0, phase: 0 },
        complete: false,
    });
    const transition = useRef<DeliveryMorph | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        let reduced = media.matches;
        let visible = true;
        let frame = 0;
        let last = 0;
        let width = 0;
        let height = 0;
        const racket = racketRef.current ?? new Image();
        racketRef.current = racket;
        racket.onload = () => draw();
        if (!racket.src) racket.src = '/models/hyper-core-poster.png';
        if (
            playback.current.target !== stage ||
            playback.current.replay !== replay
        ) {
            playback.current = {
                target: stage,
                stage: 'packing',
                time: 0,
                replay,
                origin: { travel: 0, wheel: 0, phase: 0 },
                complete: false,
            };
            transition.current = null;
        }
        if (stillTime === 0) {
            playback.current.stage = stage;
            playback.current.time = 0;
            playback.current.complete = true;
            transition.current = null;
        }

        function enterStage(next: DeliveryStage) {
            const previous = playback.current;
            const motion = deliveryMotion(
                previous.stage,
                previous.time,
                previous.origin,
            );
            transition.current = {
                from: { stage: previous.stage, time: previous.time, motion },
                time: 0,
            };
            playback.current = {
                target: stage,
                stage: next,
                time: 0,
                replay,
                complete: false,
                origin:
                    previous.stage === 'packing'
                        ? { travel: 0, wheel: 0, phase: 0 }
                        : motion,
            };
        }

        function draw() {
            if (!context || !canvas || width === 0 || height === 0) return;
            context.setTransform(
                Math.min(window.devicePixelRatio || 1, 2),
                0,
                0,
                Math.min(window.devicePixelRatio || 1, 2),
                0,
                0,
            );
            if (reduced) {
                playback.current.stage = stage;
                playback.current.time =
                    stillTime ??
                    (stage === 'packing' ? 7 : stage === 'approaching' ? 6 : 0);
                playback.current.complete = true;
                transition.current = null;
            }
            if (
                transition.current &&
                transition.current.time >= DELIVERY_MORPH_SECONDS
            )
                transition.current = null;
            const active = playback.current;
            const time =
                active.complete && stillTime !== undefined
                    ? stillTime
                    : active.time;
            const motion = deliveryMotion(active.stage, time, active.origin);
            canvas.dataset.playbackStage = active.stage;
            canvas.dataset.historyComplete = String(active.complete);
            canvas.dataset.playbackRate = String(
                fastForward && !active.complete ? 3 : 1,
            );
            canvas.dataset.morphProgress = transition.current
                ? (transition.current.time / DELIVERY_MORPH_SECONDS).toFixed(3)
                : '1';
            if (transition.current) {
                drawDeliveryMorph(
                    context,
                    width,
                    height,
                    transition.current,
                    { stage: active.stage, time, motion },
                    racket,
                );
            } else {
                drawDeliveryScene(
                    context,
                    width,
                    height,
                    active.stage,
                    time,
                    reduced && stillTime !== 0,
                    racket,
                    { motion },
                );
            }
        }

        function tick(now: number) {
            const delta = last ? Math.min((now - last) / 1000, 0.05) : 0;
            const rate = fastForward && !playback.current.complete ? 3 : 1;
            playback.current.time += delta * rate;
            if (transition.current)
                transition.current.time += delta * Math.min(rate, 1.8);
            last = now;
            const active = playback.current;
            if (!transition.current && !active.complete) {
                if (
                    active.stage !== stage &&
                    active.time >= (active.stage === 'packing' ? 7 : 5)
                ) {
                    enterStage(
                        active.stage === 'packing' ? 'shipping' : 'approaching',
                    );
                } else if (
                    active.stage === stage &&
                    active.time >=
                        (stage === 'packing'
                            ? 7
                            : stage === 'approaching'
                              ? 6
                              : 0)
                ) {
                    active.complete = true;
                    onComplete?.();
                }
            }
            draw();
            if (!playback.current.complete || stillTime === undefined)
                frame = requestAnimationFrame(tick);
        }

        function sync() {
            cancelAnimationFrame(frame);
            last = 0;
            draw();
            if (
                !paused &&
                !reduced &&
                visible &&
                !document.hidden &&
                (!playback.current.complete || stillTime === undefined)
            )
                frame = requestAnimationFrame(tick);
        }

        const resize = new ResizeObserver(([entry]) => {
            width = entry.contentRect.width;
            height = entry.contentRect.height;
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
            sync();
        });
        const intersection = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            sync();
        });
        const motionChange = () => {
            reduced = media.matches;
            sync();
        };
        resize.observe(canvas);
        intersection.observe(canvas);
        document.addEventListener('visibilitychange', sync);
        media.addEventListener('change', motionChange);
        return () => {
            racket.onload = null;
            cancelAnimationFrame(frame);
            resize.disconnect();
            intersection.disconnect();
            document.removeEventListener('visibilitychange', sync);
            media.removeEventListener('change', motionChange);
        };
    }, [stage, paused, replay, stillTime, fastForward, onComplete]);

    return (
        <canvas
            ref={canvasRef}
            className="delivery-canvas"
            role="img"
            aria-label={
                stage === 'packing'
                    ? 'Bé nhân viên đặt vợt Hyper Core8000 vào hộp, phủ lớp bảo vệ, đóng nắp và dán nhãn cẩn thận.'
                    : stage === 'shipping'
                      ? 'Bé shipper đội mũ xanh, chở hộp vợt biết cười trên chiếc xe máy qua phố.'
                      : 'Bé shipper tới ngôi nhà mái xanh, dừng xe và vẫy tay chào bạn.'
            }
        >
            Bé shipper cùng hộp vợt biết cười đang mang đơn hàng tới bạn.
        </canvas>
    );
}

const stageOrder: DeliveryStage[] = ['packing', 'shipping', 'approaching'];
const stageIcons = {
    packing: PackageCheck,
    shipping: Bike,
    approaching: MapPin,
};
const timeline = [
    ['Gói ghém xong', 'Cẩn thận từng chút một'],
    ['Vi vu trên đường', 'Shipper và chiếc vợt nhỏ'],
    ['Sắp chạm cửa nhà', 'Niềm vui sắp tới rồi'],
];

export function DeliveryStagePicker({
    stage,
    onChange,
}: {
    stage: DeliveryStage;
    onChange: (stage: DeliveryStage) => void;
}) {
    return (
        <div className="delivery-picker">
            <span className="delivery-picker-label">
                Chọn mốc để xem lại hành trình
            </span>
            <div
                className="delivery-switch"
                role="group"
                aria-label="Chọn cảnh giao hàng"
            >
                {stageOrder.map((value) => {
                    const Icon = stageIcons[value];
                    return (
                        <button
                            key={value}
                            type="button"
                            data-stage={value}
                            aria-pressed={stage === value}
                            onClick={() => onChange(value)}
                        >
                            <Icon size={17} />
                            <span>{stages[value].label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

type JourneyCopy = {
    title: string;
    description: string;
    label: string;
    note: string;
};

export function DeliveryJourney({
    stage,
    isDemo = false,
    copy,
    stillTime,
    orderStatus,
    onStageChange,
    onSelectStage,
}: {
    stage: DeliveryStage;
    isDemo?: boolean;
    copy?: JourneyCopy;
    stillTime?: number;
    orderStatus?: string;
    onStageChange?: (stage: DeliveryStage) => void;
    onSelectStage?: (stage: DeliveryStage) => void;
}) {
    const [paused, setPaused] = useState(false);
    const [replay, setReplay] = useState(0);
    const [automatic, setAutomatic] = useState(false);
    useEffect(() => {
        const preference = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const change = () => {
            if (preference.matches) setAutomatic(false);
        };
        preference.addEventListener('change', change);
        return () => preference.removeEventListener('change', change);
    }, []);
    const current = copy ?? stages[stage];
    const activeIndex = stageOrder.indexOf(stage);
    const Icon = stageIcons[stage];
    const completeStage = useCallback(() => {
        setAutomatic(false);
    }, []);

    return (
        <div
            className={`delivery-journey${isDemo ? '' : ' delivery-journey--order'}`}
            data-order-status={orderStatus}
        >
            <section
                className="delivery-stage"
                aria-label="Hoạt cảnh giao hàng"
            >
                <div className="delivery-scene-top">
                    <span className="delivery-scene-label">
                        <span />
                        {current.label}
                    </span>
                    <span className="delivery-demo-label">
                        {isDemo ? 'Bản demo' : 'Minh họa'}
                    </span>
                </div>
                <DeliveryCanvas
                    stage={stage}
                    paused={paused}
                    replay={replay}
                    stillTime={stillTime}
                    fastForward={!automatic}
                    onComplete={completeStage}
                />
                <div className="delivery-scene-bottom">
                    <span>
                        <Heart size={14} /> {current.note}
                    </span>
                    <span className="delivery-scene-signature">
                        a little delivery of happiness
                    </span>
                </div>
            </section>
            <section
                className="delivery-status"
                aria-label={
                    isDemo ? 'Trạng thái mô phỏng' : 'Hành trình đơn hàng'
                }
            >
                <div
                    className="delivery-status-copy"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <span className="delivery-status-icon">
                        <Icon size={25} />
                    </span>
                    <div>
                        <h2>{current.title}</h2>
                        <p>{current.description}</p>
                    </div>
                </div>
                {stillTime !== 0 && (
                    <div className="delivery-controls">
                        <button
                            type="button"
                            onClick={() => setPaused(!paused)}
                            aria-label={
                                paused
                                    ? 'Tiếp tục hoạt ảnh'
                                    : 'Tạm dừng hoạt ảnh'
                            }
                            aria-pressed={paused}
                        >
                            {paused ? <Play size={16} /> : <Pause size={16} />}
                            <span>{paused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                        </button>
                        <button
                            type="button"
                            aria-label="Phát lại hoạt ảnh"
                            onClick={() => {
                                setReplay(replay + 1);
                                setPaused(false);
                            }}
                        >
                            <RotateCcw size={16} />
                            <span>Phát lại</span>
                        </button>
                        {isDemo && (
                            <button
                                type="button"
                                data-action="journey"
                                aria-label={
                                    automatic
                                        ? 'Dừng chạy tự động'
                                        : 'Chạy cả hành trình'
                                }
                                aria-pressed={automatic}
                                onClick={() => {
                                    if (automatic) {
                                        setAutomatic(false);
                                        setPaused(true);
                                    } else {
                                        setPaused(false);
                                        setReplay(replay + 1);
                                        onStageChange?.('approaching');
                                        setAutomatic(true);
                                    }
                                }}
                            >
                                <Play size={16} />
                                <span>
                                    {automatic
                                        ? 'Dừng tự động'
                                        : 'Chạy cả hành trình'}
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </section>
            {isDemo && (
                <ol
                    className="delivery-timeline"
                    aria-label="Các chặng mô phỏng"
                >
                    {stageOrder.map((value, index) => {
                        const StepIcon = stageIcons[value];
                        return (
                            <li
                                key={value}
                                className={
                                    index === activeIndex
                                        ? 'is-current'
                                        : index < activeIndex
                                          ? 'is-complete'
                                          : ''
                                }
                                aria-current={
                                    index === activeIndex ? 'step' : undefined
                                }
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        (onSelectStage ?? onStageChange)?.(
                                            value,
                                        )
                                    }
                                    className="delivery-timeline-button"
                                    aria-label={`Xem cảnh ${stages[value].label}`}
                                >
                                    <span className="delivery-step">
                                        {index < activeIndex ? (
                                            <Check size={14} />
                                        ) : (
                                            <StepIcon size={16} />
                                        )}
                                    </span>
                                    <span>
                                        {timeline[index][0]}
                                        <small>{timeline[index][1]}</small>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
            <p className="delivery-credit">
                Vợt minh họa: Hyper Core8000 ·{' '}
                <a
                    href="/models/HYPER-CORE-LICENSE.txt"
                    target="_blank"
                    rel="noreferrer"
                >
                    ghks1120 · CC BY 4.0
                </a>
            </p>
        </div>
    );
}

/** Only server-provided order states drive the live view. No simulated ETA. */
export function OrderDeliveryJourney({
    status,
    awaitingPayment,
}: {
    status: string;
    awaitingPayment: boolean;
}) {
    if (!['pending', 'confirmed', 'shipped', 'delivered'].includes(status))
        return null;
    const waiting = status === 'pending';
    const delivered = status === 'delivered';
    const stage: DeliveryStage = delivered
        ? 'approaching'
        : status === 'shipped'
          ? 'shipping'
          : 'packing';
    const copy: JourneyCopy = waiting
        ? {
              title: awaitingPayment
                  ? 'Chờ thanh toán để bắt đầu hành trình'
                  : 'Shop đã nhận đơn của bạn',
              label: awaitingPayment ? 'Chờ thanh toán' : 'Chờ xác nhận',
              description: awaitingPayment
                  ? 'Shop sẽ xác nhận và chuẩn bị hàng sau khi nhận được chuyển khoản.'
                  : 'Shop sẽ xác nhận trước khi bắt đầu gói ghém đơn hàng.',
              note: 'Một chiếc vợt, một niềm vui sắp bắt đầu',
          }
        : delivered
          ? {
                title: 'Đơn hàng đã tới nơi!',
                label: 'Đã giao hàng',
                description:
                    'Cảm ơn bạn đã đồng hành. Chúc bạn có những buổi ra sân thật vui!',
                note: 'Chuyến đi khép lại, niềm vui bắt đầu',
            }
          : status === 'confirmed'
            ? {
                  title: 'Shop đang chuẩn bị đơn thật cẩn thận',
                  label: 'Đã xác nhận · Đang chuẩn bị',
                  description:
                      'Đơn đã được xác nhận. Shop đang chuẩn bị hàng trước khi bàn giao cho đơn vị vận chuyển.',
                  note: 'Cẩn thận từng chút một',
              }
            : {
                  ...stages.shipping,
                  description:
                      'Đơn đã được bàn giao cho đơn vị vận chuyển và đang trên đường giao tới bạn.',
              };
    return (
        <DeliveryJourney
            stage={stage}
            copy={copy}
            stillTime={waiting ? 0 : delivered ? 6 : undefined}
            orderStatus={status}
        />
    );
}
