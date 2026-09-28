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
    try {
        await command('Page.navigate', { url: base + path });
    } catch (error) {
        if (!/navigated or closed/.test(String(error?.message ?? error)))
            throw error;
    }
    await waitFor(
        'location.pathname+location.search===' +
            JSON.stringify(path) +
            ' || document.querySelector(' +
            JSON.stringify(selector) +
            ')',
    );
    await waitFor('document.querySelector(' + JSON.stringify(selector) + ')');
};
const input = async (selector, value) =>
    evaluate(
        `(()=>{const e=document.querySelector(` +
            JSON.stringify(selector) +
            `);const setter=Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,` +
            JSON.stringify(value) +
            `);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
const clickText = (text) =>
    evaluate(
        "(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===" +
            JSON.stringify(text) +
            ");if(!e)throw Error('Missing control');e.click()})()",
    );
try {
    await command('Runtime.enable');
    await command('Page.enable');
    await command('Network.enable');
    await command('Network.clearBrowserCookies');
    await command('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await navigate('/products', '.store-product-card');
    // Up to 24 per page; what can be bought (the stocked demo rackets here) is listed first.
    const cards = await evaluate(
        "document.querySelectorAll('.store-product-card').length",
    );
    assert.ok(cards >= 6 && cards <= 24, 'cards ' + cards);
    assert.equal(
        await evaluate(
            "document.querySelector('.store-product-card').dataset.available",
        ),
        'true',
        'In-stock products come first',
    );
    assert.match(await evaluate('document.body.innerText'), /mẫu|Minh họa/i);
    const href = await evaluate(
        "document.querySelector('.store-product-card h2 a').getAttribute('href')",
    );
    await navigate(href, '#quantity');
    await input('#quantity', '2');
    await clickText('Thêm vào giỏ');
    await waitFor(
        "document.querySelector('.store-cart-link').innerText.includes('2')",
    );
    await navigate('/cart', '.store-cart-row');
    assert.match(await evaluate('document.body.innerText'), /2 sản phẩm/);
    await navigate('/checkout', '#name');
    await input('#name', 'Kiểm thử đơn mẫu');
    await input('#phone', '0912345678');
    await input('#address', 'Địa chỉ minh họa, không giao hàng');
    await evaluate("document.querySelector('input[type=checkbox]').click()");
    await clickText('Xác nhận đặt hàng');
    await waitFor("location.pathname.startsWith('/orders/')");
    await waitFor("document.querySelector('.storefront h1')");
    assert.match(await evaluate('document.body.innerText'), /mẫu/i);
    const orderPath = await evaluate('location.pathname');
    assert.match(orderPath, /^\/orders\/[a-f0-9-]{36}$/);
    await navigate('/cart', '.store-empty');
    await navigate('/advisor?budget=2000000', '.advisor-page');
    assert.match(await evaluate('document.body.innerText'), /chưa sử dụng AI/);
    for (const width of [768, 390, 320]) {
        await command('Emulation.setDeviceMetricsOverride', {
            width,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false,
        });
        for (const [path, selector] of [
            ['/products', '.store-product-card'],
            [href, '#quantity'],
            ['/advisor?budget=2000000', '.advisor-page'],
            [orderPath, '.storefront h1'],
        ]) {
            await navigate(path, selector);
            assert.equal(
                await evaluate(
                    'document.documentElement.scrollWidth<=innerWidth',
                ),
                true,
                'Overflow ' + width + ' ' + path,
            );
        }
    }
    await command('Network.clearBrowserCookies');
    await command('Page.navigate', { url: base + orderPath });
    await waitFor(
        'document.body && /404|Not Found/.test(document.body.innerText)',
    );
    assert.equal(
        await evaluate("document.body.innerText.includes('Kiểm thử đơn mẫu')"),
        false,
        'Private customer data leaked',
    );
    await command('Page.navigate', { url: base + '/admin' });
    await waitFor("location.pathname==='/login'");
    assert.deepEqual(errors, []);
    console.log(
        'PASS: demo products, variant, cart, guest COD, demo disclosure, recommendations, 1440/768/390/320px, private order isolation, admin guest redirect.',
    );
    console.log('Created explicit demo order for browser QA:', orderPath);
} finally {
    ws.close();
}
