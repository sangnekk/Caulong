import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

export type Taxonomy = { id: number; name: string; slug: string };
export type Variant = {
    id: number;
    sku: string;
    name: string;
    price: number;
    stock: number;
    is_active: boolean;
};
export type Product = {
    id: number;
    name: string;
    slug: string;
    description: string;
    image_url: string;
    brand_id: number | null;
    category_id: number | null;
    brand?: Taxonomy | null;
    category?: Taxonomy | null;
    play_style: string;
    skill_level: string;
    specs: Record<string, string> | null;
    is_active: boolean;
    is_featured: boolean;
    is_demo: boolean;
    variants: Variant[];
};
export type Order = {
    id: number;
    public_id: string;
    name: string;
    phone: string;
    address: string;
    email: string | null;
    notes: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    is_demo: boolean;
    created_at: string;
    items: {
        id: number;
        product_name: string;
        variant_name: string;
        sku: string;
        unit_price: number;
        quantity: number;
        line_total: number;
    }[];
};
export type Pagination<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};
export const money = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
export const statuses: Record<string, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
};
export function Field({
    name,
    label,
    error,
    children,
}: {
    name: string;
    label: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="admin-field">
            <label htmlFor={name}>{label}</label>
            {children}
            {error && (
                <p id={name + '-error'} className="admin-error">
                    {error}
                </p>
            )}
        </div>
    );
}
export function Errors({
    errors,
}: {
    errors: Record<string, string | undefined>;
}) {
    const messages = Object.entries(errors).filter(([, message]) => message);
    return messages.length ? (
        <div className="admin-error-summary" role="alert">
            <strong>Chưa lưu được. Kiểm tra thông tin:</strong>
            <ul>
                {messages.map(([name, message]) => (
                    <li key={name}>{message}</li>
                ))}
            </ul>
        </div>
    ) : null;
}
export function Pages<T>({ page }: { page: Pagination<T> }) {
    return (
        <nav className="admin-pagination" aria-label="Phân trang">
            <span>
                {page.total} kết quả · Trang {page.current_page}/
                {page.last_page}
            </span>
            <div>
                {page.prev_page_url && (
                    <Link href={page.prev_page_url}>Trang trước</Link>
                )}
                {page.next_page_url && (
                    <Link href={page.next_page_url}>Trang sau</Link>
                )}
            </div>
        </nav>
    );
}
export function OrderTable({ orders }: { orders: Order[] }) {
    return orders.length ? (
        <div
            className="admin-table-wrap"
            role="region"
            aria-label="Danh sách đơn hàng"
            tabIndex={0}
        >
            <table>
                <thead>
                    <tr>
                        <th scope="col">Đơn hàng</th>
                        <th scope="col">Khách hàng</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Thanh toán</th>
                        <th scope="col" className="admin-number">
                            Tổng tiền
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id}>
                            <th scope="row">
                                <Link href={'/admin/orders/' + order.id}>
                                    #{order.id}
                                </Link>
                                <small>
                                    {new Date(
                                        order.created_at,
                                    ).toLocaleDateString('vi-VN')}
                                </small>
                                {order.is_demo && <small>Đơn mẫu</small>}
                            </th>
                            <td>{order.name}</td>
                            <td>{statuses[order.status] ?? order.status}</td>
                            <td>
                                {order.payment_status === 'paid'
                                    ? 'Đã thu tiền'
                                    : 'Chưa thu tiền'}
                            </td>
                            <td className="admin-number">
                                {money(order.total)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    ) : (
        <p className="admin-empty">
            Chưa có đơn hàng trong danh sách này. Đơn đặt tại cửa hàng sẽ xuất
            hiện ở đây.
        </p>
    );
}
