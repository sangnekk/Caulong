'use client';

import { useEffect, useRef, useState } from 'react';
import { router } from './router';
import type { Errors, Href, Method, Page, VisitOptions } from './types';
import { hrefMethod, hrefUrl } from './types';

// Form data is whatever the page declares, exactly as with Inertia's hook.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormData = Record<string, any>;
type SubmitOptions = Omit<VisitOptions, 'method' | 'data'>;
type Initial<TForm> = TForm | (() => TForm);

export type FormErrors = Partial<Record<string, string>>;

export type SetData<TForm> = {
    (data: TForm): void;
    (update: (previous: TForm) => TForm): void;
    <K extends keyof TForm>(key: K, value: TForm[K]): void;
};

export type InertiaFormProps<TForm extends FormData> = {
    data: TForm;
    isDirty: boolean;
    errors: FormErrors;
    hasErrors: boolean;
    processing: boolean;
    progress: null;
    wasSuccessful: boolean;
    recentlySuccessful: boolean;
    setData: SetData<TForm>;
    transform: (callback: (data: TForm) => object) => void;
    setDefaults: {
        (): void;
        <K extends keyof TForm>(field: K, value: TForm[K]): void;
        (fields: Partial<TForm>): void;
    };
    reset: (...fields: (keyof TForm)[]) => void;
    clearErrors: (...fields: string[]) => void;
    resetAndClearErrors: (...fields: (keyof TForm)[]) => void;
    setError: {
        (field: string, value: string): void;
        (errors: Errors): void;
    };
    submit: {
        (method: Method, url: string, options?: SubmitOptions): void;
        (route: Exclude<Href, string>, options?: SubmitOptions): void;
    };
    get: (url: string, options?: SubmitOptions) => void;
    post: (url: string, options?: SubmitOptions) => void;
    put: (url: string, options?: SubmitOptions) => void;
    patch: (url: string, options?: SubmitOptions) => void;
    delete: (url: string, options?: SubmitOptions) => void;
    cancel: () => void;
};

function same(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (
        typeof a !== 'object' ||
        typeof b !== 'object' ||
        a === null ||
        b === null ||
        a instanceof Blob ||
        b instanceof Blob
    )
        return false;
    const keys = Object.keys(a);
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) =>
            same(
                (a as Record<string, unknown>)[key],
                (b as Record<string, unknown>)[key],
            ),
        )
    );
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Inertia's `useForm`: the form's data, its validation errors and a submit that goes to
 * Laravel. Accepts the same arguments; a remember key is ignored (nothing is kept in history).
 */
