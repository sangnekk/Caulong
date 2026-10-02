import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Check,
    ExternalLink,
    Eye,
    EyeOff,
    Pencil,
    Search,
    Star,
    StarOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import {
    margin,
    money,
    PageHeader,
    Pages,
    ProductStatus,
    query,
    styles,
    Tabs,
} from './shared';
import type { Pagination } from './shared';

type RowVariant = {
    id: number;
    sku: string;
    name: string;
    price: number;
    cost_price: number | null;
    stock: number;
    is_active: boolean;
};
type Row = {
    id: number;
    name: string;
    slug: string;
    play_style: string;
    is_active: boolean;
    is_featured: boolean;
    is_demo: boolean;
    image_url: string;
    brand: string | null;
    category: string | null;
    variants: RowVariant[];
};
type Filters = {
    q: string;
    status: string;
    stock: string;
    brand: string;
    style: string;
    sort: string;
};
const COLUMNS = 7;
const number = (value: number) => value.toLocaleString('vi-VN');

/** Alarm colours only for what customers can buy; a hidden product at 0 is simply waiting for stock. */
function Stock({
    variants,
    onSale,
}: {
    variants: RowVariant[];
    onSale: boolean;
}) {
    const sellable = variants.filter((variant) => variant.is_active);
    const total = sellable.reduce((sum, variant) => sum + variant.stock, 0);
    const low = sellable.some(
        (variant) => variant.stock > 0 && variant.stock <= 5,
    );
    if (!onSale) return <span className="admin-muted">{number(total)}</span>;
    if (total === 0) return <span className="admin-stock-out">Hết hàng</span>;
    return (
        <span className={low ? 'admin-stock-low' : undefined}>
            {number(total)}
            {low && <small>có phiên bản sắp hết</small>}
        </span>
    );
}

/**
 * Price, cost and stock of every version, edited in place under the row. Enter saves, Escape
 * closes. Stock is checked against what was on screen, so an order placed meanwhile is never
 * overwritten.
 */
