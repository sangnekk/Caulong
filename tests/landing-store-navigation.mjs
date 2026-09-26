// Run after npm run build and php artisan serve, with Chrome --remote-debugging-port=9222.
// Uses Node's native WebSocket; no browser-test dependency.
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
const waitFor = (expression) =>
    evaluate(
        `new Promise((resolve,reject)=>{const until=Date.now()+20000;const check=()=>{if(` +
            expression +
            `)resolve(true);else if(Date.now()>until)reject(new Error('Condition timeout'));else setTimeout(check,100)};check()})`,
    );

const navigate = async (path, selector) => {
    await command('Page.navigate', { url: base + path });
    await waitFor('document.querySelector(' + JSON.stringify(selector) + ')');
};
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
    await navigate('/', '.badminton-landing');
    await evaluate(
        "sessionStorage.removeItem('shop-cau-long:landing-intro-seen')",
    );
    await command('Page.navigate', { url: 'about:blank' });
    await waitFor("location.href==='about:blank'");
    await command('Page.navigate', { url: base });
    await waitFor("document.querySelector('.landing-loader__skip')");
    await evaluate("document.querySelector('.landing-loader__skip').click()");
    await waitFor("!document.querySelector('.landing-loader')");
    await evaluate('window.__navProbe = Math.random()');
    const probe = await evaluate('window.__navProbe');
    const count = await evaluate(
        "performance.getEntriesByType('navigation').length",
    );
    await waitFor("document.querySelector('.header-cta').tagName==='A'");
    await evaluate("document.querySelector('.header-cta').click()");
    await waitFor(
        "location.pathname==='/products' && !!document.querySelector('.store-product-card')",
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
    assert.equal(
        await evaluate("!!document.querySelector('.landing-loader')"),
        false,
        'Intro must not replay on return',
    );
    await evaluate(
        "document.querySelector('.collection-filters button:nth-child(2)').click(); document.querySelector('.collection-image').click()",
    );
    await waitFor("document.querySelector('.collection-dialog').open");
    assert.equal(
        await evaluate(
            'document.querySelector(\'.collection-dialog a[href="/products?style=attack"]\').tagName',
        ),
        'A',
    );
    await evaluate(
        'document.querySelector(\'.collection-dialog a[href="/products?style=attack"]\').click()',
    );
    await waitFor(
        "location.pathname==='/products' && new URLSearchParams(location.search).get('style')==='attack'",
    );
    assert.equal(
        await evaluate('window.__navProbe'),
        probe,
        'Filtered product CTA must stay in SPA',
    );
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
        'PASS: landing/storefront seamless SPA nav, warm catalog, filtered CTA, mobile menu, intro suppression.',
    );
} finally {
    ws.close();
}
