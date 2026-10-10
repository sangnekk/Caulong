export type Taxonomy = { id: number; name: string; slug: string };
export type Variant = {
    id: number;
    sku: string;
    name: string;
    price: number;
    /** The list price, only when it is above the price. */
    compare_at_price: number | null;
    stock: number;
    is_active: boolean;
};
export type Product = {
    id: number;
    name: string;
    slug: string;
    description: string;
    image_url: string;
    /** Every photo, the main one first: on the product page only. */
    images?: string[];
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
/** A product as a card: in the grid, and in the lists of suggestions. */
export type ProductCard = {
    id: number;
    name: string;
    slug: string;
    image_url: string;
    play_style: Product['play_style'];
    is_demo: boolean;
    brand: string | null;
    /** The lowest price among the versions on sale. */
    price: number | null;
    compare_at_price: number | null;
    in_stock: boolean;
};
/** Published reviews of a product: the average and the latest ones. */
export type ProductReviews = {
    count: number;
    average: number | null;
    items: {
        id: number;
        /** The customer's given name only. */
        author: string;
        rating: number;
        body: string | null;
        created_at: string;
    }[];
};
/** What the signed-in customer may write on a product page; null for a guest. */
export type ReviewViewer = {
    /** They received the product in a real order. */
    eligible: boolean;
    mine: {
        rating: number;
        body: string | null;
        status: 'pending' | 'published' | 'hidden';
    } | null;
} | null;
/** A saved product on the account page; one no longer sold stays listed until removed. */
export type WishlistItem = ProductCard & { on_sale: boolean };
export type Recommendations = {
    viewed: ProductCard[];
    basis: 'personal' | 'popular' | null;
    suggested: ProductCard[];
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
    price?: string;
    stock?: string;
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
export type Cart = Totals & {
    items: CartItem[];
    count: number;
    /** What the entered coupon takes off right now. */
    discount: number;
    /** The code kept with the cart; `error` says why it takes nothing off at the moment. */
    coupon: { code: string; name: string | null; error: string | null } | null;
};
/** A coupon given to the customer (their own, or their group's), on the account page. */
export type AccountCoupon = {
    code: string;
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    min_order: number;
    max_discount: number | null;
    starts_at: string | null;
    expires_at: string | null;
    /** Made for this customer alone. */
    personal: boolean;
    state: 'usable' | 'scheduled' | 'expired' | 'used';
};
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
    /** What a coupon took off; total = subtotal - discount_total + shipping_fee. */
    discount_total: number;
    coupon_code: string | null;
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
/** Where a stringing request stands (App\Services\StringingService::STATUSES). */
export type ServiceStatus =
    | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'ready'
    | 'completed'
    | 'cancelled';
/** A request to have rackets strung, as lists show it. */
export type ServiceOrderSummary = {
    id: number;
    public_id: string;
    /** The short code the customer reads out at the counter. */
    code: string;
    status: ServiceStatus;
    racket: string;
    string_name: string | null;
    /** The shop's string, or one the customer brings. */
    service_type: 'shop_string' | 'own_string';
    tension_kg: number;
    quantity: number;
    /** What is paid when the racket is collected; 0 while the shop has not said. */
    total: number;
    created_at: string;
};
/** The steps of a stringing request, in the customer's words, with the tone of their badge. */
export const serviceStatuses: Record<ServiceStatus, [string, string]> = {
    pending: ['Chờ cửa hàng xác nhận', 'warning'],
    confirmed: ['Đã hẹn', 'accent'],
    in_progress: ['Đang đan', 'info'],
    ready: ['Đã đan xong', 'success'],
    completed: ['Đã trả vợt', ''],
    cancelled: ['Đã hủy', 'danger'],
};
/** A tension as it is said: "11,5 kg". */
export const kg = (value: number): string =>
    value.toLocaleString('vi-VN') + ' kg';
export type ShopSharedProps = {
    shop: {
        cart_count: number;
        /** A staff account: it works in /admin. */
        is_admin: boolean;
        /** What a staff account may open there: everything, or the support inbox only. */
        staff_role?: 'admin' | 'support' | null;
        pending_orders?: number;
        pending_support_chats?: number;
        pending_reviews?: number;
        /** Stringing requests the shop has not answered yet (admins only). */
        pending_service_orders?: number;
        /** The shop takes stringing requests online. */
        stringing?: boolean;
        shipping_fee?: number;
        contact?: {
            hotline: string;
            email: string;
            address: string;
            chat_url: string;
        };
        free_shipping_from?: number;
    };
    flash: { success: string | null; error: string | null };
};
export const vnd = (amount: number): string =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
/** How far below its list price something sells, as a whole percentage ("-17%"). */
export const discount = (price: number, listPrice: number): string =>
    '-' + Math.max(1, Math.round((1 - price / listPrice) * 100)) + '%';
/** What a coupon takes off, in a line: "Giảm 10%, tối đa 100.000 ₫ · đơn từ 500.000 ₫". */
export const couponTerms = (
    coupon: Pick<
        AccountCoupon,
        'type' | 'value' | 'max_discount' | 'min_order'
    >,
): string =>
    (coupon.type === 'percent'
        ? 'Giảm ' +
          coupon.value +
          '%' +
          (coupon.max_discount ? ', tối đa ' + vnd(coupon.max_discount) : '')
        : 'Giảm ' + vnd(coupon.value)) +
    (coupon.min_order > 0 ? ' · đơn từ ' + vnd(coupon.min_order) : '');
export const shortOrderCode = (publicId: string): string =>
    publicId.replaceAll('-', '').slice(0, 8).toUpperCase();
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
