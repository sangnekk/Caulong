/**
 * The motion a navigation from `from` to `to` (paths) gets, as view-transition types; the
 * styles are in css/app.css. Leaving or returning to the landing changes world (dark hall,
 * white store) and has its own motion. Staying on a page (filters, the next page of a list)
 * has none.
 */
export function transitionTypes(from: string, to: string): string[] {
    if (from === to) return [];
    return [
        from === '/' ? 'leave-landing' : to === '/' ? 'enter-landing' : 'page',
    ];
}

/**
 * A view transition the browser gives up on because the window changed size while it ran (a
 * phone turned, a window resized) is not an error: the page is already the new one, only its
 * motion was cut short. React leaves this case out by the browser's wording, and Chrome words
 * it with the reason attached ("… invalid state. Viewport size changed"), so it would reach
 * the console and any error report as an uncaught exception. Stopped here; nothing else is.
 */
export function ignoreCutShortTransitions(): () => void {
    const onError = (event: ErrorEvent) => {
        const error: unknown = event.error;
        if (
            error instanceof DOMException &&
            error.name === 'InvalidStateError' &&
            error.message.startsWith(
                'Transition was aborted because of invalid state',
            )
        )
            event.preventDefault();
    };
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
}

/** Class each page gets while it enters or leaves, by the type of the navigation. */
export const PAGE_MOTION = {
    'leave-landing': 'leave-landing',
    'enter-landing': 'enter-landing',
    default: 'page',
};
