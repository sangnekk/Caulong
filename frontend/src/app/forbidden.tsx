import Link from 'next/link';

export default function Forbidden() {
    return (
        <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
            <title>Không có quyền truy cập - Shop Cầu Lông</title>
            <p className="text-sm text-muted-foreground">Lỗi 403</p>
            <h1 className="text-2xl font-semibold">
                Tài khoản này không mở được trang bạn yêu cầu
            </h1>
            <p className="text-muted-foreground">
                Trang dành cho quản trị viên của cửa hàng.
            </p>
            <Link className="underline underline-offset-4" href="/account">
                Về tài khoản của tôi
            </Link>
        </main>
    );
}
