'use client';

import { Head, Link, router, useForm } from '@/lib/page';
import { Check, CheckCheck, SendHorizontal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import {
    ChatStatus,
    date,
    money,
    OrderStatus,
    PageHeader,
    SegmentBadge,
    serviceLine,
    ServiceStatus,
} from './shared';
import type { ChatState, ChatSummary, ServiceSummary } from './shared';

type Conversation = {
    id: number;
    status: ChatState;
    /** The customer's name when the conversation is on an account. */
    customer_name: string | null;
    assigned_to: number | null;
    assigned_name: string | null;
    last_message_at: string | null;
    /** The last thing a person wrote; the assistant's own lines are left out. */
    last_message: string | null;
    last_from_staff: boolean;
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
type Filter = 'active' | ChatState | 'all';
/** Who staff are answering, and what happened before (App\Services\SupportChat::context). */
type Context = {
    customer: {
        id: number;
        name: string;
        email: string;
        segment: string | null;
        verified: boolean;
        joined: string | null;
    } | null;
    overview: {
        orders: number;
        open: number;
        spent: number;
        last_order_at: string | null;
    } | null;
    orders: {
        id: number;
        code: string;
        status: string;
        payment_status: string;
        total: number;
        is_demo: boolean;
        created_at: string;
    }[];
    purchased: { name: string; units: number }[];
    viewed: { id: number; name: string }[];
    /** The rackets they asked the shop to string. */
    services: ServiceSummary[];
    conversations: ChatSummary[];
};

const dateTime = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'short',
              timeStyle: 'short',
          }).format(new Date(value))
        : '';

/** A conversation on an account carries the customer's name; a visitor's only its number. */
const who = (conversation: { id: number; customer_name: string | null }) =>
    conversation.customer_name ?? 'Khách vãng lai #' + conversation.id;

