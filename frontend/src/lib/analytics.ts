// One vocabulary for what a visitor does in the shop.
//
// Laravel keeps the record that matters (customer_events): the server writes most of it
// itself, and the browser reports the three things only it knows (a product page, a search
// or the checkout really on screen). Microsoft Clarity is the second, optional listener: it
// loads only when the shop has a project id and this visitor agreed, and it is only ever told
// the *name* of an event. No search text, no ids, no amounts, nothing about who the visitor is.
import { useEffect, useSyncExternalStore } from 'react';
import { send } from '@/lib/page/http';

const configured = process.env.NEXT_PUBLIC_CLARITY_ID ?? '';
/** The shop's Clarity project (NEXT_PUBLIC_CLARITY_ID). Empty: Clarity is never loaded. */
export const CLARITY_ID = /^[a-z0-9]{6,20}$/i.test(configured)
    ? configured
    : '';

/** The same names Laravel uses (App\Services\CustomerEvents), plus the review. */
export type ShopEvent =
    | 'product_view'
    | 'search'
    | 'checkout_started'
    | 'coupon_applied'
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'order_placed'
    | 'wishlist_added'
    | 'chat_started'
    | 'review_submitted';

/** What the browser reports to Laravel (CustomerEvents::FROM_BROWSER). */
type Reported =
    | { name: 'product_view'; product: number }
    | { name: 'search'; q: string; results: number }
    | { name: 'checkout_started' };

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
    interface Window {
        clarity?: Clarity;
    }
}

/**
 * A page names its first event before Clarity has started on it. Those names wait here, only
 * for a visitor who already said yes, and reach Clarity when it starts (never for staff: it
 * does not start for them).
 */
const waiting: ShopEvent[] = [];

function tell(name: ShopEvent): void {
    try {
        window.clarity?.('event', name);
    } catch {
        // Analytics never gets in the way of the shop.
    }
}

/** Names an event for Clarity. Does nothing unless the visitor has allowed Clarity. */
export function mark(name: ShopEvent): void {
    if (recording === 'on') tell(name);
    else if (CLARITY_ID && stored() === 'granted' && waiting.length < 10)
        waiting.push(name);
}

/** Tells Laravel what is on screen, and names it for Clarity. A lost report is not retried. */
export function report(event: Reported): void {
    mark(event.name);
    void send('post', '/events', event, { expects: 'json' }).catch(() => {});
}

// ───── The visitor's choice about Clarity ─────

const KEY = 'shop:analytics';
const CHANGED = 'shop:analytics-changed';
export type Choice = 'granted' | 'denied' | null;

function stored(): string {
    try {
        return window.localStorage.getItem(KEY) ?? '';
    } catch {
        // Storage is off (private mode): nothing to remember, so nothing is recorded.
        return 'denied';
    }
}

const subscribe = (changed: () => void) => {
    window.addEventListener(CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
        window.removeEventListener(CHANGED, changed);
        window.removeEventListener('storage', changed);
    };
};

/** `undefined` until the page has hydrated: the server cannot know the visitor's choice. */
export function useChoice(): Choice | undefined {
    const value = useSyncExternalStore(subscribe, stored, () => 'unknown');
    return value === 'unknown'
        ? undefined
        : value === 'granted' || value === 'denied'
          ? value
          : null;
}

export function choose(choice: 'granted' | 'denied'): void {
    try {
        window.localStorage.setItem(KEY, choice);
    } catch {
        // Cannot be remembered: stays undecided, which records nothing.
    }
    window.dispatchEvent(new Event(CHANGED));
}

/**
 * Back to undecided, so the visitor is asked again. Someone who had agreed gets Clarity's
 * cookies removed and the page reloaded without its script.
 */
export function askAgain(): void {
    try {
        window.localStorage.removeItem(KEY);
    } catch {
        // Nothing was stored.
    }
    if (recording !== 'never') {
        for (const name of ['_clck', '_clsk']) {
            document.cookie = name + '=; Max-Age=0; path=/';
        }
        window.location.reload();
        return;
    }
    window.dispatchEvent(new Event(CHANGED));
}

// ───── Recording ─────

// Clarity records only while a store page is on screen: the sign-in pages, account settings
// and the admin stop it (useNoRecording), and the next store page starts it again.
let recording: 'never' | 'on' | 'stopped' = 'never';

/** Starts Clarity. Callers check the visitor's choice and who is signed in (ShopAnalytics). */
export function startClarity(): void {
    if (!CLARITY_ID || recording === 'on') return;
    if (recording === 'stopped') {
        try {
            window.clarity?.('start');
        } catch {
            // Stays off until the next full page load.
        }
    } else {
        // Calls made before the script arrives wait in the queue Clarity reads when it starts.
        const queue: Clarity = (...args: unknown[]) => {
            (queue.q ??= []).push(args);
        };
        window.clarity = queue;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.clarity.ms/tag/' + CLARITY_ID;
        document.head.appendChild(script);
    }
    recording = 'on';
    waiting.splice(0).forEach(tell);
}

export function stopClarity(): void {
    waiting.length = 0;
    if (recording !== 'on') return;
    try {
        window.clarity?.('stop');
    } catch {
        // Nothing was recording.
    }
    recording = 'stopped';
}

/**
 * For layouts whose screens are never recorded: they show passwords, sign-in codes and
 * other people's data. A visitor who arrives from the store with Clarity running has it
 * stopped here.
 */
export function useNoRecording(): void {
    useEffect(stopClarity, []);
}
