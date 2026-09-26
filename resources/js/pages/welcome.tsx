import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    ChevronDown,
    Menu,
    MoveUpRight,
    Sparkles,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import LandingLoader, {
    LANDING_LOADER_SESSION_KEY,
} from '@/components/landing-loader';
import RacketStory from '@/components/racket-story';
import '../../css/landing.css';

const poster = '/models/hyper-core-poster.png';
// ponytail: catalog minh họa; thay bằng SKU từ Laravel khi triển khai bán hàng.
const collections = [
    {
        id: 'attack',
        name: 'Tấn công',
        label: 'Dành cho nhịp cầu chủ động',
        color: 'lime',
        description:
            'Khám phá cảm giác vung chắc tay, chủ động tạo áp lực từ cuối sân.',
        note: 'Vợt có phần đầu nặng hơn thường được cân nhắc khi thích đánh tấn công. Hãy thử để biết có vừa sức tay không.',
        number: '01',
    },
    {
        id: 'speed',
        name: 'Tốc độ',
        label: 'Nhanh trong từng phản xạ',
        color: 'blue',
        description:
            'Dành chỗ cho những pha bắt lưới, đổi hướng và phòng thủ liên tục.',
        note: 'Vợt dễ xoay trở giúp bạn đổi hướng nhanh. Hãy thử trọng lượng và tay cầm để tìm cảm giác thoải mái.',
        number: '02',
    },
    {
        id: 'balance',
        name: 'Cân bằng',
        label: 'Linh hoạt ở mọi vị trí',
        color: 'coral',
        description:
            'Tìm sự hài hòa giữa kiểm soát, phản tạt và những cú đánh cuối sân.',
        note: 'Nếu thường đổi giữa tấn công và phòng thủ, hãy thử một cây vợt cho cảm giác cân bằng, dễ điều khiển.',
        number: '03',
    },
] as const;
type Collection = (typeof collections)[number];

