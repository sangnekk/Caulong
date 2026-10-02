type Props = Record<string, unknown>;

let props: Props = {};
const listeners = new Set<() => void>();
let queued = false;

// Pages set these while they render, so listeners hear about it afterwards, never mid-render.
function notify(): void {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
        queued = false;
        listeners.forEach((listener) => listener());
    });
}

function same(a: Props, b: Props): boolean {
    const keys = Object.keys(b);
    return (
        keys.length === Object.keys(a).length &&
        keys.every((key) => Object.is(a[key], b[key]))
    );
}

/** Props a page hands to its layout at render time, like Inertia's setLayoutProps. */
export const layoutProps = {
    get: (): Props => props,
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    reset(): void {
        if (Object.keys(props).length === 0) return;
        props = {};
        notify();
    },
};

export function setLayoutProps(next: Props): void {
    const merged = { ...props, ...next };
    if (same(props, merged)) return;
    props = merged;
    notify();
}
