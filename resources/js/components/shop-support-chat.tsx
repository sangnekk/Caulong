import { Link, usePage } from '@inertiajs/react';
import { MessageCircle, SendHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ShopSharedProps } from '@/types/commerce';

type ChatMessage = {
    id: number;
    sender: 'customer' | 'admin' | 'bot';
    body: string;
    action_url: string | null;
    action_label: string | null;
    created_at?: string;
};
type ChatResponse = {
    status: 'open' | 'closed' | null;
    messages: ChatMessage[];
};
type ChatContextResponse = { purchased_products: string[] };

const greeting: ChatMessage = {
    id: 0,
    sender: 'bot',
    body: 'Xin chào! Mình là trợ lý tự động của Shop Cầu Lông. Bạn có thể hỏi về chọn vợt, giao hàng, thanh toán hoặc nhập mã đơn 8 ký tự nếu đặt hàng khi chưa đăng nhập.',
    action_url: null,
    action_label: null,
};
const quickQuestions = [
    'Tư vấn chọn vợt',
    'Phí giao hàng',
    'Thanh toán',
    'Đơn hàng',
    'Đổi trả',
    'Hỗ trợ vấn đề khác',
];

export default function ShopSupportChat() {
    const { props } = usePage<ShopSharedProps>();
    const shop = props.shop;
    const chatUrl = shop?.contact?.chat_url;
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [purchasedProducts, setPurchasedProducts] = useState<string[]>([]);
    const [conversationStatus, setConversationStatus] = useState<
        'open' | 'closed' | null
    >(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const launcher = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const messagesEnd = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) input.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const loadMessages = async () => {
            try {
                const response = await fetch('/support-chat/messages', {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                });
                if (!response.ok || cancelled) return;
                const data = (await response.json()) as ChatResponse;
                setMessages(data.messages);
                setConversationStatus(data.status);
            } catch {
                if (!cancelled)
                    setError('Không tải được hội thoại. Vui lòng thử lại.');
            }
        };
        const loadContext = async () => {
            try {
                const response = await fetch('/support-chat/context', {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                });
                if (!response.ok || cancelled) return;
                const data = (await response.json()) as ChatContextResponse;
                setPurchasedProducts(data.purchased_products);
            } catch {
                if (!cancelled) setPurchasedProducts([]);
            }
        };
        void loadMessages();
        void loadContext();
        const interval = window.setInterval(() => void loadMessages(), 4000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [open]);

    useEffect(() => {
        if (open) messagesEnd.current?.scrollIntoView({ block: 'end' });
    }, [messages, open]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                launcher.current?.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const send = (value: string) => {
        const text = value.trim();
        if (!text || sending) return;
        setDraft('');
        setSending(true);
        setError('');
        void fetch('/support-chat/messages', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN':
                    document.querySelector<HTMLMetaElement>(
                        'meta[name="csrf-token"]',
                    )?.content ?? '',
            },
            body: JSON.stringify({ message: text }),
        })
            .then(async (response) => {
                if (!response.ok) {
                    setError(
                        response.status === 429
                            ? 'Bạn gửi hơi nhanh. Vui lòng đợi một chút rồi thử lại.'
                            : 'Chưa gửi được tin nhắn. Vui lòng thử lại.',
                    );
                    return;
                }
                const data = (await response.json()) as ChatResponse;
                setMessages(data.messages);
                setConversationStatus(data.status);
            })
            .catch(() => setError('Mất kết nối. Vui lòng thử gửi lại.'))
            .finally(() => setSending(false));
    };

    return (
        <div className="store-chat-widget">
            {open && (
                <section
                    id="store-support-chat"
                    className="store-chat-panel"
                    role="dialog"
                    aria-label="Chat hỗ trợ khách hàng"
                    aria-modal="false"
                >
                    <header className="store-chat-header">
                        <div>
                            <strong>Hỗ trợ khách hàng</strong>
                            <span>Trợ lý tự động · Có nhân viên trên Zalo</span>
                        </div>
                        <button
                            type="button"
                            className="store-chat-close"
                            aria-label="Đóng chat"
                            onClick={() => {
                                setOpen(false);
                                launcher.current?.focus();
                            }}
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </header>
                    <div
                        className="store-chat-thread"
                        role="log"
                        aria-live="polite"
                        aria-relevant="additions text"
                    >
                        {(messages.length ? messages : [greeting]).map(
                            (message) => (
                                <div
                                    key={message.id}
                                    className="store-chat-message"
                                    data-author={
                                        message.sender === 'customer'
                                            ? 'visitor'
                                            : 'assistant'
                                    }
                                >
                                    {message.sender === 'admin' && (
                                        <small>Nhân viên hỗ trợ</small>
                                    )}
                                    <p>{message.body}</p>
                                    {message.action_url &&
                                        message.action_label &&
                                        (message.action_url.startsWith(
                                            'http',
                                        ) ? (
                                            <a
                                                href={message.action_url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {message.action_label}
                                            </a>
                                        ) : (
                                            <Link href={message.action_url}>
                                                {message.action_label}
                                            </Link>
                                        ))}
                                </div>
                            ),
                        )}
                        <div ref={messagesEnd} />
                    </div>
                    <div
                        className="store-chat-quick"
                        aria-label="Câu hỏi nhanh"
                    >
                        {quickQuestions.map((question) => (
                            <button
                                type="button"
                                key={question}
                                onClick={() => send(question)}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                    {purchasedProducts.length > 0 && (
                        <div
                            className="store-chat-quick store-chat-purchased"
                            aria-label="Hỗ trợ sản phẩm đã mua"
                        >
                            <strong>Bạn cần hỗ trợ sản phẩm đã mua nào?</strong>
                            {purchasedProducts.map((product) => (
                                <button
                                    type="button"
                                    key={product}
                                    title={'Gửi yêu cầu hỗ trợ về ' + product}
                                    onClick={() =>
                                        send(
                                            'Hỗ trợ sản phẩm đã mua: ' +
                                                product,
                                        )
                                    }
                                >
                                    Hỗ trợ: {product}
                                </button>
                            ))}
                        </div>
                    )}
                    <form
                        className="store-chat-compose"
                        onSubmit={(event) => {
                            event.preventDefault();
                            send(draft);
                        }}
                    >
                        <label
                            className="store-sr-only"
                            htmlFor="store-chat-input"
                        >
                            Nhập câu hỏi
                        </label>
                        <input
                            ref={input}
                            id="store-chat-input"
                            value={draft}
                            maxLength={300}
                            placeholder="Nhập câu hỏi hoặc mã đơn 8 ký tự"
                            disabled={sending}
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <button
                            type="submit"
                            aria-label="Gửi câu hỏi"
                            disabled={!draft.trim() || sending}
                        >
                            <SendHorizontal size={19} aria-hidden="true" />
                        </button>
                    </form>
                    {conversationStatus === 'closed' && (
                        <p className="store-chat-status">
                            Cuộc trò chuyện trước đã đóng. Gửi tin mới để mở
                            cuộc trò chuyện khác.
                        </p>
                    )}
                    {error && (
                        <p className="store-chat-status" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="store-chat-handoff">
                        <span>Cần hỗ trợ chi tiết?</span>
                        {chatUrl ? (
                            <a href={chatUrl} target="_blank" rel="noreferrer">
                                Chat với nhân viên trên Zalo
                            </a>
                        ) : shop?.contact?.hotline ? (
                            <a
                                href={
                                    'tel:' +
                                    shop.contact.hotline.replace(/[^0-9+]/g, '')
                                }
                            >
                                Gọi tổng đài
                            </a>
                        ) : (
                            <span>Thông tin liên hệ đang được cập nhật</span>
                        )}
                    </div>
                </section>
            )}
            <button
                ref={launcher}
                type="button"
                className="store-chat-launcher"
                aria-label={open ? 'Đóng chat hỗ trợ' : 'Mở chat hỗ trợ'}
                aria-expanded={open}
                aria-controls="store-support-chat"
                title="Chat hỗ trợ khách hàng"
                onClick={() => setOpen((current) => !current)}
            >
                {open ? (
                    <X size={22} aria-hidden="true" />
                ) : (
                    <MessageCircle size={24} aria-hidden="true" />
                )}
            </button>
        </div>
    );
}
