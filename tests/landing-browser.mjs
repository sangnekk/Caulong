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
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    await command('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await command('Page.navigate', { url: base });
    await waitFor(
        "document.querySelector('.racket-story.is-cinematic canvas[data-story-pose]')",
    );
    // The intro hands over only once the 3D is ready; drive the story after it.
    await waitFor(
        "document.querySelector('.badminton-landing').dataset.intro==='done'",
    );
    await evaluate('document.fonts.ready.then(()=>true)');
    await mkdir('artifacts', { recursive: true });
    const shot = async (name) => {
        const r = await command('Page.captureScreenshot', { format: 'png' });
        await writeFile(
            'artifacts/' + name + '.png',
            Buffer.from(r.data, 'base64'),
        );
    };
    const chapter = async (index) => {
        await evaluate(
            "document.querySelectorAll('.story-chapters button')[" +
                index +
                '].click()',
        );
        await waitFor(
            "document.querySelector('.racket-story').dataset.chapter==='" +
                index +
                "' && document.querySelector('.rv-stage canvas').dataset.storyPose==='" +
                index +
                "'",
        );
        await waitFor(
            "Math.abs(Number(document.querySelector('canvas').dataset.storyProgress)-" +
                index / 5 +
                ') < 0.0002',
        );
    };
    assert.equal(await evaluate("document.querySelectorAll('h1').length"), 1);
    assert.deepEqual(
        await evaluate(
            "[...document.querySelectorAll('.desktop-navigation a')].map(a=>a.textContent.trim())",
        ),
        ['Cây vợt', 'Lối chơi', 'Gợi ý chọn vợt', 'Hỏi đáp'],
    );
    // The first chapter's own button walks into the parts; the nav brings the whole racket back.
    await evaluate("document.querySelector('.story-next').click()");
    await waitFor("document.querySelector('canvas').dataset.storyPose==='1'");
    await evaluate(
        'document.querySelector(\'.desktop-navigation a[href="#kham-pha-vot"]\').click()',
    );
    await waitFor("document.querySelector('canvas').dataset.storyPose==='0'");
    assert.equal(
        await evaluate(
            '/SKU|catalog|WebGL|mesh|CONCEPT/.test(document.body.innerText)',
        ),
        false,
        'No developer jargon in shopper copy',
    );
    await chapter(0);
    await command('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: 1000,
        y: 500,
        deltaX: 0,
        deltaY: 600,
    });
    await waitFor(
        "Number(document.querySelector('canvas').dataset.storyProgress)>0.05",
    );
    const forward = await evaluate(
        "Number(document.querySelector('canvas').dataset.storyProgress)",
    );
    await command('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: 1000,
        y: 500,
        deltaX: 0,
        deltaY: -300,
    });
    await waitFor(
        "Number(document.querySelector('canvas').dataset.storyProgress)<" +
            forward,
    );
    for (const index of [0, 1, 2, 3, 4, 5, 3, 0]) {
        await chapter(index);
        const result = await evaluate(
            "(()=>{const s=document.querySelector('.story-stage');return {top:s.getBoundingClientRect().top,panels:[...document.querySelectorAll('.story-panel')].map(p=>({opacity:+getComputedStyle(p).opacity,inert:p.inert,hidden:p.getAttribute('aria-hidden')})),canvasCount:document.querySelectorAll('canvas').length}})()",
        );
        assert.ok(
            Math.abs(result.top) < 2,
            'Stage must remain pinned at chapter ' + index,
        );
        assert.equal(result.canvasCount, 1, 'One continuous 3D scene');
        assert.ok(result.panels[index].opacity > 0.99);
        assert.equal(result.panels[index].inert, false);
        assert.equal(
            result.panels.filter((p) => !p.inert).length,
            1,
            'Only active chapter interactive',
        );
        assert.equal(
            await evaluate("document.querySelector('canvas').dataset.strings"),
            'illustrative',
        );
        if (index > 0 && index < 5) {
            assert.equal(
                await evaluate(
                    "document.querySelector('.anatomy-marker').hidden",
                ),
                false,
                'Anatomy callout visible',
            );
            assert.ok(
                (await evaluate(
                    "document.querySelectorAll('.story-panel')[" +
                        index +
                        "].querySelector('.story-description').textContent.length",
                )) > 40,
                'Each part is explained in its chapter',
            );
        }
        await shot('story-desktop-' + index);
    }
    await evaluate("document.querySelector('.story-mode').click()");
    await waitFor(
        "document.querySelector('.racket-story.is-reading') && !document.querySelector('.rv-story')",
    );
    assert.equal(
        await evaluate(
            "[...document.querySelectorAll('.story-panel')].every(e=>!e.inert&&getComputedStyle(e).opacity==='1')",
        ),
        true,
        'Reading mode exposes all chapters',
    );
    await evaluate("document.querySelector('.story-mode').click()");
    await waitFor("document.querySelector('canvas[data-story-pose]')");
    for (const width of [768, 390, 320]) {
        await command('Emulation.setDeviceMetricsOverride', {
            width,
            height: 844,
            deviceScaleFactor: 1,
            mobile: false,
        });
        for (const index of [0, 1, 3, 5]) {
            await chapter(index);
            assert.equal(
                await evaluate(
                    'document.documentElement.scrollWidth<=innerWidth',
                ),
                true,
                'Horizontal overflow at ' + width,
            );
            const fit = await evaluate(
                "(()=>{const c=document.querySelectorAll('.story-copy')[" +
                    index +
                    "];const r=c.getBoundingClientRect();const b=document.querySelector('.story-bottom').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,footer:b.top}})()",
            );
            assert.ok(
                fit.left >= 0 && fit.right <= width + 1,
                'Copy must fit horizontally',
            );
            assert.ok(
                fit.bottom <= fit.footer + 2,
                'Copy must not overlap chapter controls: ' +
                    JSON.stringify({ width, index, fit }),
            );
            if (width === 390) await shot('story-mobile-' + index);
        }
    }
    await chapter(1);
    await evaluate(
        "document.querySelector('.rv-stage canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))",
    );
    await waitFor("document.querySelector('.rv-retry')");
    assert.equal(
        await evaluate("!!document.querySelector('.rv-poster')"),
        true,
    );
    await evaluate("document.querySelector('.rv-retry').click()");
    await waitFor("document.querySelector('canvas[data-story-pose]')");
    await chapter(4);
    await command('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await waitFor(
        "document.querySelector('.racket-story.is-reading') && !document.querySelector('canvas')",
    );
    assert.equal(
        await evaluate(
            "[...document.querySelectorAll('.story-panel')].every(e=>!e.inert&&getComputedStyle(e).opacity==='1')",
        ),
        true,
    );
    await evaluate(
        "[...document.querySelectorAll('.collection-filters button')].find(b=>b.textContent.trim()==='Tốc độ').click()",
    );
    assert.equal(
        await evaluate("document.querySelectorAll('.collection-card').length"),
        1,
    );
    // The chosen style lights its zone on the court and links straight to the shop.
    assert.deepEqual(
        await evaluate(
            "({zones:document.querySelectorAll('.styles-court__zone[data-active]').length,label:document.querySelector('.styles-court__zone[data-active] text').textContent,href:document.querySelector('.collection-card a').getAttribute('href'),status:document.querySelector('.collection-disclaimer').textContent})",
        ).then(({ zones, label, href, status }) => ({
            zones,
            label,
            href,
            status: status.startsWith('Đang xem: Tốc độ.'),
        })),
        {
            zones: 1,
            label: 'Tốc độ',
            href: '/products?style=speed',
            status: true,
        },
    );
    await evaluate(
        "window.scrollTo(0,0);document.querySelector('.mobile-navigation summary').click()",
    );
    assert.equal(
        await evaluate("document.querySelector('.mobile-navigation').open"),
        true,
    );
    await evaluate("document.querySelector('.mobile-navigation a').click()");
    assert.equal(
        await evaluate("document.querySelector('.mobile-navigation').open"),
        false,
    );
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(
        'PASS: pinned six-chapter story, forward/reverse camera, one canvas, text states, 1440/768/390/320px, static reading, reduced motion, WebGL retry, court-zone styles, menu.',
    );
} finally {
    await command('Emulation.setEmulatedMedia', { features: [] });
    ws.close();
}
