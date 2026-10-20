'use client';

import AuthLayoutTemplate from '@/layouts/auth/auth-court-layout';
import { useNoRecording } from '@/lib/analytics';

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
}) {
    useNoRecording();
    return (
        <AuthLayoutTemplate title={title} description={description}>
            {children}
        </AuthLayoutTemplate>
    );
}
