// What a page uses to talk to the Laravel application: the same names Inertia gave them, so
// the views read as they always did, on top of the Next.js router and a same-origin /api.
export { Form } from './form';
export { Head } from './head';
export { setLayoutProps } from './layout-props';
export { Link, type InertiaLinkProps, type LinkProps } from './link';
export { usePage } from './page-root';
export { router } from './router';
export { useForm, type InertiaFormProps } from './use-form';
export { useHttp } from './use-http';
export type {
    Errors,
    Href,
    Method,
    Page,
    SharedPageProps,
    UrlMethodPair,
    VisitOptions,
} from './types';
