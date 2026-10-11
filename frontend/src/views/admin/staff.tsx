'use client';

import { Head, useForm } from '@/lib/page';
import { Fragment, type FormEvent } from 'react';
import { date, Errors, Field, PageHeader, staffRoles } from './shared';

type Role = 'admin' | 'staff' | 'support';
/** A staff account (App\Services\StaffService::all). */
type Member = {
    id: number;
    name: string;
    email: string;
    role: Role;
    verified: boolean;
    /** Signing in asks for a second step. */
    two_factor: boolean;
    joined: string | null;
};

/** What each role may open, in the words of the menu. */
const roles: { key: Role; may: string }[] = [
    {
        key: 'admin',
        may: 'Toàn bộ trang quản trị, gồm Cài đặt (phí giao, tài khoản ngân hàng nhận tiền, email tự động), Báo cáo, xuất đơn ra CSV và trang Nhân viên này.',
    },
    {
        key: 'staff',
        may: 'Việc hằng ngày: đơn hàng và xác nhận chuyển khoản, đan dây, sản phẩm và kho, nhập hàng, khách hàng, mã giảm giá, đánh giá, nhật ký email, chat hỗ trợ. Không mở được Cài đặt, Báo cáo, xuất CSV và trang Nhân viên.',
    },
    {
        key: 'support',
        may: 'Chỉ Chat hỗ trợ: nhận ticket và trả lời khách.',
    },
];

function RoleSelect({
    id,
    value,
    disabled,
    onChange,
}: {
    id: string;
    value: Role;
    disabled?: boolean;
    onChange: (role: Role) => void;
}) {
    return (
        <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as Role)}
        >
            {roles.map(({ key }) => (
                <option key={key} value={key}>
                    {staffRoles[key]}
                </option>
            ))}
        </select>
    );
}

/** One member of staff: their role can be changed, or their access taken away. */
function Row({ member, mine }: { member: Member; mine: boolean }) {
    const form = useForm({ role: member.role });
    const removal = useForm({});
    const url = '/admin/staff/' + member.id;
    const busy = form.processing || removal.processing;
    return (
        <tr>
            <th scope="row">
                {member.name}
                {mine && <span className="admin-badge">Bạn</span>}
                <small>{member.email}</small>
            </th>
            <td>
                <form
                    className="admin-toolbar admin-staff-role"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.patch(url, { preserveScroll: true });
                    }}
                >
                    <label className="sr-only" htmlFor={'role-' + member.id}>
                        Vai trò của {member.name}
                    </label>
                    <RoleSelect
                        id={'role-' + member.id}
                        value={form.data.role}
                        disabled={mine || busy}
                        onChange={(role) => form.setData('role', role)}
                    />
                    {!mine && (
                        <button
                            className="admin-button-secondary"
                            disabled={busy || !form.isDirty}
                            data-busy={form.processing}
                        >
                            {form.processing ? 'Đang lưu…' : 'Lưu vai trò'}
                        </button>
                    )}
                </form>
                <Errors errors={{ ...form.errors, ...removal.errors }} />
            </td>
            <td>
                {member.two_factor ? (
                    <span className="admin-badge" data-tone="success">
                        Đã bật 2 lớp
                    </span>
                ) : (
                    <span className="admin-badge" data-tone="warning">
                        Chưa bật 2 lớp
                    </span>
                )}
            </td>
            <td>{date(member.joined)}</td>
            <td className="admin-number">
                {mine ? (
                    <small className="admin-muted">
                        Không tự đổi quyền của mình
                    </small>
                ) : (
                    <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={busy}
                        data-busy={removal.processing}
                        onClick={() => {
                            if (
                                window.confirm(
                                    'Gỡ quyền nhân viên của ' +
                                        member.name +
                                        '? Tài khoản trở lại là tài khoản khách hàng; ticket họ đang nhận được trả về hộp thư.',
                                )
                            )
                                removal.delete(url, { preserveScroll: true });
                        }}
                    >
                        {removal.processing ? 'Đang gỡ…' : 'Gỡ quyền'}
                    </button>
                )}
            </td>
        </tr>
    );
}

export default function Staff({
    staff,
    me,
}: {
    staff: Member[];
    /** The signed-in admin: their own row cannot be changed by them. */
    me: number;
}) {
    const form = useForm<{ email: string; role: Role }>({
        email: '',
        role: 'staff',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/admin/staff', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title="Nhân viên" />
            <PageHeader
                title="Nhân viên"
                description="Ai được vào trang quản trị và được làm gì. Người được thêm phải tự đăng ký tài khoản và xác minh email trước; cửa hàng không tạo tài khoản hay mật khẩu thay họ."
            />

            <section className="admin-panel" aria-labelledby="add-title">
                <h2 id="add-title">Thêm nhân viên</h2>
                <Errors errors={form.errors} />
                <form onSubmit={submit}>
                    <div className="admin-form-grid">
                        <Field
                            name="email"
                            label="Email của tài khoản"
                            error={form.errors.email}
                        >
                            <input
                                id="email"
                                type="email"
                                autoComplete="off"
                                required
                                maxLength={255}
                                placeholder="nhanvien@example.com"
                                value={form.data.email}
                                onChange={(event) =>
                                    form.setData('email', event.target.value)
                                }
                                aria-invalid={!!form.errors.email}
                            />
                        </Field>
                        <Field
                            name="role"
                            label="Vai trò"
                            error={form.errors.role}
                        >
                            <RoleSelect
                                id="role"
                                value={form.data.role}
                                onChange={(role) => form.setData('role', role)}
                            />
                        </Field>
                    </div>
                    <div className="admin-string-actions">
                        <button
                            type="submit"
                            className="admin-button"
                            disabled={form.processing}
                            data-busy={form.processing}
                        >
                            {form.processing ? 'Đang thêm…' : 'Thêm nhân viên'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="admin-panel" aria-labelledby="roles-title">
                <h2 id="roles-title">Ba vai trò</h2>
                <dl className="admin-detail-list">
                    {roles.map(({ key, may }) => (
                        <Fragment key={key}>
                            <dt>{staffRoles[key]}</dt>
                            <dd>{may}</dd>
                        </Fragment>
                    ))}
                </dl>
            </section>

            <h2 className="admin-list-title">
                Nhân viên hiện có ({staff.length})
            </h2>
            <div
                className="admin-table-wrap"
                role="region"
                aria-label="Danh sách nhân viên"
                tabIndex={0}
            >
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Nhân viên</th>
                            <th scope="col">Vai trò</th>
                            <th scope="col">Đăng nhập</th>
                            <th scope="col">Tài khoản từ</th>
                            <th scope="col" className="admin-number">
                                Quyền
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map((member) => (
                            // A saved role comes back as new props: the row starts over from it.
                            <Row
                                key={member.id + ':' + member.role}
                                member={member}
                                mine={member.id === me}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="admin-footnote admin-muted">
                Cửa hàng luôn phải còn ít nhất một quản trị viên. Nên bật xác
                thực hai lớp cho mọi tài khoản nhân viên (mỗi người tự bật ở Tài
                khoản của tôi → Bảo mật).
            </p>
        </>
    );
}
