import { ViewTransition, type ComponentType, type ReactNode } from 'react';
import { PageRoot } from '@/lib/page/page-root';
import { PAGE_MOTION } from '@/lib/page/transition';
import { SeoHead, seoOf } from './seo';
import { currentPage } from './server';

// Views and layouts take whatever props Laravel sends for their page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type View = ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layout = ComponentType<any>;

/**
 * A route's page component: asks Laravel for the page at the current URL and renders `view`
 * with its props inside `layouts` (outermost first).
 *
 *     export default laravelPage(Products, ShopLayout);
 */
export function laravelPage(view: View, ...layouts: Layout[]) {
    return async function LaravelPage(): Promise<ReactNode> {
        const page = await currentPage();
        const store =
            page.component === 'welcome' || page.component.startsWith('shop/');
        return (
            <>
                {/* The page's title, description, address and structured data for search
                    engines, or "keep out" for a page that is a visitor's own business. */}
                <SeoHead seo={seoOf(page.props)} siteName={page.props.name} />
                {/* The landing and the store keep their own colours in dark mode: painting the
                    page's own background first avoids a flash before the styles apply. */}
                <style>{`html{background-color:${page.component === 'welcome' ? 'oklch(0.145 0.032 262)' : 'oklch(1 0 0)'}}${store ? '' : 'html.dark{background-color:oklch(0.145 0 0)}'}`}</style>
                {/* Going to another page animates the page out and the next one in (css/app.css);
                    new data for the same page (filters, a saved form) swaps in place. */}
                <ViewTransition
                    enter={PAGE_MOTION}
                    exit={PAGE_MOTION}
                    update="none"
                >
                    <PageRoot page={page} view={view} layouts={layouts} />
                </ViewTransition>
            </>
        );
    };
}

/** A route that is only a redirect in Laravel (/dashboard, /settings). */
export async function LaravelRedirect(): Promise<never> {
    const page = await currentPage();
    throw new Error(`Expected a redirect, got the page "${page.component}".`);
}
