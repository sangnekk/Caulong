import { Head, Link, router, useForm } from '@inertiajs/react';
import { Check, SendHorizontal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from './shared';

type Conversation = {
    id: number;
    status: 'open' | 'closed';
    assigned_to: number | null;
    assigned_name: string | null;
    last_message_at: string | null;
    last_message: string | null;
    unread_count: number;
};
type Message = {
    id: number;
    sender: 'customer' | 'admin' | 'bot';
    body: string;
    created_at: string;
};
type Pagination = {
    data: Conversation[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

const dateTime = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'short',
              timeStyle: 'short',
          }).format(new Date(value))
        : '';

export default function SupportChat({
    conversations,
    selected,
    messages,
    filters,
    unread_count,
}: {
    conversations: Pagination;
    selected: {
        id: number;
        status: 'open' | 'closed';
        assigned_to: number | null;
        assigned_name: string | null;
        can_reply: boolean;
    } | null;
    messages: Message[];
    filters: { status: 'open' | 'closed' | 'all' };
    unread_count: number;
}) {
    const form = useForm({ message: '' });
    const thread = useRef<HTMLDivElement>(null);
    const previousUnread = useRef(unread_count);

    useEffect(() => {
        const interval = window.setInterval(() => {
            router.reload({
                only: [
                    'conversations',
                    'selected',
                    'messages',
                    'unread_count',
                    'shop',
                ],
            });
        }, 5000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        thread.current?.scrollTo({ top: thread.current.scrollHeight });
    }, [messages]);

    useEffect(() => {
        if (unread_count > previousUnread.current) {
            const newestUnread = conversations.data.find(
                (conversation) => conversation.unread_count > 0,
            );
            if (newestUnread && newestUnread.id !== selected?.id) {
                router.visit(
                    `/admin/support-chat?status=${filters.status}&conversation=${newestUnread.id}`,
                );
            }
        }
        previousUnread.current = unread_count;
    }, [conversations.data, filters.status, selected?.id, unread_count]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!selected || !form.data.message.trim()) return;
        form.post(`/admin/support-chat/${selected.id}/reply`, {
            preserveScroll: true,
            onSuccess: () => form.reset('message'),
        });
    };

    const close = () => {
        if (!selected?.can_reply) return;
        router.post(
            `/admin/support-chat/${selected.id}/close`,
            {},
            { preserveScroll: true },
        );
    };

    const claim = () => {
        if (!selected || selected.status !== 'open' || selected.assigned_to)
            return;
        router.post(
            `/admin/support-chat/${selected.id}/claim`,
            {},
            { preserveScroll: true },
        );
    };

    const statusUrl = (status: 'open' | 'closed' | 'all') =>
        `/admin/support-chat?status=${status}`;

    return (
        <>
            <Head title="Chat hỗ trợ" />
            <PageHeader
                title="Chat hỗ trợ"
                description="Tin nhắn khách hàng và phản hồi tự động; trả lời trực tiếp để nhân viên tiếp nhận hội thoại."
            />
            <nav className="admin-chat-tabs" aria-label="Lọc hội thoại">
                {(
                    [
                        ['open', 'Đang mở'],
                        ['closed', 'Đã đóng'],
                        ['all', 'Tất cả'],
                    ] as const
                ).map(([value, label]) => (
                    <Link
                        key={value}
                        href={statusUrl(value)}
                        aria-current={
                            filters.status === value ? 'page' : undefined
                        }
                    >
                        {label}
                    </Link>
                ))}
                <span className="admin-chat-unread-total">
                    {unread_count.toLocaleString('vi-VN')} chưa đọc
                </span>
            </nav>
            <div className="admin-chat-layout">
                <aside
                    className="admin-chat-list"
                    aria-label="Danh sách hội thoại"
                >
                    {conversations.data.length ? (
                        conversations.data.map((conversation) => (
                            <Link
                                key={conversation.id}
                                className="admin-chat-entry"
                                href={`/admin/support-chat?status=${filters.status}&conversation=${conversation.id}`}
                                aria-current={
                                    selected?.id === conversation.id
                                        ? 'true'
                                        : undefined
                                }
                            >
                                <span className="admin-chat-entry-top">
                                    <strong>Khách #{conversation.id}</strong>
                                    <time>
                                        {dateTime(conversation.last_message_at)}
                                    </time>
                                </span>
                                <span className="admin-chat-entry-bottom">
                                    <span>
                                        {conversation.last_message ??
                                            'Chưa có tin nhắn'}
                                    </span>
                                    {conversation.unread_count > 0 && (
                                        <span className="admin-nav-count">
                                            {conversation.unread_count}
                                        </span>
                                    )}
                                </span>
                                <span className="admin-chat-entry-status">
                                    {conversation.status === 'open'
                                        ? 'Đang mở'
                                        : 'Đã đóng'}
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="admin-chat-empty-list">
                            Chưa có hội thoại trong mục này.
                        </p>
                    )}
                    {(conversations.prev_page_url ||
                        conversations.next_page_url) && (
                        <div className="admin-chat-pages">
                            {conversations.prev_page_url ? (
                                <Link href={conversations.prev_page_url}>
                                    Trước
                                </Link>
                            ) : (
                                <span />
                            )}
                            <span>
                                {conversations.current_page} /{' '}
                                {conversations.last_page}
                            </span>
                            {conversations.next_page_url ? (
                                <Link href={conversations.next_page_url}>
                                    Sau
                                </Link>
                            ) : (
                                <span />
                            )}
                        </div>
                    )}
                </aside>
                <section
                    className="admin-chat-conversation"
                    aria-label="Nội dung hội thoại"
                >
                    {selected ? (
                        <>
                            <header className="admin-chat-conversation-head">
                                <div>
                                    <h2>Khách #{selected.id}</h2>
                                    <span>
                                        {selected.status === 'open'
                                            ? 'Đang mở'
                                            : 'Đã đóng'}
                                    </span>
                                    {selected.assigned_to && (
                                        <span className="admin-chat-owner">
                                            {selected.can_reply
                                                ? 'Bạn đang nhận ticket này'
                                                : `Đang được ${selected.assigned_name ?? 'nhân viên khác'} tiếp nhận`}
                                        </span>
                                    )}
                                </div>
                                {selected.status === 'open' &&
                                    selected.assigned_to === null && (
                                        <button
                                            type="button"
                                            className="admin-button"
                                            onClick={claim}
                                        >
                                            <Check aria-hidden="true" />
                                            Nhận xử lý
                                        </button>
                                    )}
                                {selected.status === 'open' &&
                                    selected.can_reply && (
                                        <button
                                            type="button"
                                            className="admin-button-secondary"
                                            onClick={close}
                                        >
                                            <Check aria-hidden="true" />
                                            Đóng hội thoại
                                        </button>
                                    )}
                            </header>
                            <div className="admin-chat-thread" ref={thread}>
                                {messages.map((message) => (
                                    <article
                                        key={message.id}
                                        className="admin-chat-message"
                                        data-sender={message.sender}
                                    >
                                        <div className="admin-chat-message-meta">
                                            <strong>
                                                {message.sender === 'customer'
                                                    ? 'Khách hàng'
                                                    : message.sender === 'admin'
                                                      ? 'Nhân viên'
                                                      : 'Trợ lý tự động'}
                                            </strong>
                                            <time>
                                                {dateTime(message.created_at)}
                                            </time>
                                        </div>
                                        <p>{message.body}</p>
                                    </article>
                                ))}
                                {!messages.length && (
                                    <p className="admin-chat-empty-list">
                                        Hội thoại chưa có tin nhắn.
                                    </p>
                                )}
                            </div>
                            {selected.status === 'open' &&
                            selected.can_reply ? (
                                <form
                                    className="admin-chat-reply"
                                    onSubmit={submit}
                                >
                                    <label htmlFor="support-reply">
                                        Phản hồi khách hàng
                                    </label>
                                    <textarea
                                        id="support-reply"
                                        value={form.data.message}
                                        maxLength={2000}
                                        rows={3}
                                        onChange={(event) =>
                                            form.setData(
                                                'message',
                                                event.target.value,
                                            )
                                        }
                                        aria-invalid={!!form.errors.message}
                                    />
                                    {form.errors.message && (
                                        <p
                                            className="admin-chat-error"
                                            role="alert"
                                        >
                                            {form.errors.message}
                                        </p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={
                                            form.processing ||
                                            !form.data.message.trim()
                                        }
                                    >
                                        <SendHorizontal aria-hidden="true" />
                                        {form.processing
                                            ? 'Đang gửi…'
                                            : 'Gửi phản hồi'}
                                    </button>
                                </form>
                            ) : selected.status === 'open' ? (
                                <p className="admin-chat-closed-note">
                                    {selected.assigned_to
                                        ? `Ticket đang do ${selected.assigned_name ?? 'nhân viên khác'} tiếp nhận; bạn chưa thể gửi phản hồi.`
                                        : 'Nhận ticket để bắt đầu phản hồi khách hàng.'}
                                </p>
                            ) : (
                                <p className="admin-chat-closed-note">
                                    Hội thoại đã đóng. Khách gửi tin mới sẽ mở
                                    hội thoại khác.
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="admin-chat-empty-thread">
                            <h2>Chọn một hội thoại</h2>
                            <p>
                                Tin khách mới sẽ xuất hiện tại đây cùng câu trả
                                lời tự động.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}
