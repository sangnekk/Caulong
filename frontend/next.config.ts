import type { NextConfig } from 'next';

const laravel = process.env.LARAVEL_URL ?? 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
    reactCompiler: true,
    experimental: {
        // forbidden() for Laravel's 403 answers.
        authInterrupts: true,
    },
    // Laravel's own routes that never become a page: uploaded images, links from emails,
    // file downloads and passkey discovery. Everything else is either a page or /api.
    async rewrites() {
        return [
            '/storage/:path*',
            '/email/verify/:path*',
            '/admin/orders/export',
            '/admin/imports/template',
            '/.well-known/:path*',
            '/up',
        ].map((source) => ({
            source,
            destination: laravel + source,
        }));
    },
};

export default nextConfig;
