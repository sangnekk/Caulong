import { ArrowDown, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { RacketScene } from "@/lib/racket-scene";
import "../../css/racket-story.css";

const Viewer = lazy(() => import("@/components/racket-viewer"));
const chapters = [
    {
        label: "Tổng thể",
        title: ["Hiểu từng phần.", "Chọn đúng cảm giác."],
        text: "Khung, thân, cán và mặt dây cùng tạo nên cây vợt. Cuộn chậm để nhìn gần từng bộ phận.",
        detail: "HYPER CORE8000",
        side: "left",
        structure: "",
        function: "",
    },
    {
        label: "Đầu vợt",
        title: ["Khung giữ dây.", "Đệm nhỏ bảo vệ dây."],
        text: "Vành bao quanh đầu vợt giữ mặt dây và chịu lực căng.",
        detail: "ĐẦU VỢT",
        side: "left",
        structure: "Khung bao quanh mặt dây, có các lỗ để luồn dây.",
        function: "Mỗi lỗ có một ống nhựa nhỏ, gọi là gen, giúp dây không cọ vào cạnh khung.",
    },
    {
        label: "Thân vợt",
        title: ["Nối tay cầm", "với đầu vợt."],
        text: "Thanh mảnh giữa đầu và cán truyền chuyển động của tay đến khung.",
        detail: "THÂN & KHỚP NỐI",
        side: "left",
        structure: "Thanh mảnh nằm giữa đầu vợt và tay cầm.",
        function: "Thân vợt uốn nhẹ khi vung. Cảm giác cứng hay mềm cần được thử trực tiếp.",
    },
    {
        label: "Cán vợt",
        title: ["Cầm vừa tay.", "Đánh thoải mái."],
        text: "Cán là điểm tiếp xúc với bàn tay; phần đang phóng gần là lớp quấn xoắn bên ngoài.",
        detail: "CÁN & QUẤN CÁN",
        side: "left",
        structure: "Phần cán bên trong, lớp quấn bên ngoài và nắp dưới đáy.",
        function: "Độ dày, độ bám và khả năng thấm hút cần phù hợp tay người chơi.",
    },
    {
        label: "Mặt dây",
        title: ["Dọc đan ngang.", "Cầu chạm tại đây."],
        text: "Các dây dọc và dây ngang đan qua nhau, tạo bề mặt tiếp xúc với cầu.",
        detail: "MẶT DÂY ĐAN",
        side: "left",
        structure: "Dây dọc đan với dây ngang thành mặt lưới.",
        function:
            "Mặt lưới tiếp xúc với cầu. Lưới ở đây chỉ để minh họa, không chỉ dẫn cách căng dây.",
    },
    {
        label: "Chọn vợt",
        title: ["Hiểu cấu tạo.", "Tìm nhịp chơi riêng."],
        text: "Hãy thử độ nặng, độ dễ vung và cảm giác cầm để tìm cây vợt phù hợp.",
        detail: "TỪ CẤU TẠO ĐẾN LỐI CHƠI",
        side: "left",
        structure: "",
        function: "",
    },
] as const;
const smooth = (value: number) => value * value * (3 - 2 * value);

export default function RacketStory() {
    const root = useRef<HTMLElement>(null);
    const scene = useRef<RacketScene | null>(null);
    const progress = useRef(0);
    const marker = useRef<HTMLDivElement>(null);
    const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce), (max-height: 550px)").matches);
    const [ready, setReady] = useState(false);
    const [reading, setReading] = useState(false);
    const [active, setActive] = useState(0);
    const cinematic = !reduced && !reading;
    const onReady = useCallback((value: RacketScene | null) => {
        scene.current = value;
        value?.setProgress(progress.current);
        setReady(Boolean(value));
    }, []);

    useEffect(() => {
        const media = matchMedia("(prefers-reduced-motion: reduce), (max-height: 550px)");
        const change = () => setReduced(media.matches);
        change();
        media.addEventListener("change", change);
        return () => media.removeEventListener("change", change);
    }, []);

    useEffect(() => {
        const element = root.current;
        if (!element || !cinematic) return;
        const stage = element.querySelector<HTMLElement>(".story-stage")!;
        const panels = [...element.querySelectorAll<HTMLElement>(".story-panel")];
        const bar = element.querySelector<HTMLElement>(".story-progress span")!;
        let frame = 0,
            previous = -1,
            start = 0,
            range = 1,
            target = 0,
            current = 0,
            lastTime = 0;
        let stageWidth = 1,
            stageHeight = 1;
        let alive = true;
        const opacity = panels.map(() => -1);
        const measure = () => {
            start = scrollY + element.getBoundingClientRect().top;
            stageWidth = stage.clientWidth;
            stageHeight = stage.offsetHeight;
            range = Math.max(1, element.offsetHeight - stageHeight);
            const anchor = element.querySelector<HTMLElement>(".material-anchor");
            if (anchor) anchor.style.top = range / (chapters.length - 1) + "px";
        };
        const paint = (amount: number) => {
            progress.current = amount;
            // Keep the introduction readable until textures and the first frame are ready.
            const chapter = (ready ? amount : 0) * (chapters.length - 1);
            const index = Math.round(chapter);
            bar.style.transform = "scaleX(" + amount + ")";
            panels.forEach((panel, i) => {
                const fade =
                    1 - smooth(Math.max(0, Math.min(1, (Math.abs(chapter - i) - 0.18) / 0.36)));
                if (fade !== opacity[i]) {
                    panel.style.opacity = String(fade);
                    panel.style.transform = "translate3d(0," + (i - chapter) * 18 + "px,0)";
                    opacity[i] = fade;
                }
                if (previous !== index) {
                    panel.inert = i !== index;
                    panel.setAttribute("aria-hidden", String(i !== index));
                }
            });
            scene.current?.setProgress(amount);
            const point = scene.current?.getAnnotation();
            if (marker.current) {
                marker.current.hidden = !point;
                if (point) {
                    marker.current.style.transform =
                        "translate3d(" +
                        (point.x * stageWidth) / 100 +
                        "px," +
                        (point.y * stageHeight) / 100 +
                        "px,0) translate(" +
                        (point.x > 65 ? "-100%" : "0") +
                        ",-50%)";
                    marker.current.dataset.side = point.x > 65 ? "left" : "right";
                    const label = marker.current.querySelector("span")!;
                    if (label.textContent !== point.label) label.textContent = point.label;
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
            if (!frame && !document.hidden) frame = requestAnimationFrame(update);
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
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", resize);
        document.addEventListener("visibilitychange", visibility);
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
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", resize);
            document.removeEventListener("visibilitychange", visibility);
            if (marker.current) marker.current.hidden = true;
            panels.forEach((panel) => {
                panel.style.opacity = "";
                panel.style.transform = "";
                panel.inert = false;
                panel.removeAttribute("aria-hidden");
            });
        };
    }, [cinematic, ready]);

    const goTo = (index: number) => {
        const element = root.current;
        if (!element) return;
        if (!cinematic) {
            element.querySelectorAll(".story-panel")[index]?.scrollIntoView();
            return;
        }
        const stageHeight = element.querySelector<HTMLElement>(".story-stage")!.offsetHeight;
        window.scrollTo({
            top:
                scrollY +
                element.getBoundingClientRect().top +
                ((element.offsetHeight - stageHeight) * index) / (chapters.length - 1),
            behavior: "instant",
        });
    };

    return (
        <section
            ref={root}
            id="kham-pha-vot"
            className={"racket-story " + (cinematic ? "is-cinematic" : "is-reading")}
            aria-label="Câu chuyện Hyper Core8000"
            data-chapter="0"
            data-ready={ready}
            aria-busy={cinematic && !ready}
        >
            {cinematic && <span id="cac-bo-phan" className="story-anchor material-anchor" />}
            <div className="story-stage">
                <div className="story-backdrop" aria-hidden="true">
                    <span className="arena-light arena-light-near" />
                    <span className="arena-light arena-light-far" />
                    <div className="arena-court"><span /><i /></div>
                    <svg className="arena-flight" viewBox="0 0 1000 800" fill="none"><path d="M120 730 C760 690 940 170 620 65" /><path d="M190 730 C785 675 922 205 642 93" /></svg>
                    <span className="arena-caption">SẴN SÀNG CHO NHỊP CẦU MỚI<span>Chạm cầu. Bắt đầu câu chuyện.</span></span>
                </div>
                <div className="story-topline">
                    <span>
                        HYPER CORE<span className="story-edition">8000</span>
                    </span>
                    <a href="#bo-suu-tap">
                        Bỏ qua giới thiệu <ArrowUpRight size={15} />
                    </a>
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
                            <Viewer story onReady={onReady} />
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
                <div ref={marker} className="anatomy-marker" aria-hidden="true" hidden>
                    <i />
                    <span />
                </div>
                <div className="story-panels">
                    {chapters.map((chapter, index) => (
                        <article
                            key={chapter.label}
                            id={!cinematic && index === 1 ? "cac-bo-phan" : undefined}
                            className={"story-panel story-" + chapter.side}
                            style={{ "--chapter": index } as CSSProperties}
                        >
                            <div className="story-copy">
                                <p className="story-detail">{chapter.detail}</p>
                                {index === 0 ? (
                                    <h1>
                                        {chapter.title[0]}
                                        <br />
                                        <span>{chapter.title[1]}</span>
                                    </h1>
                                ) : (
                                    <h2>
                                        {chapter.title[0]}
                                        <br />
                                        <span>{chapter.title[1]}</span>
                                    </h2>
                                )}
                                <p className="story-description">{chapter.text}</p>
                                {chapter.structure && (
                                    <dl className="anatomy-details">
                                        <div>
                                            <dt>Cấu tạo</dt>
                                            <dd>{chapter.structure}</dd>
                                        </div>
                                        <div>
                                            <dt>Để làm gì?</dt>
                                            <dd>{chapter.function}</dd>
                                        </div>
                                    </dl>
                                )}
                                {index === 0 && (
                                    <button className="story-next" disabled={cinematic && !ready} onClick={() => goTo(1)}>
                                        {cinematic && !ready ? "Đang chuẩn bị vợt…" : "Bắt đầu khám phá"} <ArrowDown size={18} />
                                    </button>
                                )}
                                {index === 5 && (
                                    <a className="landing-button accent-button" href="#bo-suu-tap">
                                        Khám phá lối chơi <ArrowRight size={18} />
                                    </a>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
                <div className="story-bottom">
                    <nav className="story-chapters" aria-label="Các chương giới thiệu">
                        {chapters.map((chapter, index) => (
                            <button
                                key={chapter.label}
                                aria-current={cinematic && active === index ? "step" : undefined}
                                aria-label={"Đến chương " + chapter.label}
                                onClick={() => goTo(index)}
                            >
                                <span className="chapter-dot" />
                                <span className="chapter-label">{chapter.label}</span>
                            </button>
                        ))}
                    </nav>
                    <button
                        className="story-mode"
                        onClick={() => setReading(!reading)}
                        disabled={reduced}
                        aria-pressed={reading || reduced}
                    >
                        {reading || reduced ? <Play size={14} /> : <Pause size={14} />}
                        {reduced
                            ? "Đang xem bản tĩnh"
                            : reading
                              ? "Xem vợt chuyển động"
                              : "Xem bản tĩnh"}
                    </button>
                </div>
                <div className="story-progress" aria-hidden="true">
                    <span />
                </div>
            </div>
        </section>
    );
}
