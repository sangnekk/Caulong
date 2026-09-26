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
    play_style: 'attack' | 'speed' | 'balanced';
    skill_level: 'beginner' | 'intermediate' | 'advanced' | 'all';
    specs: Partial<
        Record<
            'weight' | 'balance' | 'stiffness' | 'material' | 'max_tension',
            string
        >
    > | null;
    is_demo: boolean;
    is_featured: boolean;
    brand: Taxonomy | null;
    category: Taxonomy | null;
    variants: Variant[];
};
export type Pagination<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
};
export type ProductFilters = {
    q: string;
    category: string;
    brand: string;
    style: string;
    sort: string;
};
export type CartItem = {
    variant_id: number;
    product_id: number | null;
    slug: string | null;
    name: string;
    variant_name: string;
    sku: string;
    image_url: string;
    is_available: boolean;
    price: number;
    quantity: number;
    stock: number;
    line_total: number;
    is_demo: boolean;
};
export type Totals = { subtotal: number; shipping_fee: number; total: number };
export type Cart = Totals & { items: CartItem[]; count: number };
export type Order = Totals & {
    public_id: string;
    name: string;
    phone: string;
    address: string;
    email: string | null;
    notes: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    is_demo: boolean;
    created_at: string;
    items: {
        product_name: string;
        variant_name: string;
        sku: string;
        unit_price: number;
        quantity: number;
        line_total: number;
    }[];
};
export type ShopSharedProps = {
    shop: { cart_count: number; is_admin: boolean };
    flash: { success: string | null; error: string | null };
};
export const vnd = (amount: number): string =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
export const playStyles = {
    attack: 'Tấn công',
    speed: 'Tốc độ',
    balanced: 'Cân bằng',
};
export const skillLevels = {
    beginner: 'Mới chơi',
    intermediate: 'Trung bình',
    advanced: 'Nâng cao',
    all: 'Mọi trình độ',
};
