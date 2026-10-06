// Everything the browser sends to Laravel goes through here: /api/cart/items → Laravel's
// /cart/items. Same origin as the pages, so Laravel's session cookie is first-party and its
// request-forgery check (Sec-Fetch-Site, or the XSRF token) applies unchanged.
import type { NextRequest } from 'next/server';
import { REDIRECT_HEADER } from '@/lib/page/http';
import { LARAVEL_URL, forwardedHeaders, localUrl } from '@/lib/laravel/server';

const REQUEST_HEADERS = [
    'accept',
    'content-type',
    'origin',
    'precognition',
    'sec-fetch-site',
    'x-csrf-token',
    'x-inertia',
    'x-inertia-error-bag',
    'x-requested-with',
    'x-xsrf-token',
];
const RESPONSE_HEADERS = [
    'cache-control',
    'content-disposition',
    'content-type',
    'retry-after',
    'x-inertia',
    'x-inertia-location',
];

async function forward(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
    const { path } = await context.params;
    const headers = forwardedHeaders(request.headers);
    for (const name of REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

    let response: Response;
    try {
        response = await fetch(
            LARAVEL_URL +
                '/' +
                path.map(encodeURIComponent).join('/') +
                request.nextUrl.search,
            {
                method: request.method,
                headers,
                // Buffered, so Laravel gets a Content-Length (PHP's dev server needs one).
                body: hasBody ? await request.arrayBuffer() : undefined,
                redirect: 'manual',
                cache: 'no-store',
            },
        );
    } catch {
        return Response.json(
            { message: 'Không kết nối được máy chủ.' },
            { status: 502 },
        );
    }

    const outgoing = new Headers();
    for (const name of RESPONSE_HEADERS) {
        const value = response.headers.get(name);
        if (value) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie())
        outgoing.append('set-cookie', cookie);

    // fetch() in a browser cannot read where a redirect leads; tell it in a header instead.
    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
        outgoing.set(REDIRECT_HEADER, localUrl(location, request.headers));
        return new Response(null, { status: 204, headers: outgoing });
    }
    return new Response(response.body, {
        status: response.status,
        headers: outgoing,
    });
}

export {
    forward as GET,
    forward as POST,
    forward as PUT,
    forward as PATCH,
    forward as DELETE,
};
