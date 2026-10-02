import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Errors, Field } from './shared';

// Illustrative formats only; the shop fills in its own goods.
const guide: [string, string, string, string][] = [
    [
        'ten_san_pham',
        'Có',
        'Vợt Tia Chớp 300',
        'Các dòng cùng tên là một sản phẩm; mỗi dòng là một phiên bản.',
    ],
    [
        'sku',
        'Có',
        'TC300-4U-G5',
        'Mã hàng duy nhất. Nhập lại cùng SKU sẽ cập nhật, không tạo trùng.',
    ],
    ['gia', 'Có', '1.290.000', 'Giá bán bằng đồng, không có số lẻ.'],
    [
        'gia_nhap',
        'Không',
        '950.000',
        'Giá shop nhập vào, chỉ admin thấy; dùng để tính lãi gộp. Để trống thì giữ giá nhập đang lưu.',
    ],
    ['ton_kho', 'Có', '12', 'Số lượng shop đang có.'],
    [
        'ten_phien_ban',
        'Không',
        '4U / G5',
        'Để trống nếu sản phẩm chỉ có một phiên bản.',
    ],
    ['hang', 'Không', 'Tên hãng', 'Chưa có thì tự tạo hãng mới.'],
    ['danh_muc', 'Không', 'Vợt cầu lông', 'Chưa có thì tự tạo danh mục mới.'],
    ['mo_ta', 'Sản phẩm mới', 'Do shop viết', 'Mô tả hiển thị trên trang.'],
    [
        'loi_choi',
        'Sản phẩm mới',
        'tấn công',
        'tấn công, tốc độ hoặc cân bằng. Dùng cho bộ lọc và gợi ý.',
    ],
    [
        'trinh_do',
        'Không',
        'trung bình',
        'mới chơi, trung bình, nâng cao, mọi trình độ.',
    ],
    [
        'trong_luong · diem_can_bang · do_cung · chat_lieu · suc_cang_toi_da',
        'Không',
        '4U · Nặng đầu · Cứng · Carbon · 28 lbs',
        'Thông số theo hãng công bố.',
    ],
    ['anh', 'Không', 'tc300.jpg', 'Tên ảnh trong tệp ZIP gửi kèm.'],
    [
        'duong_dan',
        'Không',
        'vot-tia-chop-300',
        'Để trống thì tạo từ tên sản phẩm.',
    ],
    ['dang_ban', 'Không', 'có', 'Ghi “không” để ẩn phiên bản đó.'],
];

const megabytes = (bytes: number) =>
    (bytes / 1024 / 1024).toLocaleString('vi-VN', {
        maximumFractionDigits: 1,
    }) + ' MB';

