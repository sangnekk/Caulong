import { NextResponse, type NextRequest } from 'next/server';
import { URL_HEADER } from '@/lib/laravel/url-header';

// Set when a reverse proxy in front of this server writes X-Forwarded-For itself (see
// lib/laravel/server.ts, which applies the same rule to pages and /api).
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

/**
 * Runs before every page and every path passed straight on to Laravel (next.config.ts):
 * tells the page which URL to ask Laravel for (a server component is not given its own path),
 * and, when no reverse proxy is trusted, drops the address the caller claims to come from, so
 * that Laravel's rate limits on those paths cannot be reset by claiming another one.
 */
export function proxy(request: NextRequest) {
    const url = new URL(request.nextUrl);
    url.searchParams.delete('_rsc');
    const headers = new Headers(request.headers);
    headers.set(URL_HEADER, url.pathname + url.search);
    if (!TRUST_PROXY) headers.delete('x-forwarded-for');
    return NextResponse.next({ request: { headers } });
}

export const config = {
    // Pages and Laravel's own paths: /api talks to Laravel itself, the rest are files.
    matcher: [
        '/((?!api/|_next/|fonts/|models/|storage/|favicon|apple-touch-icon|robots.txt|sitemap.xml).*)',
    ],
};