function ContextPanel({
    context,
    canManageShop,
}: {
    context: Context;
    canManageShop: boolean;
}) {
    const { customer, overview } = context;
    return (
        <aside className="admin-chat-context" aria-label="Thông tin khách hàng">
            <section>
                <h2>Khách hàng</h2>
                {customer ? (
                    <>
                        <p className="admin-chat-context-name">
                            {canManageShop ? (
                                <Link href={'/admin/customers/' + customer.id}>
                                    {customer.name}
                                </Link>
                            ) : (
                                <strong>{customer.name}</strong>
                            )}{' '}
                            <SegmentBadge segment={customer.segment} />
                        </p>
                        <p className="admin-muted">
                            {customer.email}
                            {!customer.verified && ' · chưa xác minh email'}
                            <br />
                            Tham gia {date(customer.joined)}
                        </p>
                        {overview && (
                            <dl className="admin-chat-context-figures">
                                <div>
                                    <dt>Đã thu</dt>
                                    <dd>{money(overview.spent)}</dd>
                                </div>
                                <div>
                                    <dt>Đơn hàng</dt>
                                    <dd>
                                        {overview.orders}
                                        {overview.open > 0 &&
                                            ' · ' +
                                                overview.open +
                                                ' đang xử lý'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Mua gần nhất</dt>
                                    <dd>{date(overview.last_order_at)}</dd>
                                </div>
                            </dl>
                        )}
                    </>
                ) : (
                    <p className="admin-muted">
                        Khách chưa đăng nhập. Chỉ có thông tin của lượt truy cập
                        này; hỏi mã đơn hoặc số điện thoại nếu cần tra đơn.
                    </p>
                )}
            </section>
            <section>
                <h3>{customer ? 'Đơn gần đây' : 'Đơn đặt trong lượt này'}</h3>
                {context.orders.length ? (
                    <ul>
                        {context.orders.map((order) => (
                            <li key={order.id}>
                                <span>
                                    {canManageShop ? (
                                        <Link
                                            href={'/admin/orders/' + order.id}
                                        >
                                            {order.code}
                                        </Link>
                                    ) : (
                                        <strong>{order.code}</strong>
                                    )}
                                    <small className="admin-muted">
                                        {date(order.created_at)} ·{' '}
                                        {money(order.total)}
                                        {order.payment_status === 'paid' &&
                                            ' · đã thu'}
                                        {order.is_demo && ' · đơn mẫu'}
                                    </small>
                                </span>
                                <OrderStatus status={order.status} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="admin-muted">Chưa có đơn nào.</p>
                )}
            </section>
            {context.purchased.length > 0 && (
                <section>
                    <h3>Đã mua</h3>
                    <ul>
                        {context.purchased.map((product) => (
                            <li key={product.name}>
                                <span>{product.name}</span>
                                <span className="admin-muted">
                                    ×{product.units}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {context.viewed.length > 0 && (
                <section>
                    <h3>Xem gần đây</h3>
                    <ul>
                        {context.viewed.map((product) => (
                            <li key={product.id}>
                                <span>{product.name}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {context.services.length > 0 && (
                <section>
                    <h3>Đan dây</h3>
                    <ul>
                        {context.services.map((request) => (
                            <li key={request.id}>
                                <span>
                                    {canManageShop ? (
                                        <Link
                                            href={
                                                '/admin/service-orders/' +
                                                request.id
                                            }
                                        >
                                            {request.code}
                                        </Link>
                                    ) : (
                                        <strong>{request.code}</strong>
                                    )}
                                    <small className="admin-muted">
                                        {serviceLine(request)}
                                    </small>
                                </span>
                                <ServiceStatus status={request.status} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <section>
                <h3>Cuộc trò chuyện trước</h3>
                {context.conversations.length ? (
                    <ul>
                        {context.conversations.map((earlier) => (
                            <li key={earlier.id}>
                                <span>
                                    <Link
                                        href={
                                            '/admin/support-chat?status=all&conversation=' +
                                            earlier.id
                                        }
                                    >
                                        {earlier.excerpt || 'Không có nội dung'}
                                    </Link>
                                    <small className="admin-muted">
                                        {date(earlier.started_at)}
                                        {!earlier.needs_human &&
                                            ' · chỉ trợ lý tự động'}
                                    </small>
                                </span>
                                <ChatStatus status={earlier.status} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="admin-muted">Đây là lần đầu khách nhắn.</p>
                )}
            </section>
        </aside>
    );
}

export default function SupportChat({
    conversations,
    selected,
    messages,
    context,
    filters,
    counts,
    unread_count,
    can_manage_shop,
}: {
    conversations: Pagination;
    selected: {
        id: number;
        status: ChatState;
        /** Handed to the staff; a conversation the assistant handled alone can only be read. */
        is_ticket: boolean;
        customer_name: string | null;
        assigned_to: number | null;
        assigned_name: string | null;
        can_reply: boolean;
        started_at: string;
    } | null;
    messages: Message[];
    context: Context | null;
    filters: { status: Filter };
    counts: Record<ChatState, number>;
    unread_count: number;
    /** Support staff see the customer's details here but cannot open the shop's other pages. */
    can_manage_shop: boolean;
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
                    'counts',
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

    const writing = form.data.message.trim() !== '';
    useEffect(() => {
        // A new message elsewhere is shown at once, unless a reply is being written here.
        if (unread_count > previousUnread.current && !writing) {
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
    }, [
        conversations.data,
        filters.status,
        selected?.id,
        unread_count,
        writing,
    ]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!selected || !form.data.message.trim()) return;
        form.post(`/admin/support-chat/${selected.id}/reply`, {
            preserveScroll: true,
            onSuccess: () => form.reset('message'),
        });
    };

    const act = (action: 'claim' | 'resolve' | 'close') => {
        if (!selected) return;
        router.post(
            `/admin/support-chat/${selected.id}/${action}`,
            {},
            { preserveScroll: true },
        );
    };

    const over = selected?.status === 'closed';
    const tabs: [Filter, string, number | null][] = [
        ['active', 'Đang xử lý', counts.open + counts.pending],
        ['resolved', 'Đã giải quyết', counts.resolved],
        ['closed', 'Đã đóng', counts.closed],
        ['all', 'Tất cả', null],
    ];

    return (
        <>
            <Head title="Chat hỗ trợ" />
            <PageHeader
                title="Chat hỗ trợ"
                description="Các cuộc trò chuyện trợ lý tự động đã chuyển cho nhân viên. Nhận ticket để trả lời; đánh dấu đã giải quyết khi xong, đóng khi cuộc trò chuyện kết thúc."
            />
            <nav className="admin-chat-tabs" aria-label="Lọc hội thoại">
                {tabs.map(([value, label, count]) => (
                    <Link
                        key={value}
                        href={`/admin/support-chat?status=${value}`}
                        aria-current={
                            filters.status === value ? 'page' : undefined
                        }
                    >
                        {label}
                        {count !== null && count > 0 && <span>{count}</span>}
                    </Link>
                ))}
                <span className="admin-chat-unread-total">
                    {unread_count.toLocaleString('vi-VN')} chưa đọc
                </span>
            </nav>
            <div
                className="admin-chat-layout"
                data-context={context ? 'shown' : undefined}
            >
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
                                    <strong>{who(conversation)}</strong>
                                    <time>
                                        {dateTime(conversation.last_message_at)}
                                    </time>
                                </span>
                                <span className="admin-chat-entry-bottom">
                                    <span>
                                        {conversation.last_from_staff &&
                                            'Shop: '}
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
                                    <ChatStatus status={conversation.status} />
                                    {conversation.assigned_name &&
                                        ' ' + conversation.assigned_name}
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
                                    <h2>{who(selected)}</h2>
                                    <ChatStatus status={selected.status} />{' '}
                                    <span>
                                        Bắt đầu {dateTime(selected.started_at)}
                                    </span>
                                    {selected.assigned_to && (
                                        <span className="admin-chat-owner">
                                            {selected.can_reply
                                                ? 'Bạn đang nhận ticket này'
                                                : `Đang được ${selected.assigned_name ?? 'nhân viên khác'} tiếp nhận`}
                                        </span>
                                    )}
                                </div>
                                <div className="admin-chat-actions">
                                    {selected.is_ticket &&
                                        !over &&
                                        selected.assigned_to === null && (
                                            <button
                                                type="button"
                                                className="admin-button"
                                                onClick={() => act('claim')}
                                            >
                                                <Check aria-hidden="true" />
                                                Nhận xử lý
                                            </button>
                                        )}
                                    {selected.can_reply &&
                                        (selected.status === 'open' ||
                                            selected.status === 'pending') && (
                                            <button
                                                type="button"
                                                className="admin-button-secondary"
                                                onClick={() => act('resolve')}
                                            >
                                                <Check aria-hidden="true" />
                                                Đánh dấu đã giải quyết
                                            </button>
                                        )}
                                    {selected.can_reply && !over && (
                                        <button
                                            type="button"
                                            className="admin-button-secondary"
                                            onClick={() => act('close')}
                                        >
                                            <CheckCheck aria-hidden="true" />
                                            Đóng hội thoại
                                        </button>
                                    )}
                                </div>
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
                            {!over && selected.can_reply ? (
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
                                    {selected.status === 'resolved' && (
                                        <p className="admin-muted">
                                            Đã đánh dấu đã giải quyết. Trả lời
                                            thêm thì ticket trở lại chờ khách.
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
                            ) : (
                                <p className="admin-chat-closed-note">
                                    {over
                                        ? 'Hội thoại đã đóng. Khách gửi tin mới sẽ mở hội thoại khác.'
                                        : !selected.is_ticket
                                          ? 'Cuộc trò chuyện này chỉ có trợ lý tự động trả lời: khách chưa cần tới nhân viên.'
                                          : selected.assigned_to
                                            ? `Ticket đang do ${selected.assigned_name ?? 'nhân viên khác'} tiếp nhận; bạn chưa thể gửi phản hồi.`
                                            : 'Nhận ticket để bắt đầu phản hồi khách hàng.'}
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
                {context && (
                    <ContextPanel
                        context={context}
                        canManageShop={can_manage_shop}
                    />
                )}
            </div>
        </>
    );
}
