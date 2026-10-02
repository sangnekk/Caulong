import type { Auth } from '@/types/auth';

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** A Wayfinder route (`store()`), or a plain URL. */
export type Href = string | { url: string; method?: Method | Method[] };

export type Errors = Record<string, string>;

/** Props Laravel shares with every page (HandleInertiaRequests::share). */
export type SharedPageProps = {
    name: string;
    auth: Auth;
    sidebarOpen: boolean;
    errors: Errors & Record<string, Errors | string>;
    [key: string]: unknown;
};

/** What Laravel answers for a page: the component to show and its props. */
export type Page<TProps = Record<string, unknown>> = {
    component: string;
    props: TProps & SharedPageProps;
    url: string;
    version?: string | null;
    flash?: Record<string, unknown>;
};

export type FormDataConvertible =
    | string
    | number
    | boolean
    | null
    | undefined
    | Blob
    | Date
    | FormDataConvertible[]
    | { [key: string]: FormDataConvertible };

export type RequestPayload = Record<string, unknown> | FormData;

export type VisitOptions = {
    method?: Method;
    data?: RequestPayload;
    replace?: boolean;
    preserveScroll?: boolean;
    preserveState?: boolean | 'errors';
    only?: string[];
    except?: string[];
    headers?: Record<string, string>;
    errorBag?: string | null;
    forceFormData?: boolean;
    viewTransition?: boolean | ((transition: unknown) => void);
    onBefore?: () => boolean | void;
    onStart?: () => void;
    onProgress?: (progress: unknown) => void;
    onSuccess?: (page: Page) => void;
    onError?: (errors: Errors) => void;
    onCancel?: () => void;
    onFinish?: () => void;
};

export function hrefUrl(href: Href): string {
    return typeof href === 'string' ? href : href.url;
}

export function hrefMethod(href: Href): Method | undefined {
    if (typeof href === 'string' || !href.method) return undefined;
    return Array.isArray(href.method) ? href.method[0] : href.method;
}
