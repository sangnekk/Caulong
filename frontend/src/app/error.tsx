'use client';

/** Laravel did not answer, or answered with an error: say so and offer to try again. */
export default function PageError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
            <title>Có lỗi xảy ra - Shop Cầu Lông</title>
            <h1 className="text-2xl font-semibold">Trang chưa tải được</h1>
            <p className="text-muted-foreground">
                Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.
            </p>
            {process.env.NODE_ENV !== 'production' && (
                <pre className="max-w-full overflow-auto rounded bg-muted p-3 text-xs">
                    {error.message}
                </pre>
            )}
            <button
                type="button"
                className="underline underline-offset-4"
                onClick={reset}
            >
                Thử lại
            </button>
        </main>
    );
}
