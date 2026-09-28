// Run after npm run build and php artisan serve, with Chrome --remote-debugging-port=9222.
// Uses Node's native WebSocket; no browser-test dependency.
//
// Contract: the landing intro plays on every full document load, but an Inertia SPA
// round-trip (landing -> /products -> /) must keep the same document and never replay it.
import assert from 'node:assert/strict';
const base = process.env.LANDING_URL || 'http://127.0.0.1:8000';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find((item) => item.type === 'page');
assert(target, 'Start Chrome with --remote-debugging-port=9222 first');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
});
let nextId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown')
        errors.push(message.params.exceptionDetails.text);
    if (message.id) {
        const task = pending.get(message.id);
        if (task) {
            clearTimeout(task.timeout);
            pending.delete(message.id);
            if (message.error) task.reject(message.error);
            else task.resolve(message.result);
        }
    }
};
function command(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => {
            pending.delete(id);
            reject(new Error('Timed out: ' + method));
        }, 25000);
        pending.set(id, { resolve, reject, timeout });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const result = await command('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    if (result.exceptionDetails)
        throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Node-side polling: tolerates the execution-context swap an Inertia nav triggers.
async function waitFor(expression, timeout = 20000, interval = 50) {
    const deadline = Date.now() + timeout;
    for (;;) {
        try {
            if (await evaluate('Boolean(' + expression + ')')) return true;
        } catch {
            // Context swap mid-navigation.
        }
        if (Date.now() > deadline)
            throw new Error('Condition timeout: ' + expression);
        await sleep(interval);
    }
}
try {
    await command('Runtime.enable');
    await command('Page.enable');
    await command('Network.enable');
    await command('Network.clearBrowserCookies');
    await command('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    });

    // Full document load: the intro plays and must be dismissed before we drive the UI.
    await command('Page.navigate', { url: base });
    await waitFor("!!document.querySelector('.landing-loader__skip')", 15000);
    await evaluate("document.querySelector('.landing-loader__skip').click()");
    await waitFor("!document.querySelector('.landing-loader')", 8000);

    await evaluate('window.__navProbe = Math.random()');
    const probe = await evaluate('window.__navProbe');
    const count = await evaluate(
        "performance.getEntriesByType('navigation').length",
    );

    // The way into the store stays in view after scrolling through the whole landing.
    await evaluate('window.scrollTo(0, document.body.scrollHeight)');
    // Past the first screen the header is never clear: night over the hall, paper over white.
    await waitFor(
        "document.querySelector('.shop-header').dataset.tone !== 'clear'",
    );
    const entry = await evaluate(`(() => {
        const cta = document.querySelector('.header-cta').getBoundingClientRect();
        return { top: cta.top, bottom: cta.bottom, visible: getComputedStyle(document.querySelector('.header-cta')).visibility };
    })()`);
    assert.ok(
        entry.top >= 0 && entry.bottom <= 100 && entry.visible === 'visible',
        'Store button pinned in view at the end of the landing: ' +
            JSON.stringify(entry),
    );

    // Record page transitions: transition types and the product photo morph.
    await evaluate(`(() => {
        window.__transitions = [];
        const start = document.startViewTransition.bind(document);
        document.startViewTransition = (update) => {
            const transition = start(update);
            transition.ready.then(() => window.__transitions.push({
                types: [...(transition.types ?? [])],
                hero: getComputedStyle(document.documentElement).viewTransitionName !== 'none'
                    && [...document.querySelectorAll('.store-image')].some((el) => getComputedStyle(el).viewTransitionName === 'product-hero'),
            })).catch((error) => window.__transitions.push({ error: String(error) }));
            return transition;
        };
    })()`);

    // Landing -> storefront is Inertia: document identity and nav count must not change.
    await waitFor("!!document.querySelector('.header-cta')");
    await evaluate("document.querySelector('.header-cta').click()");
    await waitFor(
        "location.pathname==='/products' && !!document.querySelector('.store-product-card')",
    );
    await waitFor('window.__transitions.length === 1');
    assert.deepEqual(
        await evaluate('window.__transitions[0].types'),
        ['leave-landing'],
        'Leaving the landing runs its own view transition',
    );

    // Product card -> detail: the clicked photo morphs into the product photo.
    await evaluate(
        "document.querySelector('.store-product-card .store-card-link').click()",
    );
    await waitFor(
        "location.pathname.startsWith('/products/') && window.__transitions.length === 2",
    );
    assert.deepEqual(
        await evaluate('window.__transitions[1]'),
        { types: ['page'], hero: true },
        'Card photo morphs into the product photo',
    );
    // Back button: the same fade-in, and the photo shrinks back into its card.
    await evaluate('history.back()');
    await waitFor(
        "location.pathname === '/products' && window.__transitions.length === 3",
    );
    assert.deepEqual(
        await evaluate('window.__transitions[2]'),
        { types: ['page'], hero: true },
        'Back to the list is animated too',
    );
    assert.equal(
        await evaluate('window.__navProbe'),
        probe,
        'Landing to storefront must not reload document',
    );
    assert.equal(
        await evaluate("performance.getEntriesByType('navigation').length"),
        count,
    );

    // Storefront -> landing is Inertia and must not replay the intro.
    await evaluate(
        'document.querySelector(\'.store-header nav a[href="/"]\').click()',
    );
    await waitFor(
        "location.pathname==='/' && !!document.querySelector('.badminton-landing')",
    );
    assert.equal(
        await evaluate('window.__navProbe'),
        probe,
        'Storefront to landing must not reload document',
    );
    await sleep(500);
    assert.equal(
        await evaluate("!!document.querySelector('.landing-loader')"),
        false,
        'Intro must not replay on SPA return',
    );

    // Filtered play-style CTA stays in the SPA.
    await evaluate(
        "document.querySelector('.collection-filters button:nth-child(2)').click()",
    );
    await waitFor(
        'document.querySelector(\'.collection-card a[href="/products?style=attack"]\')',
    );
    await evaluate(
        'document.querySelector(\'.collection-card a[href="/products?style=attack"]\').click()',
    );
    await waitFor(
        "location.pathname==='/products' && new URLSearchParams(location.search).get('style')==='attack'",
    );
    assert.equal(
        await evaluate('window.__navProbe'),
        probe,
        'Filtered product CTA must stay in SPA',
    );

    // Mobile: brand return and the collapsed menu both stay in the SPA.
    await command('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await evaluate(
        "document.querySelector('.store-header .store-brand').click()",
    );
    await waitFor(
        "location.pathname==='/' && !!document.querySelector('.badminton-landing')",
    );
    assert.equal(
        await evaluate('document.documentElement.scrollWidth<=innerWidth'),
        true,
    );
    assert.equal(
        await evaluate("!!document.querySelector('.landing-loader')"),
        false,
    );
    await evaluate(
        "document.querySelector('.mobile-navigation summary').click(); document.querySelector('.mobile-navigation a[href=\"/products\"]').click()",
    );
    await waitFor(
        "location.pathname==='/products' && !!document.querySelector('.store-product-card')",
    );
    assert.equal(
        await evaluate('window.__navProbe'),
        probe,
        'Mobile menu must not reload document',
    );

    assert.deepEqual(errors, [], 'No browser runtime exceptions');
    console.log(
        'PASS: intro on full load, store button pinned through the landing, one-step fade-in transitions (leave-landing, page), card photo morph, seamless SPA nav, no intro replay, filtered CTA, mobile menu.',
    );
} finally {
    ws.close();
}
