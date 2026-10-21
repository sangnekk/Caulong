// Run with the frontend on :3001 and a local Chrome debugging session on :9222.
// Uses Chrome's protocol and Node's native WebSocket; no extra dependencies.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.DELIVERY_URL || 'http://localhost:3001';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find((item) => item.type === 'page');
assert(target, 'Start Chrome with a local debugging port first');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
});
const pending = new Map();
const errors = [];
let nextId = 0;
ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    // Runtime.enable can replay exceptions from the previously open dev page.
    if (message.method === 'Runtime.executionContextsCleared')
        errors.length = 0;
    if (message.method === 'Runtime.exceptionThrown')
        errors.push(message.params.exceptionDetails);
    if (message.id) {
        const task = pending.get(message.id);
        if (!task) return;
        clearTimeout(task.timeout);
        pending.delete(message.id);
        if (message.error) task.reject(message.error);
        else task.resolve(message.result);
    }
};
function command(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => {
            pending.delete(id);
            reject(new Error(method + ' timed out'));
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
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression) {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await sleep(100);
    }
    throw new Error('Timed out: ' + expression);
}
const image = () => evaluate("document.querySelector('canvas').toDataURL()");
const click = (selector) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function screenshot(name) {
    const { data } = await command('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
    });
    await writeFile(
        `artifacts/delivery-${name}.png`,
        Buffer.from(data, 'base64'),
    );
}
try {
    await mkdir('artifacts', { recursive: true });
    await command('Runtime.enable');
    await command('Page.enable');
    await command('Emulation.setEmulatedMedia', { features: [] });
    await command('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1100,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await command('Page.navigate', { url: base + '/demo/giao-hang' });
    await waitFor(
        "document.documentElement.dataset.hydrated === 'true' && !!document.querySelector('canvas') && document.querySelector('canvas').width > 300",
    );
    await sleep(200);
    await screenshot('packing-racket');
    await waitFor(
        "document.querySelector('canvas').dataset.historyComplete === 'true'",
    );
    await screenshot('packing-done');

    const shippingStart = Date.now();
    await click('.delivery-switch [data-stage="shipping"]');
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'packing' && document.querySelector('canvas').dataset.historyComplete === 'false'",
    );
    assert.equal(
        await evaluate(
            "document.querySelector('.delivery-switch [data-stage=shipping]').getAttribute('aria-pressed')",
        ),
        'true',
        'The selected destination remains shipping while its history plays',
    );
    await sleep(150);
    await click('.delivery-controls button');
    await sleep(120);
    const pausedHistory = await image();
    await sleep(300);
    assert.equal(
        await image(),
        pausedHistory,
        'Pause freezes fast-forward history',
    );
    await click('.delivery-controls button');
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'shipping'",
    );
    await waitFor(
        "Number(document.querySelector('canvas').dataset.morphProgress) > 0.35 && Number(document.querySelector('canvas').dataset.morphProgress) < 0.75",
    );
    await click('.delivery-controls button');
    await sleep(100);
    const midMorph = await image();
    await screenshot('morph-parcel');
    await sleep(200);
    assert.equal(
        await image(),
        midMorph,
        'Pause holds the intermediate geometry during fast-forward',
    );
    await click('.delivery-controls button');
    await waitFor(
        "document.querySelector('canvas').dataset.historyComplete === 'true'",
    );
    assert(
        Date.now() - shippingStart < 6500,
        'History to shipping is faster than normal packing playback',
    );
    assert.equal(
        await evaluate("document.querySelector('canvas').dataset.playbackRate"),
        '1',
        'The destination returns to normal speed',
    );
    const shippingImage = await image();
    await sleep(350);
    assert.notEqual(
        await image(),
        shippingImage,
        'Shipping retains ambient animation',
    );
    assert.equal(
        await evaluate(
            "document.querySelector('canvas').dataset.playbackStage",
        ),
        'shipping',
        'Playback stays at the selected shipping milestone',
    );
    await screenshot('desktop');

    const approachingStart = Date.now();
    await click('.delivery-timeline li:nth-child(3) button');
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'packing'",
    );
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'shipping'",
    );
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'approaching'",
    );
    await waitFor(
        "document.querySelector('canvas').dataset.historyComplete === 'true'",
    );
    assert(
        Date.now() - approachingStart < 9500,
        'The last milestone fast-forwards through every earlier stage',
    );
    assert.equal(
        await evaluate(
            "document.querySelector('.delivery-switch [data-stage=approaching]').getAttribute('aria-pressed')",
        ),
        'true',
    );
    await screenshot('arrival');

    await click('.delivery-controls button:nth-child(2)');
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'packing' && document.querySelector('canvas').dataset.historyComplete === 'false'",
    );
    assert.equal(
        await evaluate(
            "document.querySelector('.delivery-switch [data-stage=approaching]').getAttribute('aria-pressed')",
        ),
        'true',
        'Replay keeps its destination and restarts from packing',
    );
    await command('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
    });
    await sleep(300);
    assert(
        await evaluate(
            'document.documentElement.scrollWidth <= window.innerWidth',
        ),
        'No horizontal overflow on mobile',
    );
    assert(
        await evaluate(
            "[...document.querySelectorAll('.delivery-switch button, .delivery-controls button')].every(b => b.getBoundingClientRect().height >= 44)",
        ),
        'Mobile touch targets remain usable',
    );
    await screenshot('mobile');

    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await sleep(200);
    assert.equal(
        await evaluate(
            "document.querySelector('canvas').dataset.playbackStage",
        ),
        'approaching',
        'Reduced motion skips directly to the target',
    );
    const reduced = await image();
    await sleep(300);
    assert.equal(await image(), reduced, 'Reduced motion remains still');
    await click('.delivery-switch [data-stage="shipping"]');
    await sleep(150);
    assert.equal(
        await evaluate(
            "document.querySelector('canvas').dataset.playbackStage",
        ),
        'shipping',
    );
    await click('.delivery-timeline li:first-child button');
    await sleep(150);
    assert.equal(
        await evaluate(
            "document.querySelector('canvas').dataset.playbackStage",
        ),
        'packing',
    );
    await screenshot('packing-mobile');

    await command('Emulation.setEmulatedMedia', { features: [] });
    await sleep(200);
    const fullStart = Date.now();
    await click('.delivery-controls [data-action="journey"]');
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'packing' && document.querySelector('canvas').dataset.historyComplete === 'false'",
    );
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'shipping'",
    );
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'approaching'",
    );
    await waitFor(
        "document.querySelector('canvas').dataset.historyComplete === 'true'",
    );
    assert(
        Date.now() - fullStart >= 15000,
        'The full-journey control retains normal playback speed',
    );
    assert.equal(
        await evaluate(
            "document.querySelector('.delivery-controls [data-action=journey]').getAttribute('aria-pressed')",
        ),
        'false',
    );

    await click('.delivery-switch [data-stage="approaching"]');
    await waitFor(
        "document.querySelector('canvas').dataset.playbackStage === 'packing' && document.querySelector('canvas').dataset.historyComplete === 'false'",
    );
    await click('.delivery-switch [data-stage="shipping"]');
    await sleep(100);
    await click('.delivery-switch [data-stage="packing"]');
    await waitFor(
        "document.querySelector('canvas').dataset.historyComplete === 'true'",
    );
    assert.equal(
        await evaluate(
            "document.querySelector('canvas').dataset.playbackStage",
        ),
        'packing',
        'Rapid milestone clicks follow the latest target',
    );
    assert.equal(
        errors.length,
        0,
        'No runtime errors: ' + JSON.stringify(errors),
    );
    console.log(
        'PASS: milestone history in chronological order at 3x, normal speed at the destination, pause and morph poses, replay from packing, repeated/rapid selections, full journey at 1x, mobile, reduced motion, and no runtime errors.',
    );
} finally {
    ws.close();
}
