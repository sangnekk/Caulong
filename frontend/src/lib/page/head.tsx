import type { ReactNode } from 'react';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Shop Cầu Lông';

/**
 * Inertia's `<Head>`: the page title (with the site name) and any `<meta>` given as children.
 * React moves these into the document's head wherever they are rendered.
 */
export function Head({
    title,
    children,
}: {
    title?: string;
    children?: ReactNode;
}) {
    return (
        <>
            {title !== undefined && (
                <title>{title ? `${title} - ${appName}` : appName}</title>
            )}
            {children}
        </>
    );
}
