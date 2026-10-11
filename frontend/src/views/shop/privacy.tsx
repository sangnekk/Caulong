'use client';

import { CLARITY_ID } from '@/lib/analytics';
import { Head, Link } from '@/lib/page';

type Policy = {
    shop: string;
    /** The day the wording last changed, as YYYY-MM-DD. */
    updated: string;
    contact: { hotline: string; email: string; address: string };
    /** How long each kind of record is kept, in days: what the clean-up jobs go by. */
    keep: {
        events: number;
        emails: number;
        guest_chats: number;
        order_link: number;
        chat_code: number;
    };
    /** Said only while the shop does it. */
    bank_transfer: boolean;
    stringing: boolean;
    email_provider: string | null;
    session_ip: boolean;
};

/**
 * What the shop keeps about its customers. Every sentence here describes something the code
 * does: when that changes, change the sentence and the date in config/shop.php (privacy.updated).
 */
export default function Privacy({
    published,
    policy,
}: {
    /** Off: a draft only admins can open, until the owner publishes it in the settings. */
    published: boolean;
    policy: Policy;
}) {
    const { keep, contact } = policy;
    const [year, month, day] = policy.updated.split('-');
    const orders = policy.stringing
        ? 'Đơn hàng và yêu cầu đan dây'
        : 'Đơn hàng';
    return (
        <>
            <Head title="Chính sách quyền riêng tư" />
            {!published && (
                <p className="store-notice store-policy-draft" role="status">
                    <strong>Bản nháp.</strong> Chỉ quản trị viên mở được trang
                    này. Đọc lại nội dung, rồi bật “Công bố chính sách quyền
                    riêng tư” trong <Link href="/admin/settings">Cài đặt</Link>{' '}
                    để khách hàng thấy.
                </p>
            )}
            <header className="store-page-heading">
                <div>
                    <h1>Chính sách quyền riêng tư</h1>
                    <p>
                        Cập nhật ngày {day}/{month}/{year}
                    </p>
                </div>
            </header>
            <article className="store-policy">
                <p className="store-policy-lead">
                    {policy.shop} chỉ ghi lại những gì cần để bán hàng, giao
                    hàng và hỗ trợ bạn. Cửa hàng không bán, không cho thuê và
                    không chia sẻ dữ liệu khách hàng cho bên quảng cáo. Trang
                    này nói rõ cửa hàng lưu gì, dùng vào việc gì, giữ trong bao
                    lâu và bạn làm được gì với dữ liệu của mình.
                </p>

                <section aria-labelledby="privacy-what">
                    <h2 id="privacy-what">Cửa hàng ghi lại những gì</h2>
                    <dl>
                        <div>
                            <dt>Tài khoản</dt>
                            <dd>
                                Họ tên, email và mật khẩu. Mật khẩu chỉ được lưu
                                ở dạng đã băm: nhân viên cửa hàng không đọc
                                được. Nếu bạn bật xác thực hai lớp hoặc passkey,
                                cửa hàng lưu thêm khóa bảo mật tương ứng.
                            </dd>
                        </div>
                        <div>
                            <dt>Đơn hàng</dt>
                            <dd>
                                Họ tên, số điện thoại, địa chỉ giao hàng, email
                                (nếu bạn nhập), ghi chú, các sản phẩm đã mua và
                                số tiền.
                            </dd>
                        </div>
                        <div>
                            <dt>Thanh toán</dt>
                            <dd>
                                {policy.bank_transfer
                                    ? 'Khi bạn chuyển khoản, việc trả tiền diễn ra trong ứng dụng ngân hàng của bạn. Cửa hàng chỉ ghi số tiền, thời điểm nhận và mã giao dịch dùng để đối chiếu. Cửa hàng không lưu số thẻ hay thông tin đăng nhập ngân hàng.'
                                    : 'Cửa hàng thu tiền khi giao hàng và không lưu số thẻ hay thông tin ngân hàng của bạn.'}
                            </dd>
                        </div>
                        {policy.stringing && (
                            <div>
                                <dt>Yêu cầu đan dây</dt>
                                <dd>
                                    Họ tên, số điện thoại, email (nếu bạn nhập),
                                    cây vợt, loại dây, mức căng, ghi chú và giờ
                                    hẹn.
                                </dd>
                            </div>
                        )}
                        <div>
                            <dt>Trò chuyện hỗ trợ</dt>
                            <dd>
                                Tin nhắn bạn gửi và câu trả lời của cửa hàng.
                            </dd>
                        </div>
                        <div>
                            <dt>Đánh giá và sản phẩm đã lưu</dt>
                            <dd>
                                Sau khi được duyệt, số sao và nội dung đánh giá
                                hiện công khai trên trang sản phẩm, kèm tên gọi
                                của bạn (không kèm họ, email hay số điện thoại).
                                Danh sách sản phẩm đã lưu chỉ bạn và cửa hàng
                                thấy.
                            </dd>
                        </div>
                        <div>
                            <dt>Hoạt động trong cửa hàng</dt>
                            <dd>
                                Sản phẩm bạn xem, từ khóa bạn tìm, việc thêm
                                hoặc bớt sản phẩm trong giỏ, bắt đầu thanh toán,
                                mã giảm giá đã nhập, sản phẩm đã lưu và việc mở
                                khung trò chuyện. Khi bạn đã đăng nhập, những
                                việc này gắn với tài khoản của bạn. Khi chưa
                                đăng nhập, chúng gắn với một mã ngẫu nhiên của
                                lượt truy cập, không chứa thông tin cá nhân; nếu
                                bạn đăng nhập trong lượt đó, chúng được gắn vào
                                tài khoản.
                            </dd>
                        </div>
                        <div>
                            <dt>Email cửa hàng đã gửi</dt>
                            <dd>
                                Loại email, địa chỉ nhận, tiêu đề và email gửi
                                được hay bị lỗi. Nhật ký này không chứa nội dung
                                email.
                            </dd>
                        </div>
                        {policy.session_ip && (
                            <div>
                                <dt>Phiên truy cập</dt>
                                <dd>
                                    Địa chỉ IP và loại trình duyệt của phiên
                                    đang mở, để giữ bạn đăng nhập và giữ giỏ
                                    hàng. Địa chỉ IP cũng được dùng trong vài
                                    phút để chặn việc thử mật khẩu quá nhiều
                                    lần.
                                </dd>
                            </div>
                        )}
                    </dl>
                </section>

                <section aria-labelledby="privacy-why">
                    <h2 id="privacy-why">Dùng vào việc gì</h2>
                    <ul>
                        <li>Nhận đơn, giao hàng và liên hệ với bạn về đơn.</li>
                        <li>
                            Gửi email về đơn hàng và tài khoản: xác nhận đơn,
                            báo đơn đổi trạng thái, đặt lại mật khẩu.
                        </li>
                        <li>Trả lời khi bạn cần hỗ trợ.</li>
                        <li>
                            Xếp khách hàng vào nhóm (mới, đang mua, thân thiết,
                            lâu chưa quay lại) theo lịch sử mua và hoạt động, để
                            cửa hàng biết nên chăm sóc ai.
                        </li>
                        <li>
                            Thống kê bán hàng: sản phẩm nào được xem, được mua,
                            khách hay dừng lại ở bước nào.
                        </li>
                        <li>
                            Chặn lạm dụng, ví dụ thử mật khẩu nhiều lần liên
                            tiếp.
                        </li>
                    </ul>
                </section>

                <section aria-labelledby="privacy-email">
                    <h2 id="privacy-email">Email ưu đãi</h2>
                    <p>
                        Cửa hàng chỉ gửi email ưu đãi (mã giảm giá, nhắc giỏ
                        hàng, mời đánh giá) khi bạn đã đồng ý, lúc đăng ký hoặc
                        ở trang tài khoản. Bạn ngừng nhận bất cứ lúc nào: tắt ở{' '}
                        <Link href="/account">trang tài khoản</Link>, hoặc bấm
                        liên kết ở cuối mỗi email ưu đãi. Email về đơn hàng và
                        tài khoản vẫn được gửi, vì việc mua hàng cần đến chúng.
                    </p>
                </section>

                <section aria-labelledby="privacy-cookies">
                    <h2 id="privacy-cookies">Cookie và công cụ đo lường</h2>
                    <p>
                        Cửa hàng dùng các cookie cần cho việc mua hàng: cookie
                        phiên, để giữ bạn đăng nhập và giữ giỏ hàng, và cookie
                        chống giả mạo yêu cầu. Cửa hàng không dùng cookie quảng
                        cáo.
                    </p>
                    {CLARITY_ID ? (
                        <p>
                            Nếu bạn bấm “Đồng ý” ở lời hỏi trên trang, Microsoft
                            Clarity ghi lại cách bạn dùng cửa hàng: trang đã
                            xem, chỗ bấm, cuộn. Những gì bạn nhập (tên, địa chỉ,
                            mật khẩu, tin nhắn) không được ghi lại. Dữ liệu này
                            do Microsoft xử lý. Nếu bạn không đồng ý, Clarity
                            không được tải. Bạn đổi lựa chọn bất cứ lúc nào ở
                            cuối trang: khi đó cookie của Clarity bị xóa và bạn
                            được hỏi lại.
                        </p>
                    ) : (
                        <p>
                            Cửa hàng hiện không dùng công cụ của bên thứ ba để
                            ghi lại cách bạn dùng trang.
                        </p>
                    )}
                </section>

                <section aria-labelledby="privacy-who">
                    <h2 id="privacy-who">Ai xem được dữ liệu</h2>
                    <ul>
                        <li>
                            Nhân viên cửa hàng, theo việc của từng người: người
                            quản trị xem được tất cả; nhân viên bán hàng xem đơn
                            hàng và hồ sơ khách hàng; nhân viên hỗ trợ xem các
                            cuộc trò chuyện cùng thông tin tóm tắt của khách
                            đang trò chuyện.
                        </li>
                        <li>
                            Người giao hàng (nhân viên cửa hàng hoặc đơn vị vận
                            chuyển) nhận họ tên, số điện thoại và địa chỉ ghi
                            trên đơn.
                        </li>
                        {policy.email_provider && (
                            <li>
                                Dịch vụ gửi email {policy.email_provider} nhận
                                địa chỉ và nội dung email để chuyển tới bạn.
                            </li>
                        )}
                        {CLARITY_ID && (
                            <li>
                                Microsoft, với phần ghi lại cách dùng trang mà
                                bạn đã đồng ý.
                            </li>
                        )}
                        <li>
                            Cơ quan nhà nước có thẩm quyền, khi pháp luật yêu
                            cầu.
                        </li>
                    </ul>
                </section>

                <section aria-labelledby="privacy-keep">
                    <h2 id="privacy-keep">Giữ trong bao lâu</h2>
                    <dl>
                        <div>
                            <dt>Hoạt động trong cửa hàng</dt>
                            <dd>{keep.events} ngày, sau đó tự động xóa.</dd>
                        </div>
                        <div>
                            <dt>Nhật ký email</dt>
                            <dd>{keep.emails} ngày, sau đó tự động xóa.</dd>
                        </div>
                        <div>
                            <dt>Trò chuyện khi chưa đăng nhập</dt>
                            <dd>
                                Tự động xóa {keep.guest_chats} ngày sau khi cuộc
                                trò chuyện đóng. Mã để xem lại cuộc trò chuyện
                                dùng được trong {keep.chat_code} ngày.
                            </dd>
                        </div>
                        <div>
                            <dt>
                                Trò chuyện khi đã đăng nhập, đánh giá, sản phẩm
                                đã lưu
                            </dt>
                            <dd>
                                Giữ cùng tài khoản, tới khi bạn xóa tài khoản.
                            </dd>
                        </div>
                        <div>
                            <dt>Liên kết xem đơn trong email</dt>
                            <dd>Dùng được trong {keep.order_link} ngày.</dd>
                        </div>
                        <div>
                            <dt>Tài khoản</dt>
                            <dd>Tới khi bạn xóa.</dd>
                        </div>
                        <div>
                            <dt>{orders}</dt>
                            <dd>
                                Được giữ lâu dài làm chứng từ bán hàng, kể cả
                                khi tài khoản đã xóa.
                            </dd>
                        </div>
                    </dl>
                </section>

                <section aria-labelledby="privacy-rights">
                    <h2 id="privacy-rights">Bạn làm được gì</h2>
                    <ul>
                        <li>
                            Xem và sửa họ tên, email, mật khẩu; xem lại đơn hàng
                            và các cuộc trò chuyện: ở{' '}
                            <Link href="/account">trang tài khoản</Link>.
                        </li>
                        <li>
                            Bật hoặc tắt email ưu đãi: ở trang tài khoản, hoặc
                            bằng liên kết ở cuối email.
                        </li>
                        {CLARITY_ID && (
                            <li>
                                Đổi lựa chọn về Microsoft Clarity: ở cuối mỗi
                                trang của cửa hàng.
                            </li>
                        )}
                        <li>
                            Xóa tài khoản: ở{' '}
                            <Link href="/account">trang tài khoản</Link>, sau
                            khi nhập lại mật khẩu. Việc này xóa lịch sử hoạt
                            động, sản phẩm đã lưu, đánh giá, nhật ký email, các
                            cuộc trò chuyện và mã giảm giá riêng của bạn.{' '}
                            {orders} đã đặt vẫn được giữ, nhưng không còn gắn
                            với tài khoản.
                        </li>
                        <li>
                            Việc khác, như xin bản sao dữ liệu, sửa hoặc xóa
                            thông tin trên đơn đã đặt, hay khiếu nại: liên hệ
                            cửa hàng theo thông tin dưới đây.
                        </li>
                    </ul>
                </section>

                <section aria-labelledby="privacy-contact">
                    <h2 id="privacy-contact">Liên hệ</h2>
                    {contact.hotline || contact.email || contact.address ? (
                        <dl>
                            {contact.hotline && (
                                <div>
                                    <dt>Điện thoại</dt>
                                    <dd>
                                        <a
                                            href={
                                                'tel:' +
                                                contact.hotline.replace(
                                                    /[^0-9+]/g,
                                                    '',
                                                )
                                            }
                                        >
                                            {contact.hotline}
                                        </a>
                                    </dd>
                                </div>
                            )}
                            {contact.email && (
                                <div>
                                    <dt>Email</dt>
                                    <dd>
                                        <a href={'mailto:' + contact.email}>
                                            {contact.email}
                                        </a>
                                    </dd>
                                </div>
                            )}
                            {contact.address && (
                                <div>
                                    <dt>Địa chỉ</dt>
                                    <dd>{contact.address}</dd>
                                </div>
                            )}
                        </dl>
                    ) : (
                        <p>
                            Nhắn cho cửa hàng qua khung trò chuyện ở góc trang.
                        </p>
                    )}
                    <p>
                        Khi chính sách này thay đổi, ngày cập nhật ở đầu trang
                        đổi theo.
                    </p>
                </section>
            </article>
        </>
    );
}
