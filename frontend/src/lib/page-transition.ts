import type { VisitOptions } from '@inertiajs/core';
import { router } from '@inertiajs/react';

type Types = ViewTransition & { types?: Set<string> };

/** Leaving or returning to the landing changes world (dark hall ↔ white store): its own motion. */
const transitionType = (from: string, to: string) =>
    from === '/' ? 'leave-landing' : to === '/' ? 'enter-landing' : 'page';

/**
 * Inertia wraps a visit's page swap in the View Transitions API when this returns a value.
 * Only real page changes animate: filters, pagination and form posts that land back on the
 * same page swap in place. The type lets CSS give leaving the landing its own motion.
 */
export function pageTransition(
    href: string,
    options: VisitOptions,
): VisitOptions['viewTransition'] {
    const requested = options.viewTransition;
    // Inertia's React Link sends `false` unless told otherwise, so false means "not set" here.
    if (typeof requested === 'function') return requested;
    if (options.method && options.method !== 'get') return false;
    const from = window.location.pathname;
    const to = new URL(href, window.location.href).pathname;
    if (from === to && requested !== true) return false;
    const type = transitionType(from, to);
    return (transition) => {
        // Transition types: Chrome 125+, Safari 18; elsewhere the default fade-through runs.
        (transition as Types).types?.add(type);
    };
}

/**
 * Back/forward: Inertia restores history pages without a view transition, so the browser's
 * popstate is held, and replayed to Inertia inside one. Must run before createInertiaApp so
 * this listener precedes Inertia's own. Returning from a product to the list, the photo
 * shrinks back into its card.
 */
export function installHistoryTransitions() {
    let path = window.location.pathname;
    let replaying = false;
    router.on('navigate', () => {
        path = window.location.pathname;
    });
    window.addEventListener('popstate', (event) => {
        const from = path;
        const to = window.location.pathname;
        if (
            replaying ||
            event.state === null ||
            from === to ||
            !document.startViewTransition ||
            document.visibilityState === 'hidden' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
            return;
        event.stopImmediatePropagation();
        const transition = document.startViewTransition(
            () =>
                new Promise<void>((resolve) => {
                    const done = () => {
                        stop();
                        window.clearTimeout(timer);
                        resolve();
                    };
                    const stop = router.on('navigate', () => {
                        const slug = from.match(/^\/products\/([^/]+)$/)?.[1];
                        const card = slug
                            ? document
                                  .querySelector(
                                      `.store-product-card a[href$="/products/${CSS.escape(slug)}"]`,
                                  )
                                  ?.closest('.store-product-card')
                                  ?.querySelector<HTMLElement>('.store-image')
                            : null;
                        if (card)
                            card.style.viewTransitionName = 'product-hero';
                        done();
                    });
                    // A full reload (missing history item) never navigates here.
                    const timer = window.setTimeout(done, 1500);
                    replaying = true;
                    window.dispatchEvent(
                        new PopStateEvent('popstate', { state: event.state }),
                    );
                    replaying = false;
                }),
        );
        (transition as Types).types?.add(transitionType(from, to));
    });
}
