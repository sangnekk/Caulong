'use client';

import {
    useEffect,
    useRef,
    useState,
    type FormHTMLAttributes,
    type ReactNode,
} from 'react';
import { router } from './router';
import type { Errors, Href, Method, Page, VisitOptions } from './types';
import { hrefMethod, hrefUrl } from './types';

type FormValues = Record<string, unknown>;

export type FormSlotProps = {
    // Error bags nest ("confirmTwoFactorAuthentication.code"), so pages narrow this themselves.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errors: Record<string, any>;
    hasErrors: boolean;
    processing: boolean;
    progress: null;
    wasSuccessful: boolean;
    recentlySuccessful: boolean;
    isDirty: boolean;
    clearErrors: (...fields: string[]) => void;
    resetAndClearErrors: (...fields: string[]) => void;
    setError: (field: string, value: string) => void;
    reset: (...fields: string[]) => void;
    submit: () => void;
};

export type FormProps = Omit<
    FormHTMLAttributes<HTMLFormElement>,
    'action' | 'method' | 'children' | 'onError' | 'onSubmit'
> & {
    action?: Href;
    method?: Method | Uppercase<Method>;
    headers?: Record<string, string>;
    errorBag?: string | null;
    transform?: (data: FormValues) => FormValues;
    options?: Pick<
        VisitOptions,
        'preserveScroll' | 'preserveState' | 'replace' | 'only' | 'except'
    >;
    resetOnSuccess?: boolean | string[];
    resetOnError?: boolean | string[];
    disableWhileProcessing?: boolean;
    onBefore?: VisitOptions['onBefore'];
    onStart?: VisitOptions['onStart'];
    onSuccess?: (page: Page) => void;
    onError?: (errors: Errors) => void;
    onFinish?: VisitOptions['onFinish'];
    onCancel?: VisitOptions['onCancel'];
    children: ReactNode | ((props: FormSlotProps) => ReactNode);
};

/** "a[b][]" → ["a", "b", ""], as PHP reads field names. */
const path = (name: string) =>
    name
        .replace(/\]/g, '')
        .split('[')
        .map((part) => part);

/** What the form holds, as nested data: `variants[0][price]` → `{ variants: [{ price }] }`. */
export function formDataToObject(source: FormData): FormValues {
    const result: FormValues = {};
    for (const [name, value] of source.entries()) {
        // A file input left empty still reports a nameless, empty file.
        if (value instanceof File && value.size === 0 && value.name === '')
            continue;
        const keys = path(name);
        let target = result as Record<string, unknown>;
        keys.forEach((key, index) => {
            const last = index === keys.length - 1;
            const next = keys[index + 1];
            if (key === '') {
                (target as unknown as unknown[]).push(value);
                return;
            }
            if (last) {
                target[key] = value;
                return;
            }
            target[key] ??= next === '' || /^\d+$/.test(next) ? [] : {};
            target = target[key] as Record<string, unknown>;
        });
    }
    return result;
}

/**
 * Inertia's `<Form>`: an ordinary form (uncontrolled inputs) sent to Laravel as a visit.
 * Children may be a function of the form's state: `({ processing, errors }) => …`.
 */
export function Form({
    action = '',
    method = 'get',
    headers,
    errorBag,
    transform,
    options = {},
    resetOnSuccess = false,
    resetOnError = false,
    disableWhileProcessing = false,
    onBefore,
    onStart,
    onSuccess,
    onError,
    onFinish,
    onCancel,
    children,
    ...rest
}: FormProps) {
    const element = useRef<HTMLFormElement>(null);
    const mounted = useRef(true);
    const timer = useRef<number | undefined>(undefined);
    const [errors, setErrors] = useState<Errors>({});
    const [processing, setProcessing] = useState(false);
    const [wasSuccessful, setWasSuccessful] = useState(false);
    const [recentlySuccessful, setRecentlySuccessful] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            window.clearTimeout(timer.current);
        };
    }, []);

    const url = hrefUrl(action);
    const verb = (hrefMethod(action) ?? method).toLowerCase() as Method;

    const reset = (...fields: string[]) => {
        const form = element.current;
        if (!form) return;
        if (fields.length === 0) form.reset();
        for (const field of fields) {
            const found = form.elements.namedItem(field);
            const inputs =
                found instanceof RadioNodeList
                    ? Array.from(found)
                    : found
                      ? [found]
                      : [];
            for (const input of inputs) {
                if (input instanceof HTMLInputElement) {
                    input.checked = input.defaultChecked;
                    input.value = input.defaultValue;
                } else if (input instanceof HTMLTextAreaElement) {
                    input.value = input.defaultValue;
                } else if (input instanceof HTMLSelectElement) {
                    for (const option of input.options)
                        option.selected = option.defaultSelected;
                }
            }
        }
        setIsDirty(false);
    };
    const resetAfter = (fields: boolean | string[]) => {
        if (fields === true) reset();
        else if (Array.isArray(fields) && fields.length) reset(...fields);
    };
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

    const submit = (submitter?: HTMLElement | null) => {
        const form = element.current;
        if (!form) return;
        const values = formDataToObject(new FormData(form, submitter));
        router.visit(url, {
            preserveState: verb !== 'get',
            ...options,
            method: verb,
            data: transform ? transform(values) : values,
            headers,
            errorBag,
            onBefore,
            onCancel,
            onStart: () => {
                setProcessing(true);
                setWasSuccessful(false);
                setRecentlySuccessful(false);
                window.clearTimeout(timer.current);
                onStart?.();
            },
            onSuccess: (page) => {
                if (mounted.current) {
                    setErrors({});
                    setWasSuccessful(true);
                    setRecentlySuccessful(true);
                    timer.current = window.setTimeout(
                        () => mounted.current && setRecentlySuccessful(false),
                        2000,
                    );
                    resetAfter(resetOnSuccess);
                }
                onSuccess?.(page);
            },
            onError: (received) => {
                if (mounted.current) {
                    setErrors(received);
                    resetAfter(resetOnError);
                }
                onError?.(received);
            },
            onFinish: () => {
                if (mounted.current) setProcessing(false);
                onFinish?.();
            },
        });
    };

    const slot: FormSlotProps = {
        errors,
        hasErrors: Object.keys(errors).length > 0,
        processing,
        progress: null,
        wasSuccessful,
        recentlySuccessful,
        isDirty,
        clearErrors,
        resetAndClearErrors: (...fields) => {
            reset(...fields);
            clearErrors(...fields);
        },
        setError: (field, value) =>
            setErrors((previous) => ({ ...previous, [field]: value })),
        reset,
        submit: () => submit(),
    };

    return (
        <form
            ref={element}
            action={url}
            method={verb === 'get' ? 'get' : 'post'}
            inert={disableWhileProcessing && processing}
            {...rest}
            onChange={(event) => {
                setIsDirty(true);
                rest.onChange?.(event);
            }}
            onSubmit={(event) => {
                event.preventDefault();
                submit(
                    (event.nativeEvent as SubmitEvent)
                        .submitter as HTMLElement | null,
                );
            }}
        >
            {typeof children === 'function' ? children(slot) : children}
        </form>
    );
}