export function useForm<TForm extends FormData>(
    ...args:
        | []
        | [Initial<TForm>]
        | [string, Initial<TForm>]
        | [Exclude<Href, string>, Initial<TForm>]
        | [Method, string, Initial<TForm>]
): InertiaFormProps<TForm> {
    const [initial] = useState<TForm>(() => {
        const last = args[args.length - 1];
        const value =
            typeof last === 'function' ? (last as () => TForm)() : last;
        return structuredCloneSafe((value ?? {}) as TForm);
    });
    const [defaults, setDefaultsState] = useState<TForm>(initial);
    const [data, setDataState] = useState<TForm>(initial);
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const [wasSuccessful, setWasSuccessful] = useState(false);
    const [recentlySuccessful, setRecentlySuccessful] = useState(false);
    const transformer = useRef<(data: TForm) => object>((value) => value);
    const latest = useRef(data);
    const timer = useRef<number | undefined>(undefined);
    const mounted = useRef(true);
    const defaultsSet = useRef(false);

    useEffect(() => {
        latest.current = data;
    }, [data]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            window.clearTimeout(timer.current);
        };
    }, []);

    // A route given up front ("useForm(store(), data)") is what submit() sends to.
    const preset =
        typeof args[0] === 'object' && args[0] !== null && 'url' in args[0]
            ? {
                  method: hrefMethod(args[0] as Href),
                  url: hrefUrl(args[0] as Href),
              }
            : typeof args[0] === 'string' &&
                METHODS.includes(args[0]) &&
                typeof args[1] === 'string'
              ? { method: args[0] as Method, url: args[1] }
              : null;

    const setData = ((
        keyOrData: keyof TForm | TForm | ((previous: TForm) => TForm),
        value?: unknown,
    ) => {
        setDataState((previous) => {
            const next =
                typeof keyOrData === 'function'
                    ? keyOrData(previous)
                    : typeof keyOrData === 'object'
                      ? (keyOrData as TForm)
                      : { ...previous, [keyOrData as string]: value };
            latest.current = next;
            return next;
        });
    }) as SetData<TForm>;

    const clearErrors = (...fields: string[]) =>
        setErrors((previous) =>
            fields.length === 0
                ? {}
                : Object.fromEntries(
                      Object.entries(previous).filter(
                          ([field]) => !fields.includes(field),
                      ),
                  ),
        );

    const reset = (...fields: (keyof TForm)[]) =>
        setDataState((previous) => {
            const next =
                fields.length === 0
                    ? structuredCloneSafe(defaults)
                    : {
                          ...previous,
                          ...Object.fromEntries(
                              fields.map((field) => [
                                  field,
                                  structuredCloneSafe(defaults[field]),
                              ]),
                          ),
                      };
            latest.current = next;
            return next;
        });

    const send = (method: Method, url: string, options: SubmitOptions = {}) => {
        defaultsSet.current = false;
        const payload = transformer.current(latest.current) as Record<
            string,
            unknown
        >;
        router.visit(url, {
            preserveState: true,
            ...options,
            method,
            data: payload,
            onBefore: () => {
                setWasSuccessful(false);
                setRecentlySuccessful(false);
                window.clearTimeout(timer.current);
                return options.onBefore?.();
            },
            onStart: () => {
                setProcessing(true);
                options.onStart?.();
            },
            onSuccess: (page: Page) => {
                if (mounted.current) {
                    setErrors({});
                    setWasSuccessful(true);
                    setRecentlySuccessful(true);
                    timer.current = window.setTimeout(
                        () => mounted.current && setRecentlySuccessful(false),
                        2000,
                    );
                }
                options.onSuccess?.(page);
                // What was just saved is the new starting point, unless the page chose one.
                if (mounted.current && !defaultsSet.current)
                    setDefaultsState(structuredCloneSafe(latest.current));
            },
            onError: (received: Errors) => {
                if (mounted.current) setErrors(received);
                options.onError?.(received);
            },
            onFinish: () => {
                if (mounted.current) setProcessing(false);
                options.onFinish?.();
            },
        });
    };

    return {
        data,
        isDirty: !same(data, defaults),
        errors,
        hasErrors: Object.keys(errors).length > 0,
        processing,
        progress: null,
        wasSuccessful,
        recentlySuccessful,
        setData,
        transform: (callback) => {
            transformer.current = callback;
        },
        setDefaults: ((
            field?: keyof TForm | Partial<TForm>,
            value?: unknown,
        ) => {
            defaultsSet.current = true;
            setDefaultsState((previous) =>
                field === undefined
                    ? structuredCloneSafe(latest.current)
                    : typeof field === 'object'
                      ? { ...previous, ...field }
                      : { ...previous, [field as string]: value },
            );
        }) as InertiaFormProps<TForm>['setDefaults'],
        reset,
        clearErrors,
        resetAndClearErrors: (...fields) => {
            reset(...fields);
            clearErrors(...(fields as string[]));
        },
        setError: ((field: string | Errors, value?: string) =>
            setErrors((previous) =>
                typeof field === 'string'
                    ? { ...previous, [field]: value }
                    : { ...previous, ...field },
            )) as InertiaFormProps<TForm>['setError'],
        submit: ((
            first?: Method | Exclude<Href, string> | SubmitOptions,
            second?: string | SubmitOptions,
            third?: SubmitOptions,
        ) => {
            if (typeof first === 'string')
                return send(first, second as string, third);
            if (first && 'url' in first)
                return send(
                    hrefMethod(first) ?? 'get',
                    hrefUrl(first),
                    second as SubmitOptions,
                );
            if (preset) return send(preset.method ?? 'get', preset.url, first);
            throw new Error('useForm().submit() needs a method and a URL.');
        }) as InertiaFormProps<TForm>['submit'],
        get: (url, options) => send('get', url, options),
        post: (url, options) => send('post', url, options),
        put: (url, options) => send('put', url, options),
        patch: (url, options) => send('patch', url, options),
        delete: (url, options) => send('delete', url, options),
        cancel: () => router.cancel(),
    };
}

/** A copy that shares no arrays or objects with the original; files are kept as they are. */
function structuredCloneSafe<T>(value: T): T {
    if (Array.isArray(value))
        return value.map((item) => structuredCloneSafe(item)) as T;
    if (
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof Blob) &&
        !(value instanceof Date)
    )
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                structuredCloneSafe(item),
            ]),
        ) as T;
    return value;
}
