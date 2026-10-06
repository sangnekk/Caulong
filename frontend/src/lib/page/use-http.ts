'use client';

import { useCallback, useState } from 'react';
import { send } from './http';
import type { Href, Method, RequestPayload } from './types';
import { hrefMethod, hrefUrl } from './types';

type Options = { data?: RequestPayload; headers?: Record<string, string> };

/**
 * Inertia's `useHttp` for the requests that are not page visits: Laravel answers with JSON
 * (the two-factor QR code, recovery codes). `submit(route)` resolves with that JSON and
 * rejects when Laravel refuses.
 */
export function useHttp() {
    const [processing, setProcessing] = useState(false);

    const submit = useCallback(
        async (
            first: Method | Exclude<Href, string>,
            second?: string | Options,
            third?: Options,
        ): Promise<unknown> => {
            const [method, url, options] =
                typeof first === 'string'
                    ? [first, second as string, third ?? {}]
                    : [
                          hrefMethod(first) ?? 'get',
                          hrefUrl(first),
                          (second as Options | undefined) ?? {},
                      ];
            setProcessing(true);
            try {
                const response = await send(method, url, options.data, {
                    headers: options.headers,
                    expects: 'json',
                });
                if (!response.ok)
                    throw new Error(
                        `${method.toUpperCase()} ${url}: ${response.status}`,
                    );
                return response.status === 204
                    ? null
                    : await response.json().catch(() => null);
            } finally {
                setProcessing(false);
            }
        },
        [],
    );

    return { submit, processing };
}
