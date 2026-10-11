import { NextResponse, type NextRequest } from 'next/server';
import { URL_HEADER } from '@/lib/laravel/url-header';

/**
 * Runs before every page: tells the page which URL to ask Laravel for (a server component
 * is not given its own path).
 */
export function proxy(request: NextRequest) {
    const url = new URL(request.nextUrl);
    url.searchParams.delete('_rsc');
    const headers = new Headers(request.headers);
    headers.set(URL_HEADER, url.pathname + url.search);
    return NextResponse.next({ request: { headers } });
}

export const config = {
    // Pages only: /api talks to Laravel itself, the rest are files.
    matcher: [
        '/((?!api/|_next/|fonts/|models/|storage/|favicon|apple-touch-icon|robots.txt|sitemap.xml).*)',
    ],
};
