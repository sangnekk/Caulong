import type { Method, RequestPayload } from './types';

/**
 * The browser never talks to Laravel directly: /api/* is a route handler on this same origin
 * that forwards to Laravel (app/api/[...path]/route.ts). Same origin keeps Laravel's session
 * cookie first-party, and its Sec-Fetch-Site check does the CSRF work.
 */
export const API_PREFIX = '/api';

/** Header the /api handler sets when Laravel answered with a redirect (fetch cannot read those). */
export const REDIRECT_HEADER = 'x-laravel-redirect';

export function apiUrl(url: string): string {
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) {
        throw new Error(`Cannot send a request to another site: ${url}`);
    }
    return API_PREFIX + target.pathname + target.search;
}

function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function isFile(value: unknown): value is Blob {
    return typeof Blob !== 'undefined' && value instanceof Blob;
}

export function hasFiles(value: unknown): boolean {
    if (isFile(value)) return true;
    if (Array.isArray(value)) return value.some(hasFiles);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.values(value).some(hasFiles);
    }
    return false;
}

function appendValue(target: FormData, key: string, value: unknown): void {
    if (value === undefined) return;
    if (value === null) {
        target.append(key, '');
    } else if (isFile(value)) {
        target.append(key, value);
    } else if (value instanceof Date) {
        target.append(key, value.toISOString());
    } else if (typeof value === 'boolean') {
        target.append(key, value ? '1' : '0');
    } else if (Array.isArray(value)) {
        value.forEach((item, index) =>
            appendValue(target, `${key}[${index}]`, item),
        );
    } else if (typeof value === 'object') {
        Object.entries(value).forEach(([name, item]) =>
            appendValue(target, `${key}[${name}]`, item),
        );
    } else {
        target.append(key, String(value));
    }
}

export function objectToFormData(data: Record<string, unknown>): FormData {
    const form = new FormData();
    Object.entries(data).forEach(([key, value]) => appendValue(form, key, value));
    return form;
}

function appendQuery(params: URLSearchParams, key: string, value: unknown) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
        value.forEach((item) => appendQuery(params, `${key}[]`, item));
    } else if (typeof value === 'object' && !(value instanceof Date)) {
        Object.entries(value).forEach(([name, item]) =>
            appendQuery(params, `${key}[${name}]`, item),
        );
    } else if (typeof value === 'boolean') {
        params.append(key, value ? '1' : '0');
    } else {
        params.append(key, String(value));
    }
}

/** `url` with `data` as its query string; keys in `data` replace the same keys in `url`. */
export function mergeQuery(url: string, data?: RequestPayload): string {
    if (!data) return url;
    const [path, hash = ''] = url.split('#');
    const [base, search = ''] = path.split('?');
    const params = new URLSearchParams(search);
    const entries =
        data instanceof FormData
            ? Array.from(data.entries())
            : Object.entries(data);
    const extra = new URLSearchParams();
    entries.forEach(([key, value]) => appendQuery(extra, key, value));
    new Set(extra.keys()).forEach((key) => params.delete(key));
    extra.forEach((value, key) => params.append(key, value));
    const query = params.toString();
    return base + (query ? '?' + query : '') + (hash ? '#' + hash : '');
}

export type SendOptions = {
    headers?: Record<string, string>;
    forceFormData?: boolean;
    signal?: AbortSignal;
    /** 'page': Laravel answers like it does for a page visit (redirects, errors in the session). */
    expects?: 'page' | 'json';
};

/** Sends a request to Laravel through /api. */
export function send(
    method: Method,
    url: string,
    data: RequestPayload | undefined,
    { headers = {}, forceFormData = false, signal, expects = 'page' }: SendOptions = {},
): Promise<Response> {
    let verb = method.toUpperCase();
    let target = url;
    let body: BodyInit | undefined;
    const outgoing: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
        ...(expects === 'page'
            ? { 'X-Inertia': 'true', Accept: 'text/html, application/xhtml+xml' }
            : { Accept: 'application/json' }),
        ...headers,
    };
    const token = xsrfToken();
    if (token) outgoing['X-XSRF-TOKEN'] = token;

    if (verb === 'GET') {
        target = mergeQuery(url, data);
    } else if (data instanceof FormData || forceFormData || hasFiles(data)) {
        // PHP only reads multipart bodies on POST: other verbs ride along as _method.
        const form =
            data instanceof FormData
                ? data
                : objectToFormData((data ?? {}) as Record<string, unknown>);
        if (verb !== 'POST') {
            form.append('_method', verb);
            verb = 'POST';
        }
        body = form;
    } else if (data !== undefined) {
        outgoing['Content-Type'] = 'application/json';
        body = JSON.stringify(data);
    }

    return fetch(apiUrl(target), {
        method: verb,
        headers: outgoing,
        body,
        signal,
        credentials: 'same-origin',
    });
}
