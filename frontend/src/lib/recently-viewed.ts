// Products this browser looked at lately, most recent first: ids only, kept in the browser.
// The store asks Laravel for their cards when it shows them, so prices and stock are current.
import { useSyncExternalStore } from 'react';

const KEY = 'shop:viewed';
/** Laravel accepts this many (RecommendationController::VIEWED). */
const LIMIT = 12;

function stored(): string {
    try {
        return window.localStorage.getItem(KEY) ?? '';
    } catch {
        // Storage is off (private mode): no history.
        return '';
    }
}

function parse(value: string): number[] {
    try {
        const ids: unknown = JSON.parse(value || '[]');
        return Array.isArray(ids)
            ? ids
                  .filter((id): id is number => Number.isInteger(id) && id > 0)
                  .slice(0, LIMIT)
            : [];
    } catch {
        return [];
    }
}

export function rememberViewed(id: number): void {
    try {
        window.localStorage.setItem(
            KEY,
            JSON.stringify(
                [id, ...parse(stored()).filter((seen) => seen !== id)].slice(
                    0,
                    LIMIT,
                ),
            ),
        );
    } catch {
        // Nothing to do: the list of recently viewed products is a convenience.
    }
}

const subscribe = () => () => {};

/** The ids, read after hydration: the server renders a page for someone with no history. */
export function useViewedProducts(): number[] {
    return parse(useSyncExternalStore(subscribe, stored, () => ''));
}
