// One shared download of the story model. It can start before three.js and the viewer chunk
// arrive, and a StrictMode remount reuses the bytes instead of fetching them twice.
const FILES = ['hyper-core.glb', 'hyper-core-strings.glb'];
// Fallback when a proxy strips Content-Length; only shapes the progress estimate.
const EXPECTED_BYTES = [4_989_476, 132_200];
// A slow line is fine as long as bytes keep arriving; a silent one is given up on.
const STALL_MS = 20000;

let pending: Promise<ArrayBuffer[]> | null = null;
let fraction = 0;
const listeners = new Set<(fraction: number) => void>();

function publish(value: number) {
    fraction = value;
    listeners.forEach((listener) => listener(value));
}

/** Download progress 0..1; called at once with the current value. */
export function onRacketDownload(listener: (fraction: number) => void) {
    listeners.add(listener);
    listener(fraction);
    return () => {
        listeners.delete(listener);
    };
}

export function downloadRacketModel(): Promise<ArrayBuffer[]> {
    pending ??= fetchModel().catch((error: unknown) => {
        pending = null;
        publish(0);
        throw error;
    });
    return pending;
}

/** Drop the parsed bytes; a later viewer fetches again (from the HTTP cache). */
export function releaseRacketDownload() {
    pending = null;
    fraction = 0;
}

async function fetchModel() {
    const controller = new AbortController();
    let stall = 0;
    const alive = () => {
        window.clearTimeout(stall);
        stall = window.setTimeout(() => controller.abort(), STALL_MS);
    };
    const loaded = FILES.map(() => 0);
    const totals = [...EXPECTED_BYTES];
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    const report = () => publish(Math.min(1, sum(loaded) / sum(totals)));
    alive();
    try {
        return await Promise.all(
            FILES.map(async (name, index) => {
                const response = await fetch('/models/' + name, {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Racket model unavailable');
                const length = Number(response.headers.get('Content-Length'));
                if (length > 0) totals[index] = length;
                if (!response.body) {
                    const buffer = await response.arrayBuffer();
                    loaded[index] = buffer.byteLength;
                    report();
                    return buffer;
                }
                const reader = response.body.getReader();
                const chunks: Uint8Array[] = [];
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    alive();
                    chunks.push(value);
                    loaded[index] += value.byteLength;
                    report();
                }
                const bytes = new Uint8Array(loaded[index]);
                let cursor = 0;
                for (const chunk of chunks) {
                    bytes.set(chunk, cursor);
                    cursor += chunk.byteLength;
                }
                return bytes.buffer;
            }),
        );
    } catch (error) {
        controller.abort();
        throw error;
    } finally {
        window.clearTimeout(stall);
    }
}
