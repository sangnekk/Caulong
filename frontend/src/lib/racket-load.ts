import { useSyncExternalStore } from 'react';

/** Maps the story's model plane (x right, y down, model units) to viewport pixels. */
export type RacketAffine = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};

export type RacketLoad = {
    /** `static`: no 3D will load (reduced motion, reading mode, short screen). */
    phase: 'idle' | 'loading' | 'ready' | 'error' | 'static';
    /** Real download/parse/upload progress, 0..1. */
    progress: number;
    /** Where the ready racket sits on screen right now; read it at the moment of use. */
    measure: (() => RacketAffine | null) | null;
};

// One story per document; the intro and the story read the same load instead of loading twice.
let state: RacketLoad = { phase: 'idle', progress: 0, measure: null };
const listeners = new Set<() => void>();

export const racketLoad = {
    get: () => state,
    set: (next: Partial<RacketLoad>) => {
        state = { ...state, ...next };
        listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};

export const useRacketLoad = () =>
    useSyncExternalStore(racketLoad.subscribe, racketLoad.get, racketLoad.get);
