'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
    forwardRef,
    type AllHTMLAttributes,
    type ElementType,
    type MouseEvent,
} from 'react';
import { mergeQuery } from './http';
import { router, trackNavigation } from './router';
import { transitionTypes } from './transition';
import {
    hrefMethod,
    hrefUrl,
    type Href,
    type Method,
    type RequestPayload,
    type VisitOptions,
} from './types';

type VisitProps = Pick<
    VisitOptions,
    | 'replace'
    | 'preserveScroll'
    | 'only'
    | 'except'
    | 'headers'
    | 'onBefore'
    | 'onStart'
    | 'onSuccess'
    | 'onFinish'
    | 'onCancel'
>;

export type LinkProps = Omit<
    AllHTMLAttributes<HTMLElement>,
    'href' | 'method' | 'data' | 'as' | 'onError' | keyof VisitProps
> &
    VisitProps & {
        href: Href;
        method?: Method;
        as?: ElementType;
        data?: RequestPayload;
        preserveState?: boolean;
        onError?: VisitOptions['onError'];
        /** Inertia's prefetch modes; Next.js prefetches on its own, so only `false` matters. */
        prefetch?: boolean | string | string[];
        cacheFor?: unknown;
        viewTransition?: boolean;
    };

/** Kept under Inertia's name so shared types (`NavItem['href']`) read as before. */
export type InertiaLinkProps = LinkProps;

const plainClick = (event: MouseEvent<HTMLElement>) =>
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;

/**
 * Inertia's `<Link>`: a Next.js link for GET, a button that sends the request for other
 * methods (`<Link href={logout()} as="button">`).
 */
export const Link = forwardRef<HTMLElement, LinkProps>(function Link(
    {
        href,
        method,
        as,
        data,
        replace,
        preserveScroll,
        preserveState,
        only,
        except,
        headers,
        prefetch,
        cacheFor: _cacheFor,
        viewTransition: _viewTransition,
        onBefore,
        onStart,
        onSuccess,
        onError,
        onFinish,
        onCancel,
        onClick,
        children,
        ...rest
    },
    ref,
) {
    const pathname = usePathname();
    const verb = (method ?? hrefMethod(href) ?? 'get').toLowerCase() as Method;
    const callbacks = {
        onBefore,
        onStart,
        onSuccess,
        onError,
        onFinish,
        onCancel,
    };

    if (verb !== 'get' || (as !== undefined && as !== 'a')) {
        const Tag: ElementType = as && as !== 'a' ? as : 'button';
        return (
            <Tag
                ref={ref}
                type={Tag === 'button' ? 'button' : undefined}
                {...rest}
                onClick={(event: MouseEvent<HTMLElement>) => {
                    onClick?.(event);
                    if (event.defaultPrevented) return;
                    event.preventDefault();
                    router.visit(hrefUrl(href), {
                        method: verb,
                        data,
                        replace,
                        preserveScroll,
                        preserveState,
                        only,
                        except,
                        headers,
                        ...callbacks,
                    });
                }}
            >
                {children}
            </Tag>
        );
    }

    const target = mergeQuery(hrefUrl(href), data);
    return (
        <NextLink
            ref={ref as React.Ref<HTMLAnchorElement>}
            href={target}
            replace={replace}
            scroll={!preserveScroll}
            prefetch={prefetch === false ? false : undefined}
            transitionTypes={transitionTypes(
                pathname,
                target.split(/[?#]/)[0] || pathname,
            )}
            {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
            onClick={(event) => {
                onClick?.(event);
                if (
                    event.defaultPrevented ||
                    !plainClick(event) ||
                    (rest.target && rest.target !== '_self')
                )
                    return;
                trackNavigation(target, {
                    preserveScroll,
                    preserveState,
                    ...callbacks,
                });
            }}
        >
            {children}
        </NextLink>
    );
});
