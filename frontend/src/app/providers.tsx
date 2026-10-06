'use client';

import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';

/** What every page sits in: tooltips, toasts, and the light/dark theme the visitor chose. */
export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        initializeTheme();
        document.documentElement.dataset.hydrated = 'true';
    }, []);
    return (
        <TooltipProvider delayDuration={0}>
            {children}
            <Toaster />
        </TooltipProvider>
    );
}
