import { Link, usePage } from '@/lib/page';
import { MessageCircle, SendHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { mark } from '@/lib/analytics';
import type { ShopSharedProps } from '@/types/commerce';

type ChatMessage = {
    id: number;
    sender: 'customer' | 'admin' | 'bot';
    body: string;
    action_url: string | null;
    action_label: string | null;
    created_at?: string;
};
/** Where the conversation stands (App\Services\SupportChat): closed is over, the rest go on. */
type ChatStatus = 'open' | 'pending' | 'resolved' | 'closed';
type ChatResponse = {
    status: ChatStatus | null;
    messages: ChatMessage[];
    /** Solved or closed: a code to read it again later can be asked for. */
    can_request_code: boolean;
    /** Until when the code already given is good; the code itself is shown only once. */
    code_expires_at: string | null;
};
type ChatContextResponse = { purchased_products: string[] };
type AccessCode = { code: string; expires_at: string };
/** A finished conversation opened with its code. */
type Transcript = {
    status: ChatStatus;
    started_at: string;
    closed_at: string | null;
    messages: ChatMessage[];
};

const greeting: ChatMessage = {
    id: 0,
    sender: 'bot',
    body: 'Xin chào! Mình là trợ lý tự động của Shop Cầu Lông. Bạn có thể hỏi về chọn vợt, giao hàng, thanh toán hoặc nhập mã đơn 8 ký tự nếu đặt hàng khi chưa đăng nhập.',
    action_url: null,
    action_label: null,
};
const noConversation: ChatResponse = {
    status: null,
    messages: [],
    can_request_code: false,
    code_expires_at: null,
};
const quickQuestions = [
    'Tư vấn chọn vợt',
    'Phí giao hàng',
    'Thanh toán',
    'Đơn hàng',
    'Đổi trả',
    'Hỗ trợ vấn đề khác',
];

const day = (value: string) => new Date(value).toLocaleDateString('vi-VN');

/** The chat's own endpoints are Laravel's (next.config.ts sends /support-chat/* there). */
const post = (url: string, body?: Record<string, string>) =>
    fetch(url, {
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
        body: JSON.stringify(body ?? {}),
    });

function Messages({ messages }: { messages: ChatMessage[] }) {
    return messages.map((message) => (
        <div
            key={message.id}
            className="store-chat-message"
            data-author={
                message.sender === 'customer' ? 'visitor' : 'assistant'
            }
        >
            {message.sender === 'admin' && <small>Nhân viên hỗ trợ</small>}
            <p>{message.body}</p>
            {message.action_url &&
                message.action_label &&
                (message.action_url.startsWith('http') ? (
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
    ));
}

export default function ShopSupportChat() {
    const { props } = usePage<ShopSharedProps & { auth?: { user: unknown } }>();
    const shop = props.shop;
    const chatUrl = shop?.contact?.chat_url;
    // A customer's conversations are kept on their account; a visitor's are read again by code.
    const hasAccount = !!props.auth?.user && !shop?.is_admin;
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [chat, setChat] = useState<ChatResponse>(noConversation);
    const [purchasedProducts, setPurchasedProducts] = useState<string[]>([]);
    const [code, setCode] = useState<AccessCode | null>(null);
    const [requestingCode, setRequestingCode] = useState(false);
    const [looking, setLooking] = useState(false);
    const [typedCode, setTypedCode] = useState('');
    const [lookingUp, setLookingUp] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const launcher = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const codeInput = useRef<HTMLInputElement>(null);
    const messagesEnd = useRef<HTMLDivElement>(null);
    const autoCodeRequested = useRef(false);

    const messages = chat.messages;
    const conversationStatus = chat.status;

    useEffect(() => {
        if (!open) return;
        if (looking) codeInput.current?.focus();
        else input.current?.focus();
    }, [open, looking]);

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
                setChat((await response.json()) as ChatResponse);
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
    }, [messages, open, looking, transcript]);

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
        const starting = !messages.length || conversationStatus === 'closed';
        void post('/support-chat/messages', { message: text })
            .then(async (response) => {
                if (!response.ok) {
                    setError(
                        response.status === 429
                            ? 'Bạn gửi hơi nhanh. Vui lòng đợi một chút rồi thử lại.'
                            : 'Chưa gửi được tin nhắn. Vui lòng thử lại.',
                    );
                    return;
                }
                setChat((await response.json()) as ChatResponse);
                if (starting) {
                    // A new conversation: the code shown was the previous one's.
                    setCode(null);
                    autoCodeRequested.current = false;
                    mark('chat_started');
                }
            })
            .catch(() => setError('Mất kết nối. Vui lòng thử gửi lại.'))
            .finally(() => setSending(false));
    };

    const requestCode = () => {
        if (requestingCode) return;
        setRequestingCode(true);
        setError('');
        void post('/support-chat/code')
            .then(async (response) => {
                if (!response.ok) {
                    setError('Chưa lấy được mã. Vui lòng thử lại.');
                    return;
                }
                const issued = (await response.json()) as AccessCode;
                setCode(issued);
                setChat((current) => ({
                    ...current,
                    code_expires_at: issued.expires_at,
                }));
            })
            .catch(() => setError('Mất kết nối. Vui lòng thử lại.'))
            .finally(() => setRequestingCode(false));
    };

    // A guest whose conversation has just been closed should not have to find the
    // "Lấy mã xem lại" button: issue the code once, as soon as the closure reaches the widget.
    // The server still sends code_expires_at when a code already exists, so a saved code is
    // never replaced behind the customer's back.
    useEffect(() => {
        if (
            !open ||
            hasAccount ||
            conversationStatus !== 'closed' ||
            !chat.can_request_code ||
            chat.code_expires_at ||
            code ||
            autoCodeRequested.current
        ) {
            return;
        }
        autoCodeRequested.current = true;
        requestCode();
    }, [
        open,
        hasAccount,
        conversationStatus,
        chat.can_request_code,
        chat.code_expires_at,
        code,
        requestCode,
    ]);

    const lookUp = (event: FormEvent) => {
        event.preventDefault();
        const typed = typedCode.trim();
        if (!typed || lookingUp) return;
        setLookingUp(true);
        setLookupError('');
        void post('/support-chat/lookup', { code: typed })
            .then(async (response) => {
                if (response.ok) {
                    setTranscript((await response.json()) as Transcript);
                    return;
                }
                const refused = (await response.json().catch(() => null)) as {
                    message?: string;
                } | null;
                setLookupError(
                    refused?.message ?? 'Mã không đúng hoặc đã hết hạn.',
                );
            })
            .catch(() => setLookupError('Mất kết nối. Vui lòng thử lại.'))
            .finally(() => setLookingUp(false));
    };

    const backToChat = () => {
        setLooking(false);
        setTranscript(null);
        setTypedCode('');
        setLookupError('');
    };

    return (
        <div className="store-chat-widget">
            {open && (
                <section
                    id="store-support-chat"
                    className="store-chat-panel"
                    // A conversation is private: Clarity never records what is in it.
                    data-clarity-mask="true"
                    role="dialog"
                    aria-label="Chat hỗ trợ khách hàng"
                    aria-modal="false"
                >
                    <header className="store-chat-header">
                        <div>
                            <strong>Hỗ trợ khách hàng</strong>
                            <span>
                                {looking
                                    ? 'Xem lại cuộc trò chuyện cũ'
                                    : 'Trợ lý tự động · Có nhân viên trên Zalo'}
                            </span>
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
                    {looking ? (
                        <>
                            <div
                                className="store-chat-thread"
                                aria-live="polite"
                            >
                                {transcript ? (
                                    <>
                                        <p className="store-chat-note">
                                            Cuộc trò chuyện ngày{' '}
                                            {day(transcript.started_at)}
                                            {transcript.closed_at &&
                                                ', đóng ngày ' +
                                                    day(transcript.closed_at)}
                                            . Chỉ để xem lại.
                                        </p>
                                        <Messages
                                            messages={transcript.messages}
                                        />
                                    </>
                                ) : (
                                    <p className="store-chat-note">
                                        Nhập mã xem lại bạn nhận được khi cuộc
                                        trò chuyện kết thúc (10 ký tự, ví dụ
                                        ABCDE-FGH23). Mã dùng được trong 30
                                        ngày.
                                    </p>
                                )}
                                <div ref={messagesEnd} />
                            </div>
                            {!transcript && (
                                <form
                                    className="store-chat-compose"
                                    onSubmit={lookUp}
                                >
                                    <label
                                        className="store-sr-only"
                                        htmlFor="store-chat-code"
                                    >
                                        Mã xem lại
                                    </label>
                                    <input
                                        ref={codeInput}
                                        id="store-chat-code"
                                        value={typedCode}
                                        maxLength={20}
                                        autoComplete="off"
                                        autoCapitalize="characters"
                                        spellCheck={false}
                                        placeholder="Mã xem lại"
                                        disabled={lookingUp}
                                        onChange={(event) =>
                                            setTypedCode(event.target.value)
                                        }
                                    />
                                    <button
                                        type="submit"
                                        aria-label="Xem lại cuộc trò chuyện"
                                        disabled={
                                            !typedCode.trim() || lookingUp
                                        }
                                    >
                                        <SendHorizontal
                                            size={19}
                                            aria-hidden="true"
                                        />
                                    </button>
                                </form>
                            )}
                            {lookupError && (
                                <p className="store-chat-status" role="alert">
                                    {lookupError}
                                </p>
                            )}
                            <div className="store-chat-handoff">
                                <button
                                    type="button"
                                    className="store-chat-link"
                                    onClick={backToChat}
                                >
                                    Quay lại chat
                                </button>
                                {transcript && (
                                    <button
                                        type="button"
                                        className="store-chat-link"
                                        onClick={() => setTranscript(null)}
                                    >
                                        Nhập mã khác
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div
                                className="store-chat-thread"
                                role="log"
                                aria-live="polite"
                                aria-relevant="additions text"
                            >
                                <Messages
                                    messages={
                                        messages.length ? messages : [greeting]
                                    }
                                />
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
                                    <strong>
                                        Bạn cần hỗ trợ sản phẩm đã mua nào?
                                    </strong>
                                    {purchasedProducts.map((product) => (
                                        <button
                                            type="button"
                                            key={product}
                                            title={
                                                'Gửi yêu cầu hỗ trợ về ' +
                                                product
                                            }
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
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                />
                                <button
                                    type="submit"
                                    aria-label="Gửi câu hỏi"
                                    disabled={!draft.trim() || sending}
                                >
                                    <SendHorizontal
                                        size={19}
                                        aria-hidden="true"
                                    />
                                </button>
                            </form>
                            {conversationStatus === 'resolved' && (
                                <p className="store-chat-status">
                                    Nhân viên đã đánh dấu yêu cầu này là đã giải
                                    quyết. Bạn cứ nhắn tiếp nếu còn cần hỗ trợ.
                                </p>
                            )}
                            {conversationStatus === 'closed' && (
                                <p className="store-chat-status">
                                    Cuộc trò chuyện trước đã đóng. Gửi tin mới
                                    để mở cuộc trò chuyện khác.
                                </p>
                            )}
                            {chat.can_request_code &&
                                (hasAccount ? (
                                    <p className="store-chat-status">
                                        Cuộc trò chuyện này được lưu trong{' '}
                                        <Link href="/account#ho-tro">
                                            Tài khoản của tôi
                                        </Link>
                                        .
                                    </p>
                                ) : code ? (
                                    <p
                                        className="store-chat-status store-chat-code"
                                        role="status"
                                    >
                                        Mã xem lại: <code>{code.code}</code>
                                        <span>
                                            Dùng đến {day(code.expires_at)}. Mã
                                            chỉ hiện một lần, bạn hãy lưu lại.
                                        </span>
                                    </p>
                                ) : (
                                    <p className="store-chat-status">
                                        {chat.code_expires_at
                                            ? 'Bạn đã lấy mã xem lại (dùng đến ' +
                                              day(chat.code_expires_at) +
                                              '). '
                                            : 'Muốn xem lại cuộc trò chuyện này sau? '}
                                        <button
                                            type="button"
                                            className="store-chat-link"
                                            disabled={requestingCode}
                                            onClick={requestCode}
                                        >
                                            {chat.code_expires_at
                                                ? 'Lấy mã mới (mã cũ hết dùng được)'
                                                : 'Lấy mã xem lại'}
                                        </button>
                                    </p>
                                ))}
                            {error && (
                                <p className="store-chat-status" role="alert">
                                    {error}
                                </p>
                            )}
                            <div className="store-chat-handoff">
                                {hasAccount ? (
                                    <span>Cần hỗ trợ chi tiết?</span>
                                ) : (
                                    <button
                                        type="button"
                                        className="store-chat-link"
                                        onClick={() => setLooking(true)}
                                    >
                                        Có mã xem lại?
                                    </button>
                                )}
                                {chatUrl ? (
                                    <a
                                        href={chatUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Chat với nhân viên trên Zalo
                                    </a>
                                ) : shop?.contact?.hotline ? (
                                    <a
                                        href={
                                            'tel:' +
                                            shop.contact.hotline.replace(
                                                /[^0-9+]/g,
                                                '',
                                            )
                                        }
                                    >
                                        Gọi tổng đài
                                    </a>
                                ) : (
                                    <span>
                                        Thông tin liên hệ đang được cập nhật
                                    </span>
                                )}
                            </div>
                        </>
                    )}
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
