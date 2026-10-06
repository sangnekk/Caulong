import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
            <title>Không tìm thấy trang - Shop Cầu Lông</title>
            <p className="text-sm text-muted-foreground">Lỗi 404</p>
            <h1 className="text-2xl font-semibold">Không tìm thấy trang này</h1>
            <p className="text-muted-foreground">
                Đường dẫn có thể đã đổi, hoặc sản phẩm không còn bán.
            </p>
            <Link className="underline underline-offset-4" href="/products">
                Về cửa hàng
            </Link>
        </main>
    );
}
