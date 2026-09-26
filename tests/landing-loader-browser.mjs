// Run after `npm run build` and `php artisan serve`, with Chrome --remote-debugging-port=9222.
// Native Node WebSocket + CDP only; no browser-test dependency.
import assert from 'node:assert/strict';

const base = process.env.LANDING_URL || 'http://127.0.0.1:8000';
const SESSION_KEY = 'shop-cau-long:landing-intro-seen';
const SESSION_GET =
    'sessionStorage.getItem(' + JSON.stringify(SESSION_KEY) + ')';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find((item) => item.type === 'page');
assert(
    target,
    'Start Chrome with --remote-debugging-port=9222 and php artisan serve first',
);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
});

let nextId = 0;
const pending = new Map();
const errors = [];
const held = [];

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown')
        errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused')
        held.push(message.params.requestId);
    if (message.id) {
        const task = pending.get(message.id);
        if (task) {
            clearTimeout(task.timeout);
            pending.delete(message.id);
            if (message.error)
                task.reject(new Error(JSON.stringify(message.error)));
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

const waitFor = (expression, timeout = 20000, interval = 50) =>
    evaluate(
        'new Promise((resolve,reject)=>{const until=Date.now()+' +
            timeout +
            ';const check=()=>{if(' +
            expression +
            ")resolve(true);else if(Date.now()>until)reject(new Error('Condition timeout: " +
            expression.replace(/'/g, '') +
            "'));else setTimeout(check," +
            interval +
            ')};check()})',
    );

const sleep = (ms) => evaluate('new Promise(r=>setTimeout(r,' + ms + '))');

// Release every intercepted poster request so the loader can reach its ready state.
async function releasePoster() {
    const ids = held.splice(0);
    for (const requestId of ids) {
        try {
            await command('Fetch.continueRequest', { requestId });
        } catch {
            // The navigation already cancelled it; nothing to release.
        }
    }
}

async function reloadWithoutSession() {
    await evaluate('sessionStorage.clear()');
    await command('Page.navigate', { url: base });
}

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
        patterns: [
            { urlPattern: '*hyper-core-poster.png*', requestStage: 'Request' },
        ],
    });

    // Bootstrap the origin so sessionStorage can be cleared, then load fresh.
    await command('Page.navigate', { url: base });
    await waitFor("!!document.querySelector('.badminton-landing')");
    await releasePoster();
    await reloadWithoutSession();

    // 1. First visit: overlay visible, page locked behind it, a11y contract intact,
    //    and enough real work pending that the loader cannot have dismissed yet.
    await waitFor("!!document.querySelector('.landing-loader')");
    await sleep(100);
    assert.ok(
        held.length > 0,
        'poster request is held, so the overlay is genuinely pending',
    );
    const first = await evaluate(`(() => {
        const el = document.querySelector('.landing-loader');
        const skip = document.querySelector('.landing-loader__skip');
        const label = document.getElementById(el.getAttribute('aria-labelledby'));
        const status = document.getElementById(el.getAttribute('aria-describedby'));
        const shuttle = document.querySelector('.landing-loader__shuttle');
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
            role: el.getAttribute('role'),
            modal: el.getAttribute('aria-modal'),
            label: label ? label.textContent.replace(/\\s+/g, ' ').trim() : null,
            status: status ? status.textContent.trim() : null,
            live: status ? status.getAttribute('aria-live') : null,
            focused: document.activeElement === skip,
            position: style.position,
            full:
                rect.width >= window.innerWidth &&
                rect.height >= window.innerHeight,
            bodyOverflow: document.body.style.overflow,
            fakePercent: /\\d+\\s*%/.test(el.textContent),
            shuttleAnimation: getComputedStyle(shuttle).animationName,
            hasSkip: !!skip,
        };
    })()`);
    assert.equal(first.role, 'dialog');
    assert.equal(first.modal, 'true');
    assert.match(
        first.label ?? '',
        /SHOP CẦU LÔNG/i,
        'logo text labels dialog',
    );
    assert.match(first.status ?? '', /Đang chuẩn bị trải nghiệm/);
    assert.equal(first.live, 'polite');
    assert.equal(first.focused, true, 'skip button receives focus');
    assert.equal(first.position, 'fixed');
    assert.equal(first.full, true, 'overlay covers the viewport');
    assert.equal(first.bodyOverflow, 'hidden');
    assert.equal(first.fakePercent, false, 'no fake numeric percentage');
    assert.equal(first.hasSkip, true);
    assert.notEqual(first.shuttleAnimation, 'none', 'flight motif animates');

    await releasePoster();
    await waitFor("!document.querySelector('.landing-loader')", 8000, 50);
    const afterFirst = await evaluate(
        `({seen: ${SESSION_GET}, overflow: document.body.style.overflow, count: document.querySelectorAll('.landing-loader').length})`,
    );
    assert.equal(afterFirst.seen, '1', 'session key set after dismiss');
    assert.equal(afterFirst.overflow, '', 'exact inline overflow restored');
    assert.equal(afterFirst.count, 0, 'overlay unmounted');

    // 2. Escape dismisses.
    await releasePoster();
    await reloadWithoutSession();
    await waitFor("!!document.querySelector('.landing-loader')");
    await command('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Escape',
        code: 'Escape',
        windowsVirtualKeyCode: 27,
        nativeVirtualKeyCode: 27,
    });
    await command('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Escape',
        code: 'Escape',
        windowsVirtualKeyCode: 27,
        nativeVirtualKeyCode: 27,
    });
    await waitFor("!document.querySelector('.landing-loader')", 8000, 50);
    assert.equal(
        await evaluate('document.body.style.overflow'),
        '',
        'body restored after Escape',
    );

    // 3. Skip button dismisses immediately.
    await releasePoster();
    await reloadWithoutSession();
    await waitFor("!!document.querySelector('.landing-loader')");
    await evaluate("document.querySelector('.landing-loader__skip').click()");
    await waitFor("!document.querySelector('.landing-loader')", 8000, 50);
    assert.equal(
        await evaluate('document.body.style.overflow'),
        '',
        'body restored after skip',
    );

    // 4. Same tab session: the intro does not replay.
    await releasePoster();
    await command('Page.navigate', { url: base });
    await waitFor("!!document.querySelector('.badminton-landing')");
    await sleep(500);
    assert.equal(
        await evaluate("!!document.querySelector('.landing-loader')"),
        false,
        'second visit in the same session is suppressed',
    );
    assert.equal(await evaluate(SESSION_GET), '1');

    // 5. Reduced motion: no animation, no 300ms exit — dismiss is immediate.
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await releasePoster();
    await reloadWithoutSession();
    await waitFor("!!document.querySelector('.landing-loader')");
    const reduced = await evaluate(`(() => {
        const el = document.querySelector('.landing-loader');
        const shuttle = document.querySelector('.landing-loader__shuttle');
        const dot = document.querySelector('.landing-loader__status');
        return {
            shuttle: getComputedStyle(shuttle).animationName,
            overlay: getComputedStyle(el).transitionDuration,
            status: getComputedStyle(dot, '::before').animationName,
        };
    })()`);
    assert.equal(reduced.shuttle, 'none');
    assert.equal(reduced.overlay, '0s');
    assert.equal(reduced.status, 'none');

    const t0 = await evaluate('performance.now()');
    await evaluate("document.querySelector('.landing-loader__skip').click()");
    await waitFor("!document.querySelector('.landing-loader')", 2000, 20);
    const elapsed = (await evaluate('performance.now()')) - t0;
    assert.ok(
        elapsed < 250,
        'reduced motion unmounts without the 300ms exit (got ' +
            Math.round(elapsed) +
            'ms)',
    );
    assert.equal(
        await evaluate('document.body.style.overflow'),
        '',
        'body restored in reduced motion',
    );

    assert.deepEqual(errors, []);
    console.log(
        'PASS: intro overlay first-visit lock + a11y + focus, poster/fonts gate, auto dismiss, Escape, skip button, session suppression, reduced motion (no animation, instant exit), exact body overflow restore.',
    );
} finally {
    await releasePoster();
    await command('Fetch.disable').catch(() => {});
    await command('Emulation.setEmulatedMedia', { features: [] }).catch(
        () => {},
    );
    ws.close();
}
