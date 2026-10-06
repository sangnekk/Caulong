import { Instrument_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '@/css/app.css';

// Admin and account screens; the landing and the store bring Archivo (public/fonts).
const instrumentSans = Instrument_Sans({
    subsets: ['latin', 'latin-ext'],
    weight: ['400', '500', '600'],
    variable: '--font-instrument-sans',
    display: 'swap',
});

export default async function RootLayout({
    children,
}: {
    children: ReactNode;
}) {
    // Set by the appearance settings page; "system" follows the device before first paint.
    const appearance = (await cookies()).get('appearance')?.value ?? 'system';
    return (
        <html
            lang="vi"
            className={`${instrumentSans.variable}${appearance === 'dark' ? ' dark' : ''}`}
            // Pages arrive as HTML before their scripts run; providers.tsx flips this once
            // React has taken over, which is what browser tests wait for before typing.
            data-hydrated="false"
            suppressHydrationWarning
        >
            <head>
                <Script id="appearance" strategy="beforeInteractive">
                    {`(function(){if(${JSON.stringify(appearance)}==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')})()`}
                </Script>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            </head>
            {/* Browser extensions add attributes of their own to <body> before React hydrates
                (ColorZilla: cz-shortcut-listen); those are not a mismatch worth reporting. */}
            <body className="font-sans antialiased" suppressHydrationWarning>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
