// Run after `npm run build` and `php artisan serve`, with Chrome --remote-debugging-port=9222.
// Native Node WebSocket + CDP only; no browser-test dependency.
//
// Contract under test: every FULL document load plays the intro. It strings a drawing of the
// racket as the real 3D model downloads (no fake progress), and only lets go once the 3D is
// ready, so the landing never shows a second loading state. A slow network is released by the
// 10 s ceiling and the story keeps the same progress in place. Escape/skip leave at once;
// reduced motion skips the 3D download and every animation. The SPA round-trip is covered by
// landing-store-navigation.mjs.
import assert from 'node:assert/strict';

const base = process.env.LANDING_URL || 'http://127.0.0.1:8000';
const CEILING_MS = 10000;
const STRINGS = 44;

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
const modelRequests = [];

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown')
        errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused')
        held.push(message.params.requestId);
    if (
        message.method === 'Network.requestWillBeSent' &&
        message.params.request.url.includes('/models/hyper-core.glb')
    )
        modelRequests.push(message.params.request.url);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Node-side polling: survives the execution-context swap a navigation causes.
async function waitFor(expression, timeout = 20000, interval = 50) {
    const deadline = Date.now() + timeout;
    for (;;) {
        try {
            if (await evaluate('Boolean(' + expression + ')')) return true;
        } catch {
            // Context destroyed mid-navigation, or the expression is not ready yet.
        }
        if (Date.now() > deadline)
            throw new Error('Condition timeout: ' + expression);
        await sleep(interval);
    }
}

// Let every intercepted model request through so the 3D can finish loading.
async function releaseModel() {
    const ids = held.splice(0);
    for (const requestId of ids) {
        try {
            await command('Fetch.continueRequest', { requestId });
        } catch {
            // The navigation already cancelled it; nothing to release.
        }
    }
}

async function waitForHeld(timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (held.length === 0) {
        if (Date.now() > deadline)
            throw new Error('model request never paused');
        await sleep(25);
    }
}

const loader = "document.querySelector('.landing-loader')";
const gone = (timeout) => waitFor('!' + loader, timeout, 50);
const present = () => evaluate('!!' + loader);
const overflow = () => evaluate('document.body.style.overflow');
const strung = () =>
    evaluate(
        "document.querySelectorAll('.racket-blueprint__strings line[data-strung]').length",
    );

async function open(navigate = true) {
    await releaseModel();
    held.length = 0;
    await command(
        navigate ? 'Page.navigate' : 'Page.reload',
        navigate ? { url: base } : {},
    );
    await waitFor('!!' + loader, 15000, 25);
    return evaluate('performance.now()');
}

async function skipIntro() {
    await evaluate("document.querySelector('.landing-loader__skip').click()");
    await gone(3000);
}