function QuickEdit({
    product,
    onClose,
    onSaved,
}: {
    product: Row;
    onClose: () => void;
    onSaved: () => void;
}) {
    const form = useForm({
        variants: product.variants.map((variant) => ({
            id: variant.id,
            price: variant.price as number | '',
            cost_price: (variant.cost_price ?? '') as number | '',
            stock: variant.stock as number | '',
            expected_stock: variant.stock,
        })),
    });
    const first = useRef<HTMLInputElement>(null);
    useEffect(() => {
        first.current?.focus();
        first.current?.select();
    }, []);
    const set = (
        index: number,
        key: 'price' | 'cost_price' | 'stock',
        value: string,
    ) =>
        form.setData(
            'variants',
            form.data.variants.map((row, i) =>
                i === index
                    ? { ...row, [key]: value === '' ? '' : Number(value) }
                    : row,
            ),
        );
    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        form.patch('/admin/products/' + product.id + '/variants', {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onSaved,
        });
    };
    const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
    };
    const errors = Object.values(
        form.errors as Record<string, string | undefined>,
    ).filter(Boolean);

    return (
        <tr className="admin-quick-row">
            <td colSpan={COLUMNS}>
                <form
                    className="admin-quick"
                    onSubmit={submit}
                    onKeyDown={onKey}
                    aria-label={'Sửa nhanh ' + product.name}
                >
                    <div className="admin-quick-grid" role="group">
                        <span className="admin-quick-head">Phiên bản</span>
                        <span className="admin-quick-head">Giá bán</span>
                        <span className="admin-quick-head">Giá nhập</span>
                        <span className="admin-quick-head">Tồn kho</span>
                        {form.data.variants.map((row, index) => {
                            const variant = product.variants[index];
                            const m = margin(
                                Number(row.price) || 0,
                                row.cost_price === '' ? null : row.cost_price,
                            );
                            const id = 'quick-' + variant.id;
                            return (
                                <div
                                    className="admin-quick-line"
                                    key={row.id}
                                    data-inactive={!variant.is_active}
                                >
                                    <span>
                                        <strong>{variant.name}</strong>
                                        <small>
                                            {variant.sku}
                                            {!variant.is_active &&
                                                ' · đang tắt, không bán'}
                                        </small>
                                    </span>
                                    <label>
                                        <span className="sr-only">
                                            Giá bán {variant.name}
                                        </span>
                                        <input
                                            id={id + '-price'}
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            step={1000}
                                            required
                                            value={row.price}
                                            onChange={(e) =>
                                                set(
                                                    index,
                                                    'price',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className="sr-only">
                                            Giá nhập {variant.name}
                                        </span>
                                        <input
                                            id={id + '-cost'}
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            step={1000}
                                            placeholder="Chưa có"
                                            value={row.cost_price}
                                            onChange={(e) =>
                                                set(
                                                    index,
                                                    'cost_price',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <small
                                            data-tone={
                                                m && m.profit < 0
                                                    ? 'bad'
                                                    : undefined
                                            }
                                        >
                                            {m
                                                ? (m.profit < 0
                                                      ? 'Lỗ '
                                                      : 'Lãi ') +
                                                  money(Math.abs(m.profit)) +
                                                  ' · ' +
                                                  Math.round(m.rate) +
                                                  '%'
                                                : 'Để trống nếu chưa biết'}
                                        </small>
                                    </label>
                                    <label>
                                        <span className="sr-only">
                                            Tồn kho {variant.name}
                                        </span>
                                        <input
                                            ref={
                                                index === 0 ? first : undefined
                                            }
                                            id={id + '-stock'}
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            step={1}
                                            required
                                            value={row.stock}
                                            onChange={(e) =>
                                                set(
                                                    index,
                                                    'stock',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                    {errors.length > 0 && (
                        <p className="admin-error" role="alert">
                            {errors[0]}
                        </p>
                    )}
                    <div className="admin-quick-actions">
                        <span className="admin-muted">
                            Enter để lưu · Esc để đóng
                        </span>
                        <button
                            type="button"
                            className="admin-button-ghost admin-button-small"
                            onClick={onClose}
                        >
                            Đóng
                        </button>
                        <button
                            type="submit"
                            className="admin-button-small"
                            disabled={form.processing || !form.isDirty}
                            data-busy={form.processing}
                        >
                            {form.processing ? 'Đang lưu…' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </td>
        </tr>
    );
}

export default function Products({
    products,
    filters,
    counts,
    brands,
}: {
    products: Pagination<Row>;
    filters: Filters;
    counts: Record<'all' | 'active' | 'hidden' | 'demo', number>;
    brands: { id: number; name: string }[];
}) {
    const [q, setQ] = useState(filters.q);
    const [loading, setLoading] = useState(false);
    const typing = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(typing.current), []);
    // Every filter applies as soon as it changes; typing searches after a short pause.
    const visit = (next: Partial<Filters>) => {
        window.clearTimeout(typing.current);
        router.get(
            query('/admin/products', { ...filters, q, ...next }),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };
    const onType = (value: string) => {
        setQ(value);
        window.clearTimeout(typing.current);
        typing.current = window.setTimeout(
            () => visit({ q: value.trim() }),
            450,
        );
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit({ q: q.trim() });
    };
    const filtered =
        filters.q !== '' ||
        filters.stock !== '' ||
        filters.brand !== '' ||
        filters.style !== '';

    // Selection lives on the rows in view: changing page or filter drops what is no longer shown.
    const [picked, setPicked] = useState<number[]>([]);
    const [everything, setEverything] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [bulkError, setBulkError] = useState<string | null>(null);
    const [editing, setEditing] = useState<number | null>(null);
    const [saved, setSaved] = useState<number | null>(null);
    useEffect(() => {
        if (saved === null) return;
        const timer = window.setTimeout(() => setSaved(null), 2500);
        return () => window.clearTimeout(timer);
    }, [saved]);
    const visible = products.data.map((product) => product.id);
    const selected = picked.filter((id) => visible.includes(id));
    const allPicked = visible.length > 0 && selected.length === visible.length;
    const matchAll = everything && allPicked;
    const chosen = matchAll ? products.total : selected.length;
    const toggle = (id: number) => {
        setEverything(false);
        setPicked(
            selected.includes(id)
                ? selected.filter((other) => other !== id)
                : [...selected, id],
        );
    };
    const emptyStock = matchAll
        ? 0
        : products.data.filter(
              (product) =>
                  selected.includes(product.id) &&
                  !product.is_active &&
                  !product.variants.some(
                      (variant) => variant.is_active && variant.stock > 0,
                  ),
          ).length;
    const bulk = (action: string, label: string) => {
        if (
            matchAll &&
            !window.confirm(
                label + ' tất cả ' + number(chosen) + ' sản phẩm khớp bộ lọc?',
            )
        )
            return;
        const scope = {
            q: filters.q,
            status: filters.status,
            stock: filters.stock,
            brand: filters.brand,
            style: filters.style,
        };
        router.post(
            '/admin/products/bulk',
            matchAll ? { ...scope, all: 1, action } : { ids: selected, action },
            {
                preserveScroll: true,
                onStart: () => {
                    setBusy(action);
                    setBulkError(null);
                },
                onSuccess: () => {
                    if (matchAll) {
                        setPicked([]);
                        setEverything(false);
                    }
                },
                onError: (errors) =>
                    setBulkError(Object.values(errors)[0] ?? null),
                onFinish: () => setBusy(null),
            },
        );
    };
    const bulkActions = [
        { action: 'publish', label: 'Mở bán', icon: Eye },
        { action: 'hide', label: 'Ẩn', icon: EyeOff },
        { action: 'feature', label: 'Đánh dấu nổi bật', icon: Star },
        { action: 'unfeature', label: 'Bỏ nổi bật', icon: StarOff },
    ];
    const statusTab = (status: string, label: string, count: number) => ({
        href: query('/admin/products', { ...filters, status }),
        label,
        count,
        current: filters.status === status,
    });

    return (
        <>
            <Head title="Sản phẩm" />
            <PageHeader
                title="Sản phẩm"
                description="Bấm vào giá hoặc tồn kho để sửa ngay trong danh sách. Sản phẩm ẩn không hiện ở cửa hàng."
                actions={
                    <>
                        <Link
                            className="admin-button admin-button-secondary"
                            href="/admin/imports"
                        >
                            Nhập từ file
                        </Link>
                        <Link
                            className="admin-button"
                            href="/admin/products/create"
                        >
                            Thêm sản phẩm
                        </Link>
                    </>
                }
            />

            <Tabs
                label="Lọc theo trạng thái"
                items={[
                    statusTab('', 'Tất cả', counts.all),
                    statusTab('active', 'Đang bán', counts.active),
                    statusTab('hidden', 'Đang ẩn', counts.hidden),
                    statusTab('demo', 'Dữ liệu mẫu', counts.demo),
                ]}
            />

            <form className="admin-filters" onSubmit={submit} role="search">
                <label className="admin-search">
                    Tìm sản phẩm
                    <span className="admin-search-box">
                        <Search aria-hidden="true" />
                        <input
                            type="search"
                            maxLength={100}
                            value={q}
                            onChange={(event) => onType(event.target.value)}
                            placeholder="Tên vợt hoặc SKU"
                        />
                    </span>
                </label>
                <label>
                    Tồn kho
                    <select
                        value={filters.stock}
                        onChange={(event) =>
                            visit({ stock: event.target.value })
                        }
                    >
                        <option value="">Tất cả</option>
                        <option value="in">Còn hàng</option>
                        <option value="low">Sắp hết (1–5)</option>
                        <option value="out">Hết hàng</option>
                    </select>
                </label>
                <label>
                    Hãng
                    <select
                        value={filters.brand}
                        onChange={(event) =>
                            visit({ brand: event.target.value })
                        }
                    >
                        <option value="">Tất cả hãng</option>
                        {brands.map((brand) => (
                            <option key={brand.id} value={String(brand.id)}>
                                {brand.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Lối chơi
                    <select
                        value={filters.style}
                        onChange={(event) =>
                            visit({ style: event.target.value })
                        }
                    >
                        <option value="">Tất cả</option>
                        {Object.entries(styles).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Sắp xếp
                    <select
                        value={filters.sort}
                        onChange={(event) =>
                            visit({ sort: event.target.value })
                        }
                    >
                        <option value="newest">Mới thêm</option>
                        <option value="name">Tên A–Z</option>
                        <option value="price_asc">Giá tăng dần</option>
                        <option value="price_desc">Giá giảm dần</option>
                    </select>
                </label>
                {(filtered || filters.sort !== 'newest') && (
                    <div className="admin-filter-actions">
                        <button
                            type="button"
                            className="admin-button-ghost"
                            onClick={() => {
                                setQ('');
                                visit({
                                    q: '',
                                    stock: '',
                                    brand: '',
                                    style: '',
                                    sort: 'newest',
                                });
                            }}
                        >
                            Xóa lọc
                        </button>
                    </div>
                )}
            </form>

            {selected.length > 0 && (
                <div
                    className="admin-bulk"
                    role="region"
                    aria-label="Thao tác hàng loạt"
                >
                    <strong>
                        {matchAll
                            ? 'Đã chọn tất cả ' +
                              number(chosen) +
                              ' sản phẩm khớp bộ lọc'
                            : 'Đã chọn ' + number(chosen) + ' sản phẩm'}
                    </strong>
                    <div className="admin-bulk-actions">
                        {bulkActions.map(({ action, label, icon: Icon }) => (
                            <button
                                key={action}
                                type="button"
                                className="admin-button-secondary admin-button-small"
                                disabled={busy !== null}
                                data-busy={busy === action}
                                onClick={() => bulk(action, label)}
                            >
                                <Icon aria-hidden="true" />
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            className="admin-button-ghost admin-button-small"
                            onClick={() => {
                                setPicked([]);
                                setEverything(false);
                            }}
                        >
                            Bỏ chọn
                        </button>
                    </div>
                    {allPicked && products.total > visible.length && (
                        <p className="admin-bulk-note">
                            {matchAll ? (
                                <>
                                    Thao tác sẽ áp dụng cho cả những trang khác.{' '}
                                    <button
                                        type="button"
                                        className="admin-link-button"
                                        onClick={() => setEverything(false)}
                                    >
                                        Chỉ chọn {visible.length} sản phẩm trong
                                        trang này
                                    </button>
                                </>
                            ) : (
                                <>
                                    Đã chọn cả {visible.length} sản phẩm trong
                                    trang này.{' '}
                                    <button
                                        type="button"
                                        className="admin-link-button"
                                        onClick={() => setEverything(true)}
                                    >
                                        Chọn tất cả {number(products.total)} sản
                                        phẩm khớp bộ lọc
                                    </button>
                                </>
                            )}
                        </p>
                    )}
                    {(bulkError || emptyStock > 0) && (
                        <p
                            className="admin-bulk-note"
                            role={bulkError ? 'alert' : undefined}
                        >
                            {bulkError ??
                                emptyStock +
                                    ' sản phẩm đã chọn chưa có tồn kho: mở bán thì cửa hàng sẽ hiện “Hết hàng”.'}
                        </p>
                    )}
                </div>
            )}

            {products.data.length ? (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Danh sách sản phẩm"
                    tabIndex={0}
                    data-loading={loading}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col" className="admin-select">
                                    <label>
                                        <input
                                            type="checkbox"
                                            aria-label="Chọn tất cả sản phẩm trong trang"
                                            checked={allPicked}
                                            ref={(input) => {
                                                if (input)
                                                    input.indeterminate =
                                                        selected.length > 0 &&
                                                        !allPicked;
                                            }}
                                            onChange={() => {
                                                setEverything(false);
                                                setPicked(
                                                    allPicked ? [] : visible,
                                                );
                                            }}
                                        />
                                    </label>
                                </th>
                                <th scope="col">Sản phẩm</th>
                                <th scope="col">Hãng · lối chơi</th>
                                <th scope="col">Trạng thái</th>
                                <th scope="col" className="admin-number">
                                    Giá từ
                                </th>
                                <th scope="col" className="admin-number">
                                    Tồn kho
                                </th>
                                <th scope="col">
                                    <span className="sr-only">Thao tác</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.data.map((product) => {
                                const prices = product.variants.map(
                                    (variant) => variant.price,
                                );
                                const edit =
                                    '/admin/products/' + product.id + '/edit';
                                const open = editing === product.id;
                                const quick = () => {
                                    setSaved(null);
                                    setEditing(open ? null : product.id);
                                };
                                return [
                                    <tr
                                        key={product.id}
                                        data-selected={selected.includes(
                                            product.id,
                                        )}
                                        data-editing={open}
                                    >
                                        <td className="admin-select">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    aria-label={
                                                        'Chọn ' + product.name
                                                    }
                                                    checked={selected.includes(
                                                        product.id,
                                                    )}
                                                    onChange={() =>
                                                        toggle(product.id)
                                                    }
                                                />
                                            </label>
                                        </td>
                                        <th scope="row">
                                            <div className="admin-cell-product">
                                                <span className="admin-thumb">
                                                    <img
                                                        src={product.image_url}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        width="46"
                                                        height="46"
                                                    />
                                                </span>
                                                <span>
                                                    <Link href={edit}>
                                                        {product.name}
                                                    </Link>
                                                    <small>
                                                        {product.variants
                                                            .length === 1
                                                            ? 'SKU ' +
                                                              product
                                                                  .variants[0]
                                                                  .sku
                                                            : product.variants
                                                                  .length +
                                                              ' phiên bản'}
                                                        {product.is_featured &&
                                                            ' · Nổi bật'}
                                                    </small>
                                                </span>
                                            </div>
                                        </th>
                                        <td>
                                            {product.brand ?? 'Chưa có hãng'}
                                            <small>
                                                {styles[product.play_style] ??
                                                    product.play_style}
                                            </small>
                                        </td>
                                        <td>
                                            <ProductStatus product={product} />
                                        </td>
                                        <td className="admin-number">
                                            <button
                                                type="button"
                                                className="admin-cell-button"
                                                aria-expanded={open}
                                                aria-label={
                                                    'Sửa nhanh giá ' +
                                                    product.name
                                                }
                                                onClick={quick}
                                            >
                                                {prices.length
                                                    ? money(Math.min(...prices))
                                                    : '—'}
                                            </button>
                                        </td>
                                        <td className="admin-number">
                                            <button
                                                type="button"
                                                className="admin-cell-button"
                                                aria-expanded={open}
                                                aria-label={
                                                    'Sửa nhanh tồn kho ' +
                                                    product.name
                                                }
                                                onClick={quick}
                                            >
                                                {saved === product.id ? (
                                                    <span className="admin-saved">
                                                        <Check aria-hidden="true" />
                                                        Đã lưu
                                                    </span>
                                                ) : (
                                                    <Stock
                                                        variants={
                                                            product.variants
                                                        }
                                                        onSale={
                                                            product.is_active
                                                        }
                                                    />
                                                )}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="admin-row-actions">
                                                <Link href={edit}>
                                                    <Pencil aria-hidden="true" />
                                                    Sửa
                                                </Link>
                                                {product.is_active && (
                                                    <a
                                                        href={
                                                            '/products/' +
                                                            product.slug
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label={
                                                            'Xem ' +
                                                            product.name +
                                                            ' ở cửa hàng (tab mới)'
                                                        }
                                                    >
                                                        <ExternalLink aria-hidden="true" />
                                                        Xem
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>,
                                    open && (
                                        <QuickEdit
                                            key={'quick-' + product.id}
                                            product={product}
                                            onClose={() => setEditing(null)}
                                            onSaved={() => {
                                                setEditing(null);
                                                setSaved(product.id);
                                            }}
                                        />
                                    ),
                                ];
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-empty">
                    {filtered || filters.status ? (
                        <>
                            <strong>Không có sản phẩm khớp bộ lọc.</strong>
                            Bỏ bớt điều kiện hoặc tìm bằng SKU.
                        </>
                    ) : (
                        <>
                            <strong>Chưa có sản phẩm.</strong>
                            <p>
                                Thêm từng sản phẩm, hoặc nhập cả danh mục từ
                                file CSV (xuất từ Excel).
                            </p>
                            <Link
                                className="admin-button"
                                href="/admin/imports"
                            >
                                Nhập từ file
                            </Link>
                        </>
                    )}
                </div>
            )}
            <Pages page={products} noun="sản phẩm" />
        </>
    );
}
