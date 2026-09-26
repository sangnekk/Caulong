// Run after build with Laravel :8000 and isolated Chrome --remote-debugging-port=9222.
import { readFile, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(
    await readFile('public/build/manifest.json', 'utf8'),
);
const sceneModule =
    '/build/' + manifest['resources/js/lib/racket-scene.ts'].file;
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(
    targets.find((t) => t.type === 'page').webSocketDebuggerUrl,
);
await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
        const p = pending.get(m.id);
        if (p) {
            clearTimeout(p.timer);
            pending.delete(m.id);
            if (m.error) p.reject(m.error);
            else p.resolve(m.result);
        }
    }
};
const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
        const n = ++id;
        const timer = setTimeout(
            () => reject(Error(method + ' timeout')),
            30000,
        );
        pending.set(n, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: n, method, params }));
    });
const evaluate = async (expression) => {
    const r = await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
};
try {
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', {
        width: 1000,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await call('Page.navigate', {
        url: process.env.LANDING_URL || 'http://127.0.0.1:8000',
    });
    await evaluate(
        `(async()=>{const mod=await import(${JSON.stringify(sceneModule)});document.body.replaceChildren();document.body.style.cssText='margin:0;background:transparent';document.documentElement.style.background='transparent';const host=document.createElement('div');host.style.cssText='width:700px;height:800px';document.body.append(host);const scene=await mod.createRacketScene(host,new AbortController().signal,()=>{throw Error('Render failed')});scene.reset();return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`,
    );
    await call('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
    });
    const { data } = await call('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: 700, height: 800, scale: 1 },
    });
    await writeFile(
        'public/models/hyper-core-poster.png',
        Buffer.from(data, 'base64'),
    );
    console.log(
        'Saved actual Hyper Core render: public/models/hyper-core-poster.png',
    );
} finally {
    await call('Emulation.setDefaultBackgroundColorOverride');
    ws.close();
}
