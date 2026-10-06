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

/** Class each page gets while it enters or leaves, by the type of the navigation. */
export const PAGE_MOTION = {
    'leave-landing': 'leave-landing',
    'enter-landing': 'enter-landing',
    default: 'page',
};
