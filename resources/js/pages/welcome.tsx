import { Head, Link } from '@inertiajs/react';
import { ArrowRight, ArrowUpRight, Menu, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BrandMark from '@/components/brand-mark';
import LandingLoader, {
    shouldShowLandingIntro,
} from '@/components/landing-loader';
import type { RevealMode } from '@/components/landing-loader';
import RacketStory from '@/components/racket-story';
import { halfCourtView } from '@/lib/court-view';
import '../../css/landing.css';

// ponytail: gợi ý theo vị trí trên sân; thay bằng SKU từ Laravel khi có dữ liệu thật.
const styles = [
    {
        id: 'speed',
        name: 'Tốc độ',
        zone: 'Gần lưới',
        label: 'Nhanh trong từng phản xạ',
        description:
            'Cho những pha bắt lưới, đổi hướng và phòng thủ liên tục, khi mỗi phần giây đều tính.',
        note: 'Vợt nhẹ đầu, dễ xoay trở giúp bạn kịp đổi hướng. Thử trọng lượng và cỡ cán để tìm cảm giác thoải mái.',
    },
    {
        id: 'balance',
        name: 'Cân bằng',
        zone: 'Giữa sân',
        label: 'Linh hoạt ở mọi vị trí',
        description:
            'Cho người đổi vai liên tục: kiểm soát, phản tạt, rồi lên đập khi có cơ hội.',
        note: 'Nếu thường đổi giữa tấn công và phòng thủ, một cây vợt cân bằng cho bạn cả hai mà không phải gồng tay.',
    },
    {
        id: 'attack',
        name: 'Tấn công',
        zone: 'Cuối sân',
        label: 'Cho nhịp cầu chủ động',
        description:
            'Cho những cú vung chắc tay từ cuối sân, khi bạn muốn là người tạo áp lực.',
        note: 'Vợt nặng đầu cho cú đập đầm hơn nhưng cần cổ tay khỏe. Hãy thử để biết có vừa sức tay không.',
    },
] as const;
const filterOrder = ['attack', 'balance', 'speed'] as const;
const court = halfCourtView();

type Intro = 'playing' | 'revealing' | 'done';
type StyleId = (typeof styles)[number]['id'];

function Brand({ label }: { label?: string }) {
    return (
        <a className="shop-brand" href="#" aria-label={label}>
            <BrandMark className="brand-symbol" />
            <span>
                Shop <strong>Cầu Lông</strong>
            </span>
        </a>
    );
}

/** One half of the court, lit where the chosen style is played. */
function StylesCourt({
    filter,
    onPick,
}: {
    filter: 'all' | StyleId;
    onPick: (id: StyleId) => void;
}) {
    return (
        <svg
            className="styles-court"
            viewBox={'0 0 ' + court.width + ' ' + court.height}
            aria-hidden="true"
            focusable="false"
        >
            <path className="styles-court__mat" d={court.court} />
            {court.zones.map((zone) => {
                const style = styles.find((item) => item.id === zone.id)!;
                return (
                    <g
                        key={zone.id}
                        className="styles-court__zone"
                        data-active={filter === zone.id || undefined}
                        data-dim={
                            (filter !== 'all' && filter !== zone.id) ||
                            undefined
                        }
                        onClick={() => onPick(zone.id)}
                    >
                        <path d={zone.area} />
                        <text x={zone.label[0]} y={zone.label[1] - 4}>
                            {style.name}
                        </text>
                        <text
                            className="styles-court__zone-note"
                            x={zone.label[0]}
                            y={zone.label[1] + 22}
                        >
                            {style.zone}
                        </text>
                    </g>
                );
            })}
            <path className="styles-court__lines" d={court.lines} />
            <path className="styles-court__net" d={court.net} />
            <path className="styles-court__tape" d={court.tape} />
            <path className="styles-court__posts" d={court.posts} />
        </svg>
    );
}

export default function Welcome() {
    const [filter, setFilter] = useState<'all' | StyleId>('all');
    const [intro, setIntro] = useState<Intro>(() =>
        shouldShowLandingIntro() ? 'playing' : 'done',
    );
    const [reveal, setReveal] = useState<RevealMode>('cut');
    const menu = useRef<HTMLDetailsElement>(null);
    const header = useRef<HTMLElement>(null);
    const closeMenu = () => {
        if (menu.current) menu.current.open = false;
    };
    const visible = styles.filter(
        (style) => filter === 'all' || style.id === filter,
    );

    // The header stays pinned (the store is always one tap away). Clear over the first screen,
    // then it takes the tone of the surface under it, so the page never shows through.
    useEffect(() => {
        const element = header.current;
        if (!element) return;
        let frame = 0;
        const update = () => {
            frame = 0;
            const edge = element.offsetHeight;
            let tone = 'night';
            if (window.scrollY < 24) tone = 'clear';
            else
                for (const surface of document.querySelectorAll<HTMLElement>(
                    '[data-surface]',
                )) {
                    const box = surface.getBoundingClientRect();
                    if (box.top <= edge && box.bottom > edge) {
                        tone = surface.dataset.surface ?? 'night';
                        break;
                    }
                }
            if (element.dataset.tone !== tone) element.dataset.tone = tone;
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, []);

    return (
        <div
            className="badminton-landing"
            lang="vi"
            data-intro={intro}
            data-reveal={reveal}
        >
            <LandingLoader
                onReveal={(mode) => {
                    setReveal(mode);
                    setIntro('revealing');
                }}
                onDone={() => setIntro('done')}
            />
            <Head title="Shop Cầu Lông — Hiểu cây vợt trước khi chọn">
                <meta
                    name="description"
                    content="Xem gần từng phần của một cây vợt cầu lông qua mô hình 3D, rồi chọn vợt hợp với lối chơi của bạn. Thanh toán khi nhận hàng."
                />
                <meta name="theme-color" content="#0d1424" />
            </Head>
            <a className="skip-link" href="#main">
                Bỏ qua điều hướng
            </a>
            <header className="shop-header" ref={header} data-tone="clear">
                <div className="landing-container header-inner">
                    <Brand label="Shop Cầu Lông — đầu trang" />
                    <nav
                        className="desktop-navigation"
                        aria-label="Điều hướng chính"
                    >
                        <a href="#kham-pha-vot">Cây vợt</a>
                        <a href="#bo-suu-tap">Lối chơi</a>
                        <Link href="/advisor" prefetch="hover">
                            Tư vấn chọn vợt
                        </Link>
                        <a href="#hoi-dap">Hỏi đáp</a>
                    </nav>
                    <Link
                        href="/products"
                        className="header-cta"
                        prefetch={intro === 'done' ? ['mount', 'hover'] : false}
                        cacheFor="5s"
                        viewTransition
                    >
                        <span className="header-cta-long">Vào cửa hàng</span>
                        <span className="header-cta-short">Cửa hàng</span>
                        <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                    <details
                        className="mobile-navigation"
                        ref={menu}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') closeMenu();
                        }}
                    >
                        <summary aria-label="Mở menu">
                            <Menu size={24} />
                        </summary>
                        <nav aria-label="Điều hướng di động">
                            <a href="#kham-pha-vot" onClick={closeMenu}>
                                Cây vợt
                            </a>
                            <a href="#bo-suu-tap" onClick={closeMenu}>
                                Lối chơi
                            </a>
                            <Link
                                href="/advisor"
                                onClick={closeMenu}
                                prefetch="hover"
                            >
                                Tư vấn chọn vợt
                            </Link>
                            <a href="#hoi-dap" onClick={closeMenu}>
                                Hỏi đáp
                            </a>
                            <Link
                                href="/products"
                                onClick={closeMenu}
                                prefetch="hover"
                                viewTransition
                            >
                                Vào cửa hàng
                            </Link>
                        </nav>
                    </details>
                </div>
            </header>
            <main id="main">
                <RacketStory />

                <section
                    className="styles-section"
                    id="bo-suu-tap"
                    data-surface="night"
                    aria-labelledby="collection-title"
                >
                    <div className="landing-container styles-layout">
                        <div className="styles-intro">
                            <h2 id="collection-title" className="section-title">
                                Mỗi vị trí trên sân{' '}
                                <span className="tone-soft">
                                    cần một cây vợt khác.
                                </span>
                            </h2>
                            <p className="section-lead">
                                Người đứng gần lưới cần vợt xoay nhanh; người
                                đập cầu cuối sân cần đầu vợt đầm. Chọn chỗ bạn
                                hay đứng để xem gợi ý.
                            </p>
                            <div
                                className="collection-filters"
                                role="group"
                                aria-label="Lọc theo lối chơi"
                            >
                                <button
                                    type="button"
                                    aria-pressed={filter === 'all'}
                                    onClick={() => setFilter('all')}
                                >
                                    Tất cả
                                </button>
                                {filterOrder.map((id) => (
                                    <button
                                        type="button"
                                        key={id}
                                        aria-pressed={filter === id}
                                        onClick={() => setFilter(id)}
                                    >
                                        {styles.find((s) => s.id === id)!.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <StylesCourt filter={filter} onPick={setFilter} />
                        <div className="styles-list">
                            {visible.map((style) => (
                                <article
                                    className="collection-card"
                                    key={style.id}
                                    data-style={style.id}
                                >
                                    <p className="collection-card__zone">
                                        {style.zone} · {style.label}
                                    </p>
                                    <h3>{style.name}</h3>
                                    <p>{style.description}</p>
                                    {filter !== 'all' && (
                                        <p className="collection-card__note">
                                            {style.note}
                                        </p>
                                    )}
                                    <Link
                                        href={'/products?style=' + style.id}
                                        className="text-link"
                                        prefetch="hover"
                                        viewTransition
                                    >
                                        Xem vợt {style.name.toLowerCase()}{' '}
                                        <ArrowRight size={17} />
                                    </Link>
                                </article>
                            ))}
                            <p className="collection-disclaimer" role="status">
                                {filter === 'all'
                                    ? '3 lối chơi.'
                                    : 'Đang xem: ' +
                                      styles.find((s) => s.id === filter)
                                          ?.name +
                                      '.'}{' '}
                                Gợi ý theo vị trí trên sân, không phải phân loại
                                của hãng. Hãy cầm thử trước khi chọn.
                            </p>
                            <div className="styles-shop">
                                <p>
                                    Đã biết mình hợp lối chơi nào? Xem vợt, giá
                                    và phiên bản trong cửa hàng.
                                </p>
                                <Link
                                    className="landing-button light-button"
                                    href="/products"
                                    prefetch="hover"
                                    viewTransition
                                >
                                    Xem tất cả vợt <ArrowRight size={17} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="advisor-band surface-paper"
                    data-surface="paper"
                    aria-labelledby="guide-title"
                >
                    <div className="landing-container advisor-layout">
                        <div>
                            <h2 id="guide-title" className="section-title">
                                Chưa chắc chọn cây nào?{' '}
                                <span className="tone-soft">
                                    Trả lời ba câu hỏi.
                                </span>
                            </h2>
                            <p className="section-lead">
                                Chúng tôi gợi ý vợt theo lối chơi, trình độ và
                                ngân sách bạn chọn, từ những mẫu đang bán trong
                                cửa hàng.
                            </p>
                        </div>
                        <div>
                            <ol className="advisor-questions">
                                <li>
                                    Bạn hay đứng ở đâu: gần lưới, giữa sân hay
                                    cuối sân?
                                </li>
                                <li>Bạn đã chơi cầu được bao lâu?</li>
                                <li>Bạn muốn chi khoảng bao nhiêu?</li>
                            </ol>
                            <div className="advisor-action">
                                <Link
                                    className="landing-button dark-button"
                                    href="/advisor"
                                    prefetch="hover"
                                >
                                    Bắt đầu tư vấn <ArrowRight size={17} />
                                </Link>
                                <small>
                                    Gợi ý theo quy tắc rõ ràng, không dùng AI.
                                </small>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="faq-band surface-paper"
                    id="hoi-dap"
                    data-surface="paper"
                    aria-labelledby="faq-title"
                >
                    <div className="faq-section landing-container">
                        <div>
                            <h2 id="faq-title" className="section-title">
                                Hỏi nhanh
                            </h2>
                            <p>Những điều người chơi hay hỏi khi chọn vợt.</p>
                        </div>
                        <div>
                            <details>
                                <summary>
                                    3U, 4U, 5U nghĩa là gì?
                                    <Plus size={18} aria-hidden="true" />
                                </summary>
                                <p>
                                    Là nhóm trọng lượng của khung vợt chưa căng
                                    dây: 3U khoảng 85–89 g, 4U khoảng 80–84 g,
                                    5U khoảng 75–79 g. Số càng lớn vợt càng nhẹ,
                                    dễ xoay trở; vợt nặng hơn cho cú đánh đầm
                                    hơn.
                                </p>
                            </details>
                            <details>
                                <summary>
                                    Nặng đầu, nhẹ đầu hay cân bằng?
                                    <Plus size={18} aria-hidden="true" />
                                </summary>
                                <p>
                                    Điểm cân bằng cho biết trọng lượng dồn về
                                    đâu. Nặng đầu hợp người thích đập cầu từ
                                    cuối sân; nhẹ đầu hợp phản tạt, đánh nhanh
                                    gần lưới; cân bằng dành cho người đổi vai
                                    liên tục. Cầm thử vẫn là cách chắc nhất.
                                </p>
                            </details>
                            <details>
                                <summary>
                                    Thanh toán thế nào?
                                    <Plus size={18} aria-hidden="true" />
                                </summary>
                                <p>
                                    Bạn thanh toán khi nhận hàng (COD). Cửa hàng
                                    chưa nhận thanh toán online và không thu
                                    thông tin thẻ.
                                </p>
                            </details>
                            <details>
                                <summary>
                                    Cây vợt 3D trên trang là mẫu nào?
                                    <Plus size={18} aria-hidden="true" />
                                </summary>
                                <p>
                                    Hyper Core8000, mô hình 3D của ghks1120 theo
                                    giấy phép CC BY 4.0. Mặt dây được thêm để
                                    minh họa. Đây là mô hình giới thiệu cấu tạo,
                                    không phải sản phẩm đang bán.
                                </p>
                            </details>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="shop-footer" data-surface="night">
                <div className="landing-container">
                    <div className="footer-top">
                        <div className="footer-action">
                            <Brand />
                            <p>
                                Hiểu cây vợt.{' '}
                                <span className="tone-soft">Rồi mới chọn.</span>
                            </p>
                        </div>
                        <div className="footer-links">
                            <Link
                                className="landing-button light-button"
                                href="/products"
                                prefetch="hover"
                                viewTransition
                            >
                                Vào cửa hàng <ArrowRight size={17} />
                            </Link>
                            <a href="#main" className="back-to-top">
                                Về đầu trang
                            </a>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <span>© Shop Cầu Lông · Thanh toán khi nhận hàng</span>
                        <nav aria-label="Thông tin cuối trang">
                            <a href="#kham-pha-vot">Cây vợt</a>
                            <a href="#bo-suu-tap">Lối chơi</a>
                            <a href="#hoi-dap">Hỏi đáp</a>
                        </nav>
                        <span>
                            Mô hình{' '}
                            <a
                                href="https://sketchfab.com/3d-models/hyper-core8000-badminton-racket-3d-modeling-c6f5e27f657a48d6b3cbb52120d75f83"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Hyper Core8000
                            </a>{' '}
                            bởi{' '}
                            <a
                                href="https://sketchfab.com/ghks1120"
                                target="_blank"
                                rel="noreferrer"
                            >
                                ghks1120
                            </a>{' '}
                            ·{' '}
                            <a
                                href="https://creativecommons.org/licenses/by/4.0/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                CC BY 4.0
                            </a>
                            , đã thêm mặt dây minh họa.
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