export default function Welcome() {
    const [filter, setFilter] = useState('all');
    const [introDone, setIntroDone] = useState(() => {
        try {
            return (
                typeof window !== 'undefined' &&
                sessionStorage.getItem(LANDING_LOADER_SESSION_KEY) === '1'
            );
        } catch {
            return false;
        }
    });
    const [selected, setSelected] = useState<Collection>(collections[0]);
    const dialog = useRef<HTMLDialogElement>(null);
    const menu = useRef<HTMLDetailsElement>(null);
    const closeMenu = () => {
        if (menu.current) menu.current.open = false;
    };
    const openCollection = (collection: Collection) => {
        setSelected(collection);
        dialog.current?.showModal();
    };

    return (
        <div className="badminton-landing" lang="vi">
            <LandingLoader onDone={() => setIntroDone(true)} />
            <Head title="Shop Cầu Lông — Khám phá Hyper Core8000">
                <meta
                    name="description"
                    content="Khám phá vợt cầu lông qua mô hình 3D tương tác, tìm hiểu khung, thân, dây và tay cầm. Chọn cảm giác chơi phù hợp với bạn."
                />
                <meta name="theme-color" content="#183d85" />
            </Head>
            <a className="skip-link" href="#main">
                Bỏ qua điều hướng
            </a>
            <header className="shop-header">
                <div className="landing-container header-inner">
                    <a
                        className="shop-brand"
                        href="#"
                        aria-label="Shop Cầu Lông — đầu trang"
                    >
                        <span className="brand-symbol" aria-hidden="true">
                            <MoveUpRight />
                            <MoveUpRight />
                        </span>
                        <span>
                            SHOP
                            <br />
                            <strong>CẦU LÔNG</strong>
                        </span>
                    </a>
                    <nav
                        className="desktop-navigation"
                        aria-label="Điều hướng chính"
                    >
                        <a href="#kham-pha-vot">Khám phá vợt</a>
                        <a href="#cac-bo-phan">Các bộ phận</a>
                        <a href="#bo-suu-tap">Chọn theo lối chơi</a>
                    </nav>
                    <Link
                        href="/products"
                        className="header-cta"
                        prefetch={introDone ? 'mount' : false}
                        cacheFor="5s"
                        viewTransition
                    >
                        Vào cửa hàng <ArrowUpRight size={18} />
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
                                Khám phá vợt
                            </a>
                            <a href="#cac-bo-phan" onClick={closeMenu}>
                                Các bộ phận
                            </a>
                            <a href="#bo-suu-tap" onClick={closeMenu}>
                                Chọn theo lối chơi
                            </a>
                            <Link
                                href="/products"
                                onClick={closeMenu}
                                prefetch="hover"
                                viewTransition
                            >
                                Vào cửa hàng
                            </Link>
                            <Link
                                href="/advisor"
                                onClick={closeMenu}
                                prefetch="hover"
                            >
                                Gợi ý chọn vợt
                            </Link>
                            <a href="#hoi-dap" onClick={closeMenu}>
                                Câu hỏi thường gặp
                            </a>
                        </nav>
                    </details>
                </div>
            </header>
            <main id="main">
                <RacketStory enabled={introDone} />

                <section
                    className="collection-section landing-container"
                    id="bo-suu-tap"
                    aria-labelledby="collection-title"
                >
                    <div className="section-heading">
                        <div>
                            <p className="section-intro">
                                Không có cây vợt tốt nhất cho tất cả.
                            </p>
                            <h2 id="collection-title">
                                Có cây vợt hợp với bạn.
                            </h2>
                        </div>
                        <p>
                            Bắt đầu từ cách bạn muốn chơi.
                            <br />
                            Ba hướng khám phá, một phong cách riêng.
                        </p>
                    </div>
                    <div className="collection-toolbar">
                        <div
                            className="collection-filters"
                            aria-label="Lọc theo lối chơi"
                        >
                            <button
                                aria-pressed={filter === 'all'}
                                onClick={() => setFilter('all')}
                            >
                                Tất cả
                            </button>
                            {collections.map((item) => (
                                <button
                                    key={item.id}
                                    aria-pressed={filter === item.id}
                                    onClick={() => setFilter(item.id)}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                        <Link
                            href="/products"
                            prefetch="hover"
                            className="text-link"
                        >
                            Xem sản phẩm đang có <ArrowUpRight size={18} />
                        </Link>
                    </div>
                    <div className="collection-grid">
                        {collections
                            .filter(
                                (item) =>
                                    filter === 'all' || item.id === filter,
                            )
                            .map((item) => (
                                <article
                                    className={
                                        'collection-card color-' + item.color
                                    }
                                    key={item.id}
                                >
                                    <button
                                        className="collection-image"
                                        aria-label={
                                            'Khám phá lối chơi ' +
                                            item.name.toLowerCase()
                                        }
                                        onClick={() => openCollection(item)}
                                    >
                                        <span className="concept-tag">
                                            MINH HỌA / {item.number}
                                        </span>
                                        <img
                                            src={poster}
                                            width="700"
                                            height="800"
                                            alt={
                                                'Phối cảnh vợt minh họa cho nhóm ' +
                                                item.name.toLowerCase()
                                            }
                                            loading="lazy"
                                        />
                                        <span className="collection-open">
                                            <ArrowUpRight size={23} />
                                        </span>
                                    </button>
                                    <div className="collection-description">
                                        <small>{item.label}</small>
                                        <h3>{item.name}</h3>
                                        <p>{item.description}</p>
                                        <button
                                            className="text-link"
                                            onClick={() => openCollection(item)}
                                        >
                                            Tìm hiểu lối chơi{' '}
                                            <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </article>
                            ))}
                    </div>
                    <p className="collection-disclaimer" role="status">
                        {filter === 'all'
                            ? '3 hướng lựa chọn.'
                            : 'Đang xem: ' +
                              collections.find((item) => item.id === filter)
                                  ?.name +
                              '.'}{' '}
                        Cùng một mẫu vợt dùng để minh họa ba lối chơi, không
                        phải ba sản phẩm đang bán.
                    </p>
                </section>

                <section
                    className="guide-section landing-container"
                    aria-labelledby="guide-title"
                >
                    <div className="guide-heading">
                        <Sparkles size={30} />
                        <h2 id="guide-title">
                            Chọn đúng từ
                            <br />
                            những câu hỏi nhỏ.
                        </h2>
                    </div>
                    <div className="guide-content">
                        <p>
                            Bạn thường đánh đơn hay đôi? Thích đập cầu hay đánh
                            nhanh gần lưới? Điều gì ở cây vợt hiện tại khiến bạn
                            muốn thay đổi?
                        </p>
                        <Link
                            className="landing-button dark-button"
                            href="/advisor"
                            prefetch="hover"
                        >
                            Tìm vợt phù hợp <ArrowUpRight size={18} />
                        </Link>
                        <small>
                            Gợi ý theo ngân sách và lối chơi bạn chọn; chưa sử
                            dụng AI.
                        </small>
                    </div>
                </section>

                <section
                    className="faq-section landing-container"
                    id="hoi-dap"
                    aria-labelledby="faq-title"
                >
                    <h2 id="faq-title">Trước khi bạn chọn vợt</h2>
                    <div>
                        <details>
                            <summary>
                                Vợt 3D này có phải sản phẩm đang bán?
                                <ChevronDown size={18} />
                            </summary>
                            <p>
                                Chưa. Hình vợt đang dùng để giới thiệu các bộ
                                phận. Lưới dây được thêm để minh họa, không phải
                                hướng dẫn căng dây. Mẫu vợt 3D này không phải
                                sản phẩm đang bán; xem các mẫu có giá trong cửa
                                hàng.
                            </p>
                        </details>
                        <details>
                            <summary>
                                Tôi có thể đặt hàng hoặc thanh toán chưa?
                                <ChevronDown size={18} />
                            </summary>
                            <p>
                                Bạn có thể đặt hàng ở mục Cửa hàng và thanh toán
                                khi nhận hàng. Sản phẩm có nhãn “Minh họa” chỉ
                                dùng thử, không được giao thật. Chưa hỗ trợ
                                thanh toán online; trang không thu thông tin
                                thẻ.
                            </p>
                        </details>
                        <details>
                            <summary>
                                Vì sao không thấy mô hình 3D?
                                <ChevronDown size={18} />
                            </summary>
                            <p>
                                Thiết bị hoặc trình duyệt có thể chưa hiển thị
                                được vợt xoay. Bạn vẫn có thể xem ảnh dự phòng
                                và toàn bộ nội dung. Cuộn để đổi góc nhìn, dùng
                                thanh chương để chuyển nhanh hoặc chọn “Xem bản
                                tĩnh”.
                            </p>
                        </details>
                    </div>
                </section>
            </main>
            <footer className="shop-footer">
                <div className="landing-container">
                    <div className="footer-top">
                        <a className="shop-brand" href="#">
                            <span className="brand-symbol" aria-hidden="true">
                                <MoveUpRight />
                                <MoveUpRight />
                            </span>
                            <span>
                                SHOP
                                <br />
                                <strong>CẦU LÔNG</strong>
                            </span>
                        </a>
                        <p>
                            Hiểu cây vợt.
                            <br />
                            Tìm nhịp chơi của riêng bạn.
                        </p>
                        <a href="#main" className="back-to-top">
                            Về đầu trang <ArrowUpRight size={20} />
                        </a>
                    </div>
                    <div className="footer-bottom">
                        <span>
                            Shop Cầu Lông · Không gian trải nghiệm sản phẩm
                        </span>
                        <nav aria-label="Thông tin cuối trang">
                            <a href="#cac-bo-phan">Các bộ phận</a>
                            <a href="#bo-suu-tap">Lối chơi</a>
                            <a href="#hoi-dap">Câu hỏi thường gặp</a>
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
                            . Đã chỉnh cách hiển thị, thêm mặt dây minh họa và
                            đổi màu trong một số hình ảnh.
                        </span>
                    </div>
                </div>
            </footer>
            <dialog
                className="collection-dialog"
                ref={dialog}
                onClick={(event) => {
                    if (event.target === event.currentTarget)
                        dialog.current?.close();
                }}
                aria-labelledby="collection-dialog-title"
            >
                <button
                    className="dialog-close"
                    aria-label="Đóng thông tin lối chơi"
                    onClick={() => dialog.current?.close()}
                >
                    <X size={22} />
                </button>
                <span className="dialog-icon">
                    <Check size={24} />
                </span>
                <p>Khám phá lối chơi</p>
                <h2 id="collection-dialog-title">{selected.name}</h2>
                <p>{selected.note}</p>
                <div className="dialog-note">
                    Đây là gợi ý về lối chơi, không phải ba mẫu vợt khác nhau.
                    Xem các sản phẩm có giá và tồn kho trong cửa hàng.
                </div>
                <Link
                    href={'/products?style=' + selected.id}
                    className="landing-button dark-button"
                    prefetch="hover"
                    viewTransition
                    onClick={() => dialog.current?.close()}
                >
                    Xem vợt {selected.name.toLowerCase()} trong cửa hàng{' '}
                    <ArrowRight size={18} />
                </Link>
            </dialog>
        </div>
    );
}
