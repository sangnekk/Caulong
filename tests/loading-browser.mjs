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
const held = [];
let resolvePaused;
const pausedRequest = () =>
    held.length
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                  resolvePaused = undefined;
                  reject(new Error('No intercepted model request'));
              }, 20000);
              resolvePaused = () => {
                  clearTimeout(timer);
                  resolvePaused = undefined;
                  resolve();
              };
          });
const originalHandler = ws.onmessage;
ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.method === 'Fetch.requestPaused') {
        held.push(m.params.requestId);
        resolvePaused?.();
    } else originalHandler(event);
};
try {
    await command('Runtime.enable');
    await command('Page.enable');
    await command('Network.enable');
    await command('Network.setCacheDisabled', { cacheDisabled: true });
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    await command('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await command('Fetch.enable', {
        patterns: [{ urlPattern: '*hyper-core.glb*', requestStage: 'Request' }],
    });
    await command('Page.navigate', { url: base });
    await waitFor("document.querySelector('.rv-viewer[data-status=loading]')");
    const initial = await evaluate(
        "({height:document.querySelector('.racket-story').offsetHeight,poster:!!document.querySelector('.rv-poster'),ready:document.querySelector('.racket-story').dataset.ready,disabled:document.querySelector('.story-next').disabled})",
    );
    assert.equal(initial.poster, true);
    assert.equal(initial.ready, 'false');
    assert.equal(initial.disabled, true);
    await pausedRequest();
    // The intro holds the first screen; a visitor who skips it scrolls while the model loads.
    await evaluate("document.querySelector('.landing-loader__skip').click()");
    await waitFor("!document.querySelector('.landing-loader')");
    await evaluate('window.scrollTo(0,1600)');
    await evaluate(
        'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
    );
    assert.equal(
        await evaluate(
            "document.querySelector('.racket-story').dataset.chapter",
        ),
        '0',
        'Keep intro readable while loading',
    );
    assert(held.length > 0, 'Model download paused');
    for (const requestId of held.splice(0))
        await command('Fetch.continueRequest', { requestId });
    await command('Fetch.disable');
    await waitFor(
        "document.querySelector('.rv-viewer[data-status=ready]') && document.querySelector('.racket-story').dataset.ready==='true'",
    );
    assert.equal(
        await evaluate("document.querySelector('.racket-story').offsetHeight"),
        initial.height,
        'No story height jump on ready',
    );
    assert.equal(await evaluate('scrollY'), 1600, 'No forced scroll reset');
    await waitFor(
        "Number(document.querySelector('canvas').dataset.storyProgress)>.1",
    );
    await evaluate('window.scrollTo(0,0)');
    await command('Fetch.enable', {
        patterns: [{ urlPattern: '*hyper-core.glb*', requestStage: 'Request' }],
    });
    await command('Page.reload', { ignoreCache: true });
    await waitFor("document.querySelector('.rv-viewer[data-status=loading]')");
    await pausedRequest();
    for (const requestId of held.splice(0))
        await command('Fetch.failRequest', {
            requestId,
            errorReason: 'Failed',
        });
    await command('Fetch.disable');
    await waitFor("document.querySelector('.rv-viewer[data-status=error]')");
    assert.equal(
        await evaluate("!!document.querySelector('.rv-poster')"),
        true,
    );
    await evaluate("document.querySelector('.rv-retry').click()");
    await waitFor("document.querySelector('.rv-viewer[data-status=ready]')");
    assert.equal(
        await evaluate("document.querySelectorAll('canvas').length"),
        1,
    );
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await waitFor(
        "document.querySelector('.is-reading') && !document.querySelector('canvas')",
    );
    // Reduced motion is already the no-3D reading: no toggle to offer.
    assert.equal(
        await evaluate("!document.querySelector('.story-mode')"),
        true,
    );
    assert.deepEqual(errors, []);
    console.log(
        'PASS: stalled loading poster + stable layout, intro held, scroll preserved, error/retry, reduced motion.',
    );
} finally {
    await command('Fetch.disable');
    await command('Emulation.setEmulatedMedia', { features: [] });
    ws.close();
}
