// Server-side access to the Laravel application. Laravel stays the source of truth for
// routing, sessions and data; it answers each page with the JSON it gives an Inertia client
// (component name, props, shared props), and this module asks for it on the visitor's behalf.
import { headers } from 'next/headers';
import { forbidden, notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import type { Page } from '@/lib/page/types';
import { URL_HEADER } from './url-header';

export const LARAVEL_URL = (
    process.env.LARAVEL_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '');

/**
 * Headers for a request to Laravel made for a visitor: their cookies (the session), and the
 * public address they are using, so the URLs Laravel generates point back at this site.
 */
export function forwardedHeaders(incoming: Headers): Headers {
    const outgoing = new Headers();
    for (const name of ['cookie', 'user-agent', 'accept-language', 'referer']) {
        const value = incoming.get(name);
        if (value) outgoing.set(name, value);
    }
    const host = incoming.get('x-forwarded-host') ?? incoming.get('host');
    if (host) outgoing.set('x-forwarded-host', host);
    outgoing.set(
        'x-forwarded-proto',
        incoming.get('x-forwarded-proto') ?? 'http',
    );
    const client = incoming.get('x-forwarded-for');
    if (client) outgoing.set('x-forwarded-for', client);
    return outgoing;
}

/** A URL Laravel redirects to, as a path of this site when that is where it points. */
export function localUrl(location: string, incoming: Headers): string {
    const host = incoming.get('x-forwarded-host') ?? incoming.get('host');
    const site = (incoming.get('x-forwarded-proto') ?? 'http') + '://' + host;
    const url = new URL(location, site);
    return url.origin === new URL(site).origin || url.origin === LARAVEL_URL
        ? url.pathname + url.search + url.hash
        : url.href;
}

/**
 * The page Laravel has for `url` (path and query). Laravel's redirects (sign in first, back
 * with validation errors), 403 and 404 become the Next.js equivalents. One request per
 * render: the layout's data (signed-in user, cart count, flash) comes with the page.
 */
export const getPage = cache(async (url: string): Promise<Page> => {
    const incoming = await headers();
    const request = forwardedHeaders(incoming);
    request.set('accept', 'text/html, application/xhtml+xml');
    request.set('x-inertia', 'true');

    let response: Response;
    try {
        response = await fetch(LARAVEL_URL + url, {
            headers: request,
            redirect: 'manual',
            cache: 'no-store',
        });
    } catch (error) {
        throw new Error(
            `Không kết nối được máy chủ Laravel tại ${LARAVEL_URL}. Hãy chạy "php artisan serve".`,
            { cause: error },
        );
    }

    const location =
        response.headers.get('location') ??
        response.headers.get('x-inertia-location');
    if (location && (response.status === 409 || response.status < 400))
        redirect(localUrl(location, incoming));
    if (response.status === 401) redirect('/login');
    if (response.status === 403) forbidden();
    if (response.status === 404) notFound();
    if (!response.ok || !response.headers.get('x-inertia'))
        throw new Error(`Laravel trả về ${response.status} cho ${url}.`);

    return (await response.json()) as Page;
});

/** `getPage` for the request being rendered. */
export async function currentPage(): Promise<Page> {
    const url = (await headers()).get(URL_HEADER);
    if (!url) throw new Error('src/proxy.ts did not run for this request.');
    return getPage(url);
}
