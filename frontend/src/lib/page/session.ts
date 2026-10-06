import { API_PREFIX } from './http';

const EVERY_MS = 15 * 60 * 1000;
const KEY = 'session-renewed-at';

/**
 * Pages are rendered on the Next.js server, and the session cookie Laravel renews with each
 * of those answers cannot reach the browser from there. So while the visitor keeps browsing,
 * the browser itself asks Laravel now and then (GET /session): that answer carries the
 * renewed cookie, and the session (sign-in, cart) does not expire under an active visitor.
 */
export function keepSessionAlive(): void {
    try {
        const last = Number(window.localStorage.getItem(KEY) ?? 0);
        if (Date.now() - last < EVERY_MS) return;
        window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
        // Storage is off (private mode): the cookie simply lasts its normal lifetime.
        return;
    }
    void fetch(API_PREFIX + '/session', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    }).catch(() => {});
}
