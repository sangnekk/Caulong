'use client';

import type { ReactNode } from 'react';
import { usePage } from './page-root';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Shop Cầu Lông';

/**
 * Inertia's `<Head>`: the page title (with the site name) and any `<meta>` given as children.
 * React moves these into the document's head wherever they are rendered.
 *
 * A public page whose title Laravel sent for search engines (the `seo` prop, written into the
 * head by `SeoHead` in lib/laravel) already has it: a second `<title>` is not added.
 */
export function Head({
    title,
    children,
}: {
    title?: string;
    children?: ReactNode;
}) {
    const titled = !!(usePage().props.seo as { title?: string } | undefined)
        ?.title;
    return (
        <>
            {title !== undefined && !titled && (
                <title>{title ? `${title} - ${appName}` : appName}</title>
            )}
            {children}
        </>
    );
}