export default function Import({
    demoActive,
    hidden,
    stockedHidden,
    uploadLimit,
}: {
    columns: string[];
    demoActive: number;
    hidden: number;
    stockedHidden: number;
    uploadLimit: number;
}) {
    const form = useForm<{
        catalog: File | null;
        images: File | null;
        update_stock: boolean;
        publish: boolean;
    }>({ catalog: null, images: null, update_stock: true, publish: false });
    const [confirmDemo, setConfirmDemo] = useState(false);
    const tooLarge = (form.data.images?.size ?? 0) > uploadLimit;

    return (
        <>
            <Head title="Nhập hàng từ file" />
            <div className="admin-heading">
                <h1>Nhập hàng từ file</h1>
                <a
                    className="admin-button admin-button-secondary"
                    href="/admin/imports/template"
                >
                    Tải file mẫu
                </a>
            </div>
            <p className="admin-lead">
                Dùng file CSV xuất từ Excel, phần mềm bán hàng hoặc bảng giá nhà
                phân phối, mỗi dòng một SKU. Bạn sẽ xem trước mọi thay đổi trước
                khi nhập. Sản phẩm mới mặc định đang ẩn để kiểm tra.
            </p>
            <p className="admin-rights">
                Chỉ nhập hàng, giá, tồn kho và ảnh shop có quyền dùng: hàng thật
                của shop, ảnh tự chụp hoặc được nhà phân phối cho phép. Không
                sao chép dữ liệu từ website cửa hàng khác.
            </p>

            <form
                className="admin-form-section"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!tooLarge) form.post('/admin/imports');
                }}
            >
                <h2>Chọn file</h2>
                <Errors errors={form.errors} />
                <div className="admin-form-grid">
                    <Field
                        name="catalog"
                        label="File sản phẩm (.csv, UTF-8)"
                        error={form.errors.catalog}
                    >
                        <input
                            id="catalog"
                            type="file"
                            accept=".csv,text/csv"
                            required
                            aria-invalid={!!form.errors.catalog}
                            onChange={(event) =>
                                form.setData(
                                    'catalog',
                                    event.target.files?.[0] ?? null,
                                )
                            }
                        />
                        <small>
                            Trong Excel: Lưu thành → CSV UTF-8. Tối đa 2 MB,{' '}
                            2.000 dòng.
                        </small>
                    </Field>
                    <Field
                        name="images"
                        label="Ảnh sản phẩm (.zip, không bắt buộc)"
                        error={
                            form.errors.images ??
                            (tooLarge
                                ? 'Tệp ZIP lớn hơn giới hạn ' +
                                  megabytes(uploadLimit) +
                                  ' của máy chủ. Chia nhỏ hoặc dùng lệnh shop:import-catalog.'
                                : undefined)
                        }
                    >
                        <input
                            id="images"
                            type="file"
                            accept=".zip,application/zip"
                            aria-invalid={!!form.errors.images || tooLarge}
                            onChange={(event) =>
                                form.setData(
                                    'images',
                                    event.target.files?.[0] ?? null,
                                )
                            }
                        />
                        <small>
                            JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB. Giới hạn
                            tải lên hiện tại: {megabytes(uploadLimit)}.
                        </small>
                    </Field>
                </div>
                <div className="admin-checks">
                    <label>
                        <input
                            type="checkbox"
                            checked={form.data.update_stock}
                            onChange={(event) =>
                                form.setData(
                                    'update_stock',
                                    event.target.checked,
                                )
                            }
                        />
                        Cập nhật tồn kho của SKU đã có theo file
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={form.data.publish}
                            onChange={(event) =>
                                form.setData('publish', event.target.checked)
                            }
                        />
                        Mở bán ngay sản phẩm mới
                    </label>
                </div>
                <div className="admin-form-actions">
                    <button disabled={form.processing || tooLarge}>
                        {form.processing ? 'Đang đọc file…' : 'Kiểm tra file'}
                    </button>
                </div>
            </form>

            {hidden > 0 && (
                <section className="admin-form-section admin-demo-box">
                    <h2>Sản phẩm đang ẩn</h2>
                    <p>
                        Có {hidden} sản phẩm thật đang ẩn, trong đó{' '}
                        {stockedHidden} sản phẩm đã có tồn kho. Chỉ sản phẩm có
                        số lượng thật mới được mở bán hàng loạt; nhập tồn kho
                        bằng file (cột <code>ton_kho</code>, khớp theo SKU) hoặc
                        sửa từng sản phẩm.
                    </p>
                    <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={stockedHidden === 0}
                        onClick={() =>
                            router.post(
                                '/admin/imports/publish-stocked',
                                {},
                                { preserveScroll: true },
                            )
                        }
                    >
                        Mở bán {stockedHidden} sản phẩm có tồn kho
                    </button>
                </section>
            )}

            {demoActive > 0 && (
                <section className="admin-form-section admin-demo-box">
                    <h2>Sản phẩm demo</h2>
                    <p>
                        Cửa hàng đang hiển thị {demoActive} sản phẩm demo. Ẩn
                        chúng khi hàng thật đã sẵn sàng; đơn demo cũ vẫn được
                        giữ.
                    </p>
                    {confirmDemo ? (
                        <div className="admin-form-actions">
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        '/admin/imports/retire-demo',
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                Xác nhận ẩn {demoActive} sản phẩm demo
                            </button>
                            <button
                                type="button"
                                className="admin-button-secondary"
                                onClick={() => setConfirmDemo(false)}
                            >
                                Không ẩn
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="admin-button-secondary"
                            onClick={() => setConfirmDemo(true)}
                        >
                            Ẩn sản phẩm demo
                        </button>
                    )}
                </section>
            )}

            <section className="admin-taxonomies">
                <h2>Các cột trong file</h2>
                <p className="admin-muted">
                    Tiêu đề cột có thể viết có dấu (ví dụ “Tên sản phẩm”, “Giá
                    bán”, “Tồn kho”). Cột không có trong danh sách sẽ được bỏ
                    qua.
                </p>
                <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label="Hướng dẫn các cột"
                    tabIndex={0}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Cột</th>
                                <th scope="col">Bắt buộc</th>
                                <th scope="col">Ví dụ định dạng</th>
                                <th scope="col">Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {guide.map(([column, required, example, note]) => (
                                <tr key={column}>
                                    <th scope="row">
                                        <code>{column}</code>
                                    </th>
                                    <td>{required}</td>
                                    <td>{example}</td>
                                    <td>{note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
