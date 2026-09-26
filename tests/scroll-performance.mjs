// Run after npm run build and php artisan serve, with Chrome --remote-debugging-port=9222.
// Uses Node's native WebSocket; no browser-test dependency.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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
try {
    await command('Runtime.enable');
    await command('Page.enable');
    await command('Performance.enable');
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    await command('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 2,
        mobile: false,
    });
    await command('Page.navigate', { url: base });
    await waitFor("document.querySelector('canvas[data-story-pose]')");
    const before = await command('Performance.getMetrics');
    const report = await evaluate(
        `new Promise(resolve=>{const root=document.querySelector('.racket-story'),stage=document.querySelector('.story-stage'),range=root.offsetHeight-stage.offsetHeight;const frames=[];let n=0,previous=0;const step=t=>{if(previous)frames.push(t-previous);previous=t;window.scrollTo(0,range*(n/119));if(++n<120)requestAnimationFrame(step);else{frames.sort((a,b)=>a-b);const canvas=document.querySelector('canvas');resolve({samples:frames.length,medianMs:frames[Math.floor(frames.length*.5)],p95Ms:frames[Math.floor(frames.length*.95)],over34ms:frames.filter(t=>t>34).length,buffer:[canvas.width,canvas.height],viewport:[innerWidth,innerHeight]})}};requestAnimationFrame(step)})`,
    );
    const after = await command('Performance.getMetrics');
    const metrics = Object.fromEntries(
        after.metrics.map((m) => [
            m.name,
            m.value -
                (before.metrics.find((b) => b.name === m.name)?.value || 0),
        ]),
    );
    const result = {
        ...report,
        scriptSeconds: metrics.ScriptDuration,
        layoutSeconds: metrics.LayoutDuration,
        taskSeconds: metrics.TaskDuration,
        note: 'Headless Chrome, DPR2, local software-capable renderer; not phone FPS guarantee.',
    };
    await mkdir('artifacts', { recursive: true });
    await writeFile(
        'artifacts/scroll-performance-' +
            (process.argv[2] || 'current') +
            '.json',
        JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
} finally {
    ws.close();
}
