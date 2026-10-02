'use client';

import { useRouter } from 'next/navigation';
import {
    createContext,
    useContext,
    useEffect,
    useLayoutEffect,
    useState,
    useSyncExternalStore,
    type ComponentType,
    type ReactNode,
} from 'react';
import { layoutProps } from './layout-props';
import {
    bindNavigator,
    navigationPreservesState,
    pageRendered,
} from './router';
import type { Page } from './types';

const PageContext = createContext<Page | null>(null);

/** The page Laravel answered with: component, props (shared ones included) and URL. */
export function usePage<TProps = Record<string, unknown>>(): Page<TProps> {
    const page = useContext(PageContext);
    if (!page) throw new Error('usePage() is only available inside a page.');
    return page as Page<TProps>;
}

type Layout = ComponentType<{ children: ReactNode } & Record<string, unknown>>;
type View = ComponentType<Record<string, unknown>> & { layout?: unknown };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype;

/**
 * Renders a Laravel page like Inertia's app did: the view with its props, inside its layouts.
 * Layouts get the page props, the view's static `layout` props and any `setLayoutProps()`.
 */
export function PageRoot({
    page,
    view: View,
    layouts = [],
}: {
    page: Page;
    view: View;
    layouts?: Layout[];
}) {
    const next = useRouter();
    useLayoutEffect(() => bindNavigator(next), [next]);

    // As in Inertia, a visit to the same page starts it afresh unless it preserves state.
    const [shown, setShown] = useState(page);
    const [key, setKey] = useState(0);
    if (shown !== page) {
        if (shown.component !== page.component) layoutProps.reset();
        setShown(page);
        if (!navigationPreservesState()) setKey((value) => value + 1);
    }
    useEffect(() => pageRendered(page), [page]);

    const dynamic = useSyncExternalStore(
        layoutProps.subscribe,
        layoutProps.get,
        layoutProps.get,
    );
    const fromView = isPlainObject(View.layout) ? View.layout : {};
    const content = layouts.reduceRight<ReactNode>(
        (child, Layout) => (
            <Layout {...page.props} {...fromView} {...dynamic}>
                {child}
            </Layout>
        ),
        <View key={key} {...page.props} />,
    );

    return (
        <PageContext.Provider value={page}>{content}</PageContext.Provider>
    );
}
