import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Errors, money } from './shared';

type Issue = { line: number | null; message: string };
type Current = {
    id: number;
    name: string;
    price: number;
    stock: number;
    is_active: boolean;
};
type PlannedVariant = {
    line: number;
    sku: string;
    name: string;
    price: number;
    stock: number;
    is_active: boolean;
    current: Current | null;
    action: Action;
};
type PlannedProduct = {
    line: number;
    slug: string;
    name: string;
    brand: string | null;
    category: string | null;
    is_active: boolean;
    action: Action;
    variants: PlannedVariant[];
};
type Action = 'create' | 'update' | 'unchanged';
type Plan = {
    summary: {
        rows: number;
        products_new: number;
        products_updated: number;
        variants_new: number;
        variants_updated: number;
        brands_new: string[];
        categories_new: string[];
        images: number;
    };
    products: PlannedProduct[];
    errors: Issue[];
    warnings: Issue[];
    fingerprint: string;
};

const actions: Record<Action, string> = {
    create: 'Mới',
    update: 'Cập nhật',
    unchanged: 'Không đổi',
};

function Change({
    before,
    after,
    format = String,
}: {
    before: number | undefined;
    after: number;
    format?: (value: number) => string;
}) {
    return before === undefined || before === after ? (
        <>{format(after)}</>
    ) : (
        <>
            <del>{format(before)}</del> → <strong>{format(after)}</strong>
        </>
    );
}

function Issues({ issues }: { issues: Issue[] }) {
    return (
        <ul className="admin-issues">
            {issues.map((issue, index) => (
                <li key={index}>
                    {issue.line ? <span>Dòng {issue.line}</span> : null}
                    {issue.message}
                </li>
            ))}
        </ul>
    );
}

export default function ImportPreview({
    import: id,
    fileName,
    options,
    plan,
}: {
    import: string;
    fileName: string;
    options: { publish: boolean; update_stock: boolean };
    plan: Plan;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const form = useForm({ fingerprint: plan.fingerprint });
    const { summary } = plan;
    const changes =
        summary.products_new +
        summary.products_updated +
        summary.variants_new +
        summary.variants_updated;
    const blocked = plan.errors.length > 0;

    return (
        <>
            <Head title="Kiểm tra trước khi nhập" />
            <div className="admin-heading">
                <div>
                    <Link className="admin-back" href="/admin/imports">
                        ← Chọn file khác
                    </Link>
                    <h1>Kiểm tra trước khi nhập</h1>
                    <p className="admin-muted">
                        {fileName} · {summary.rows} dòng ·{' '}
                        {options.update_stock
                            ? 'cập nhật tồn kho SKU đã có'
                            : 'giữ tồn kho SKU đã có'}{' '}
                        ·{' '}
                        {options.publish
                            ? 'mở bán ngay sản phẩm mới'
                            : 'sản phẩm mới đang ẩn'}
                    </p>
                </div>
            </div>
            <Errors errors={errors} />

            <dl className="admin-stats admin-import-stats">
                <div>
                    <dt>Sản phẩm mới</dt>
                    <dd>{summary.products_new}</dd>
                </div>
                <div>
                    <dt>Sản phẩm cập nhật</dt>
                    <dd>{summary.products_updated}</dd>
                </div>
                <div>
                    <dt>SKU mới</dt>
                    <dd>{summary.variants_new}</dd>
                </div>
                <div>
                    <dt>SKU cập nhật</dt>
                    <dd>{summary.variants_updated}</dd>
                </div>
                <div>
                    <dt>Ảnh</dt>
                    <dd>{summary.images}</dd>
                </div>
            </dl>
            {(summary.brands_new.length > 0 ||
                summary.categories_new.length > 0) && (
                <p className="admin-muted">
                    {summary.brands_new.length > 0 &&
                        'Hãng mới: ' + summary.brands_new.join(', ') + '. '}
                    {summary.categories_new.length > 0 &&
                        'Danh mục mới: ' +
                            summary.categories_new.join(', ') +
                            '.'}
                </p>
            )}

            {blocked && (
                <section className="admin-error-summary" role="alert">
                    <strong>
                        Còn {plan.errors.length} lỗi, chưa thể nhập. Sửa file
                        rồi tải lên lại.
                    </strong>
                    <Issues issues={plan.errors} />
                </section>
            )}
            {plan.warnings.length > 0 && (
                <section className="admin-notice">
                    <strong>Lưu ý</strong>
                    <Issues issues={plan.warnings} />
                </section>
            )}

            {plan.products.length > 0 && (
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Thay đổi sẽ nhập"
                    tabIndex={0}
                >
                    <table className="admin-import-table">
                        <thead>
                            <tr>
                                <th scope="col">Sản phẩm / SKU</th>
                                <th scope="col">Thay đổi</th>
                                <th scope="col" className="admin-number">
                                    Giá
                                </th>
                                <th scope="col" className="admin-number">
                                    Tồn kho
                                </th>
                            </tr>
                        </thead>
                        {plan.products.map((product) => (
                            <tbody key={product.slug}>
                                <tr className="admin-import-product">
                                    <th scope="row">
                                        {product.name}
                                        <small>
                                            {[
                                                product.brand ?? 'Chưa có hãng',
                                                product.category ??
                                                    'Chưa phân loại',
                                                product.is_active
                                                    ? 'Đang bán'
                                                    : 'Ẩn',
                                            ].join(' · ')}
                                        </small>
                                    </th>
                                    <td>
                                        <span
                                            className="admin-badge"
                                            data-action={product.action}
                                        >
                                            {actions[product.action]}
                                        </span>
                                    </td>
                                    <td colSpan={2} />
                                </tr>
                                {product.variants.map((variant) => (
                                    <tr key={variant.sku}>
                                        <td>
                                            <code>{variant.sku}</code>
                                            <small>
                                                {variant.name}
                                                {variant.is_active
                                                    ? ''
                                                    : ' · ẩn'}
                                            </small>
                                        </td>
                                        <td>
                                            <span
                                                className="admin-badge"
                                                data-action={variant.action}
                                            >
                                                {actions[variant.action]}
                                            </span>
                                        </td>
                                        <td className="admin-number">
                                            <Change
                                                before={variant.current?.price}
                                                after={variant.price}
                                                format={money}
                                            />
                                        </td>
                                        <td className="admin-number">
                                            <Change
                                                before={variant.current?.stock}
                                                after={variant.stock}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                    </table>
                </div>
            )}

            <form
                className="admin-form-actions"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/admin/imports/' + id);
                }}
            >
                <Link
                    className="admin-button admin-button-secondary"
                    href="/admin/imports"
                >
                    Chọn file khác
                </Link>
                <button disabled={blocked || changes === 0 || form.processing}>
                    {form.processing
                        ? 'Đang nhập…'
                        : changes === 0
                          ? 'Không có gì thay đổi'
                          : 'Nhập vào cửa hàng'}
                </button>
            </form>
        </>
    );
}
