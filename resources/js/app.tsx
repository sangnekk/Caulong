import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import {
    installHistoryTransitions,
    pageTransition,
} from '@/lib/page-transition';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import ShopLayout from '@/layouts/shop-layout';
import AdminLayout from '@/layouts/admin-layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Before createInertiaApp, so back/forward reaches this listener ahead of Inertia's.
installHistoryTransitions();

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('shop/'):
                return ShopLayout;
            case name.startsWith('admin/'):
                return AdminLayout;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    defaults: {
        visitOptions: (href, options) => ({
            ...options,
            viewTransition: pageTransition(href, options),
        }),
    },
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#204ca4',
        delay: 250,
    },
});

// This will set light / dark mode on load...
initializeTheme();
