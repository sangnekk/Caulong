import { toast } from 'sonner';
import { REDIRECT_HEADER, mergeQuery, send } from './http';
import type {
    Errors,
    Href,
    Method,
    Page,
    RequestPayload,
    VisitOptions,
} from './types';
import { hrefMethod, hrefUrl } from './types';

/**
 * Inertia's `router`, on top of the Next.js router.
 *
 * GET visits are Next.js navigations: the page's server component asks Laravel for the page.
 * Other methods go to Laravel through /api; Laravel answers them like Inertia expects (a
 * redirect, with validation errors and flash messages in the session), and the redirect
 * becomes a Next.js navigation or refresh. A visit ends when the page it led to renders.
 */

type Navigator = {
    push(href: string, options?: { scroll?: boolean }): void;
    replace(href: string, options?: { scroll?: boolean }): void;
    refresh(): void;
};

type EventName =
    | 'before'
    | 'start'
    | 'finish'
    | 'navigate'
    | 'success'
    | 'error'
    | 'flash'
    | 'exception';

type Listener = (event: CustomEvent) => void;

type Navigation = {
    preserveState: boolean;
    preserveScroll: boolean;
    refresh: boolean;
    resolve: (page: Page | null) => void;
};

let navigator: Navigator | null = null;
let currentPage: Page | null = null;
let navigation: Navigation | null = null;
let navigationTimer: number | undefined;
let activeRequest: AbortController | null = null;
let visitCount = 0;
const listeners = new Map<EventName, Set<Listener>>();

function emit(name: EventName, detail: Record<string, unknown> = {}): void {
    const event = new CustomEvent(name, { detail });
    listeners.get(name)?.forEach((listener) => listener(event));
}

/** Called by <PageRoot> so visits can use the Next.js router. */
export function bindNavigator(next: Navigator): void {
    navigator = next;
}

/** True while a visit that keeps the page's state is on its way (see <PageRoot>). */
export function navigationPreservesState(): boolean {
    return navigation?.preserveState ?? false;
}

/** Called by <PageRoot> each time a page from Laravel renders. */
export function pageRendered(page: Page): void {
    const finished = navigation;
    navigation = null;
    window.clearTimeout(navigationTimer);
    currentPage = page;
    // A navigation to a new URL scrolls on its own; a refresh of the same one does not.
    if (finished?.refresh && !finished.preserveScroll) window.scrollTo(0, 0);
    emit('navigate', { page });
    if (page.flash && Object.keys(page.flash).length > 0) {
        emit('flash', { flash: page.flash, page });
    }
    finished?.resolve(page);
}

function currentUrl(): string {
    return window.location.pathname + window.location.search;
}

function sameUrl(target: string): boolean {
    const url = new URL(target, window.location.href);
    return (
        url.origin === window.location.origin &&
        url.pathname + url.search === currentUrl()
    );
}

/** Goes to `target` with Next.js and resolves with the page that renders there. */
function navigate(
    target: string,
    {
        replace = false,
        preserveScroll = false,
        preserveState = false,
    }: Pick<VisitOptions, 'replace' | 'preserveScroll'> & {
        preserveState?: boolean;
    },
): Promise<Page | null> {
    navigation?.resolve(null);
    window.clearTimeout(navigationTimer);
    const refresh = sameUrl(target);
    const url = new URL(target, window.location.href);

    if (url.origin !== window.location.origin || !navigator) {
        window.location.assign(url.href);
        return new Promise(() => {});
    }

    return new Promise((resolve) => {
        navigation = { preserveState, preserveScroll, refresh, resolve };
        // A navigation that ends somewhere else (an error page) never renders a Laravel page.
        navigationTimer = window.setTimeout(() => {
            navigation = null;
            resolve(null);
        }, 20000);
        const href = url.pathname + url.search + url.hash;
        if (refresh) navigator!.refresh();
        else if (replace) navigator!.replace(href, { scroll: !preserveScroll });
        else navigator!.push(href, { scroll: !preserveScroll });
    });
}

/** Link clicks: Next.js navigates; this only tracks the visit for events and page state. */
export function trackNavigation(options: VisitOptions = {}): void {
    navigation?.resolve(null);
    window.clearTimeout(navigationTimer);
    emit('start', { visit: options });
    options.onStart?.();
    const done = (page: Page | null) => {
        if (page) options.onSuccess?.(page);
        options.onFinish?.();
        emit('finish', { visit: options });
    };
    navigation = {
        preserveState: options.preserveState === true,
        preserveScroll: options.preserveScroll ?? false,
        refresh: false,
        resolve: done,
    };
    navigationTimer = window.setTimeout(() => {
        navigation = null;
        done(null);
    }, 20000);
}