async function pressEscape() {
    for (const type of ['keyDown', 'keyUp']) {
        await command('Input.dispatchKeyEvent', {
            type,
            key: 'Escape',
            code: 'Escape',
            windowsVirtualKeyCode: 27,
            nativeVirtualKeyCode: 27,
        });
    }
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
        patterns: [{ urlPattern: '*hyper-core.glb*', requestStage: 'Request' }],
    });

    // 1. First full document: the intro is a modal over the court, focus on skip, page locked,
    //    and it strings nothing while no model bytes arrive.
    await open();
    await waitForHeld();
    await sleep(1500);
    const first = await evaluate(`(() => {
        const el = document.querySelector('.landing-loader');
        const skip = document.querySelector('.landing-loader__skip');
        const label = document.getElementById(el.getAttribute('aria-labelledby'));
        const status = document.getElementById(el.getAttribute('aria-describedby'));
        const frame = document.querySelector('.racket-blueprint__frame');
        return {
            role: el.getAttribute('role'),
            modal: el.getAttribute('aria-modal'),
            label: label ? label.textContent.trim() : null,
            status: status ? status.textContent.trim() : null,
            live: status ? status.getAttribute('aria-live') : null,
            focused: document.activeElement === skip,
            position: getComputedStyle(el).position,
            bodyOverflow: document.body.style.overflow,
            fakePercent: /\\d+\\s*%/.test(el.textContent),
            strings: document.querySelectorAll('.racket-blueprint__strings line').length,
            count: document.querySelector('.landing-loader__count').textContent,
            frameAnimation: getComputedStyle(frame).animationName,
            intro: document.querySelector('.badminton-landing').dataset.intro,
            navHidden: getComputedStyle(document.querySelector('.story-panels')).opacity,
            viewer: document.querySelector('.rv-viewer')?.dataset.status,
        };
    })()`);
    assert.equal(first.role, 'dialog');
    assert.equal(first.modal, 'true');
    assert.match(first.label ?? '', /Shop Cầu Lông/);
    assert.match(first.status ?? '', /Đang chuẩn bị vợt 3D/);
    assert.equal(first.live, 'polite');
    assert.equal(first.focused, true, 'skip button receives focus');
    assert.equal(first.position, 'fixed');
    assert.equal(first.bodyOverflow, 'hidden');
    assert.equal(first.fakePercent, false, 'no numeric percentage');
    assert.equal(first.strings, STRINGS, '20 mains + 24 crosses drawn');
    assert.notEqual(first.frameAnimation, 'none', 'frame draws itself in');
    assert.equal(first.intro, 'playing');
    assert.equal(first.navHidden, '0', 'story copy waits behind the intro');
    assert.equal(first.viewer, 'loading', '3D loads during the intro');
    assert.equal(await strung(), 0, 'no string without real model bytes');
    assert.match(first.count, /0\/20/);

    // 2. Real bytes string the racket; the intro lets go only once the 3D is ready,
    //    so there is no second loading state on the landing.
    await releaseModel();
    await waitFor(
        "document.querySelector('.landing-loader')?.dataset.state === 'pulling'",
        20000,
        20,
    );
    const handover = await evaluate(`({
        strung: document.querySelectorAll('.racket-blueprint__strings line[data-strung]').length,
        viewer: document.querySelector('.rv-viewer').dataset.status,
        ready: document.querySelector('.racket-story').dataset.ready,
        next: document.querySelector('.story-next').disabled,
        track: !!document.querySelector('.rv-loading-track'),
    })`);
    assert.equal(
        handover.strung,
        STRINGS,
        'racket fully strung before handover',
    );
    assert.equal(handover.viewer, 'ready');
    assert.equal(handover.ready, 'true');
    assert.equal(handover.next, false, 'story is usable the moment it appears');
    assert.equal(handover.track, false, 'no second progress bar in the story');
    await gone(4000);
    assert.equal(
        await evaluate(
            "document.querySelector('.badminton-landing').dataset.intro",
        ),
        'done',
    );
    assert.equal(await overflow(), '', 'exact inline overflow restored');
    assert.equal(
        await evaluate("document.querySelectorAll('canvas').length"),
        1,
        'one 3D scene, loaded once',
    );

    // 2b. Reload while reading the footer: the intro still plays on the first screen, not
    //     over the footer (Inertia restores the old scroll position after the first render).
    await evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await waitFor('scrollY > 2000');
    await open(false);
    await sleep(900);
    const reloaded = await evaluate(`({
        scroll: scrollY,
        stage: Math.round(document.querySelector('.story-stage').getBoundingClientRect().top),
    })`);
    assert.deepEqual(
        reloaded,
        { scroll: 0, stage: 0 },
        'intro stays on the first screen after a scrolled reload',
    );
    await skipIntro();
    await releaseModel();

    // 3. Slow network: the 10 s ceiling releases the visitor; the story shows the same
    //    stringing progress in place and finishes loading without another overlay.
    const t3 = await open();
    await waitForHeld();
    await gone(CEILING_MS + 6000);
    const ceilingElapsed = (await evaluate('performance.now()')) - t3;
    assert.ok(
        ceilingElapsed >= CEILING_MS - 500,
        'held model keeps the intro until the ceiling (got ' +
            Math.round(ceilingElapsed) +
            'ms)',
    );
    assert.equal(await overflow(), '', 'body restored after ceiling');
    const slow = await evaluate(`({
        meter: !!document.querySelector('.story-next .stringing-meter'),
        disabled: document.querySelector('.story-next').disabled,
        poster: !!document.querySelector('.rv-poster'),
    })`);
    assert.deepEqual(slow, { meter: true, disabled: true, poster: true });
    await releaseModel();
    await waitFor(
        "document.querySelector('.rv-viewer[data-status=ready]') && !document.querySelector('.story-next').disabled",
    );
    assert.equal(
        await present(),
        false,
        'no overlay when the model lands late',
    );

    // 4. Escape leaves at once, even mid-download.
    const t4 = await open();
    await waitForHeld();
    await pressEscape();
    await gone(2000);
    assert.ok(
        (await evaluate('performance.now()')) - t4 < 4000,
        'Escape does not wait for the model',
    );
    assert.equal(await overflow(), '', 'body restored after Escape');

    // 5. Skip button leaves at once.
    await open();
    await waitForHeld();
    await skipIntro();
    assert.equal(await overflow(), '', 'body restored after skip');

    // 6. Replays on a true reload and on a fresh navigation.
    await open(false);
    assert.equal(await present(), true, 'intro replays on Page.reload');
    await skipIntro();
    await open();
    assert.equal(await present(), true, 'intro replays on Page.navigate');
    await skipIntro();
    await releaseModel();

    // 7. Reduced motion: no 3D download, no animation, no floor, no exit.
    await command('Fetch.disable');
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    modelRequests.length = 0;
    const t7 = Date.now();
    await command('Page.navigate', { url: base });
    await waitFor(
        "document.querySelector('.badminton-landing')?.dataset.intro === 'done'",
        6000,
        25,
    );
    assert.ok(Date.now() - t7 < 3000, 'reduced motion does not hold the page');
    assert.equal(await present(), false);
    assert.equal(await overflow(), '', 'body restored in reduced motion');
    assert.equal(
        await evaluate("!!document.querySelector('.racket-story.is-reading')"),
        true,
    );
    assert.deepEqual(
        modelRequests,
        [],
        'reduced motion never downloads the 3D',
    );

    assert.deepEqual(errors, []);
    console.log(
        'PASS: intro on every full document, a11y + focus lock, strings only on real bytes, 3D ready at handover (no second loader), 10s ceiling with in-place progress, Escape, skip, replay, reduced motion without 3D download.',
    );
} finally {
    await releaseModel();
    await command('Fetch.disable').catch(() => {});
    await command('Emulation.setEmulatedMedia', { features: [] }).catch(
        () => {},
    );
    ws.close();
}
