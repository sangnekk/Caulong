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
 * Whether a reverse proxy stands in front of this server and writes the X-Forwarded-* headers
 * itself (TRUST_PROXY=1). Without one the browser talks to this server directly and can put
 * anything in them: a made-up address in X-Forwarded-For would give it a fresh allowance from
 * every rate limit Laravel keeps per address (five wrong passwords a minute, for one).
 */
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

/** A header a reverse proxy wrote; nothing when no proxy is trusted to have written it. */
const fromProxy = (incoming: Headers, name: string): string | null =>
    TRUST_PROXY ? incoming.get(name) : null;

/** The address the visitor uses for this site, as scheme and host. */
function siteOrigin(incoming: Headers): string {
    // A chain of proxies lists each hop: the first entry is the one the visitor used.
    const first = (value: string | null) => value?.split(',')[0].trim() || null;
    const host =
        first(fromProxy(incoming, 'x-forwarded-host')) ??
        incoming.get('host') ??
        'localhost';
    const scheme =
        first(fromProxy(incoming, 'x-forwarded-proto')) === 'https'
            ? 'https'
            : 'http';
    try {
        return new URL(scheme + '://' + host).origin;
    } catch {
        // A Host header that is no host at all: answer as for this machine.
        return 'http://localhost';
    }
}

/**
 * Headers for a request to Laravel made for a visitor: their cookies (the session), the
 * public address they are using, so the URLs Laravel generates point back at this site, and,
 * behind a trusted proxy, where they are calling from. Without that last one Laravel counts
 * every visitor who is not signed in as one caller: stricter than it should be, never looser.
 */
export function forwardedHeaders(incoming: Headers): Headers {
    const outgoing = new Headers();
    for (const name of ['cookie', 'user-agent', 'accept-language', 'referer']) {
        const value = incoming.get(name);
        if (value) outgoing.set(name, value);
    }
    const site = new URL(siteOrigin(incoming));
    outgoing.set('x-forwarded-host', site.host);
    outgoing.set('x-forwarded-proto', site.protocol.replace(':', ''));
    const client = fromProxy(incoming, 'x-forwarded-for');
    if (client) outgoing.set('x-forwarded-for', client);
    return outgoing;
}

/** A URL Laravel redirects to, as a path of this site when that is where it points. */
export function localUrl(location: string, incoming: Headers): string {
    const site = siteOrigin(incoming);
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
