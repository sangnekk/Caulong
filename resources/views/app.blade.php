<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: {{ $page['component'] === 'welcome' ? 'oklch(0.145 0.032 262)' : 'oklch(1 0 0)' }};
            }

            {{-- Landing and store keep their own colour in dark mode; otherwise the store flashes dark before it renders. --}}
            @unless ($page['component'] === 'welcome' || str_starts_with($page['component'], 'shop/'))
                html.dark {
                    background-color: oklch(0.145 0 0);
                }
            @endunless
        </style>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        {{-- Under the Vite dev server the CSS loads these from Vite instead, so a preload would go unused. --}}
        @if (! Vite::isRunningHot() && ($page['component'] === 'welcome' || str_starts_with($page['component'], 'shop/')))
            {{-- Landing and store type: Archivo with the Vietnamese subset; italics only on the landing. --}}
            @foreach ($page['component'] === 'welcome' ? ['latin', 'vietnamese', 'italic-latin', 'italic-vietnamese'] : ['latin', 'vietnamese'] as $subset)
                <link rel="preload" href="/fonts/archivo/archivo-v25-{{ $subset }}.woff2" as="font" type="font/woff2" crossorigin>
            @endforeach
        @endif

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