function pageErrors(page: Page, errorBag?: string | null): Errors {
    const errors = (page.props.errors ?? {}) as Record<string, unknown>;
    const scoped = errorBag ? errors[errorBag] : errors;
    return (scoped && typeof scoped === 'object' ? scoped : {}) as Errors;
}

function failed(status: number): string {
    switch (status) {
        case 403:
            return 'Bạn không có quyền thực hiện thao tác này.';
        case 404:
            return 'Không tìm thấy nội dung bạn yêu cầu. Có thể nó đã bị xóa.';
        case 413:
            return 'Tệp tải lên quá lớn.';
        case 429:
            return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
        case 503:
            return 'Cửa hàng đang bảo trì. Vui lòng quay lại sau.';
        default:
            return 'Máy chủ gặp lỗi. Vui lòng thử lại.';
    }
}

async function visit(href: Href, options: VisitOptions = {}): Promise<void> {
    const method: Method = options.method ?? hrefMethod(href) ?? 'get';
    const url = hrefUrl(href);
    const visitId = ++visitCount;
    const preserveState =
        options.preserveState === undefined
            ? method !== 'get'
            : options.preserveState !== false;

    if (options.onBefore?.() === false) return;
    emit('before', { visit: { url, method, ...options } });

    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;

    emit('start', { visit: { url, method, ...options } });
    options.onStart?.();

    try {
        let target: string;
        if (method === 'get') {
            target = mergeQuery(url, options.data);
        } else {
            const headers = { ...options.headers };
            if (options.errorBag) headers['X-Inertia-Error-Bag'] = options.errorBag;
            const response = await send(method, url, options.data, {
                headers,
                forceFormData: options.forceFormData,
                signal: controller.signal,
            });
            const redirect = response.headers.get(REDIRECT_HEADER);
            const location = response.headers.get('x-inertia-location');
            if (redirect) {
                target = redirect;
            } else if (response.status === 409 && location) {
                window.location.assign(location);
                return;
            } else if (response.status === 419) {
                // The session (and its CSRF token) expired: start over with a fresh page.
                toast.error('Phiên làm việc đã hết hạn. Đang tải lại trang…');
                window.location.reload();
                return;
            } else if (!response.ok) {
                emit('exception', { status: response.status });
                toast.error(failed(response.status));
                return;
            } else {
                const page = response.headers.get('x-inertia')
                    ? ((await response.json()) as Page)
                    : null;
                target = page?.url ?? currentUrl();
            }
        }

        const page = await navigate(target, {
            replace: options.replace,
            preserveScroll: options.preserveScroll,
            preserveState,
        });
        if (!page || visitId !== visitCount) return;

        const errors = pageErrors(page, options.errorBag);
        if (Object.keys(errors).length > 0) {
            emit('error', { errors });
            options.onError?.(errors);
        } else {
            emit('success', { page });
            options.onSuccess?.(page);
        }
    } catch (error) {
        if (controller.signal.aborted) {
            options.onCancel?.();
            return;
        }
        emit('exception', { error });
        toast.error('Không kết nối được với máy chủ. Vui lòng thử lại.');
    } finally {
        if (activeRequest === controller) activeRequest = null;
        options.onFinish?.();
        emit('finish', { visit: { url, method, ...options } });
    }
}

type Data = RequestPayload | undefined;
type Options = Omit<VisitOptions, 'method' | 'data'>;

export const router = {
    visit,
    get: (url: Href, data?: Data, options: Options = {}) =>
        visit(url, { ...options, method: 'get', data }),
    post: (url: Href, data?: Data, options: Options = {}) =>
        visit(url, { preserveState: true, ...options, method: 'post', data }),
    put: (url: Href, data?: Data, options: Options = {}) =>
        visit(url, { preserveState: true, ...options, method: 'put', data }),
    patch: (url: Href, data?: Data, options: Options = {}) =>
        visit(url, { preserveState: true, ...options, method: 'patch', data }),
    delete: (url: Href, options: VisitOptions = {}) =>
        visit(url, { preserveState: true, ...options, method: 'delete' }),
    reload: (options: VisitOptions = {}) =>
        visit(currentUrl(), {
            preserveState: true,
            preserveScroll: true,
            ...options,
            method: 'get',
        }),
    /** Cancels the request of the visit in flight, if any. */
    cancel: () => activeRequest?.abort(),
    /** Inertia's prefetch cache; Next.js keeps its own, so there is nothing to clear. */
    flushAll: () => {},
    on(name: EventName, listener: Listener): () => void {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)!.add(listener);
        return () => {
            listeners.get(name)?.delete(listener);
        };
    },
    get page(): Page | null {
        return currentPage;
    },
};
