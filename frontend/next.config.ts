import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

const laravel = process.env.LARAVEL_URL ?? 'http://127.0.0.1:8000';

// `next dev` only serves its own scripts and hot reload to pages opened at localhost; from
// any other address the page loads but never comes alive (the browser reports a blocked
// cross-origin request). Allowed here: 127.0.0.1, this machine's own network addresses (to
// try the shop from a phone on the same Wi-Fi), and any host listed in DEV_ORIGINS
// (comma-separated, e.g. a tunnel). Development only: `next start` ignores it.
const lanAddresses = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
const devOrigins = [
    '127.0.0.1',
    ...lanAddresses,
    ...(process.env.DEV_ORIGINS ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
];

const nextConfig: NextConfig = {
    reactCompiler: true,
    allowedDevOrigins: devOrigins,
    // Not telling every visitor which server software answers.
    poweredByHeader: false,
    experimental: {
        // forbidden() for Laravel's 403 answers.
        authInterrupts: true,
    },
    // On every answer: no other site may show these pages in a frame (clickjacking), browsers
    // keep to the declared content types, a link followed to another site carries the origin
    // only (an order's address holds its signature), and the pages ask for no device features.
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors 'none'",
                    },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=()',
                    },
                ],
            },
        ];
    },
    // Laravel's own routes that never become a page: uploaded images, links from emails,
    // file downloads, what search engines ask for (the site map and robots.txt), and the
    // JSON endpoints two widgets call by their Laravel path (the support chat, and the
    // passkey package). Everything else is either a page or /api.
    async rewrites() {
        return [
            '/storage/:path*',
            '/email/verify/:path*',
            '/admin/orders/export',
            '/admin/imports/template',
            '/sitemap.xml',
            '/robots.txt',
            '/support-chat/:path*',
            '/passkeys/:path*',
            '/user/passkeys/:path*',
            '/.well-known/:path*',
            '/up',
        ].map((source) => ({
            source,
            destination: laravel + source,
        }));
    },
};

export default nextConfig;
