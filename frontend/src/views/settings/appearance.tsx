'use client';

import { Head } from '@/lib/page';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    return (
        <>
            <Head title="Giao diện" />

            <h1 className="sr-only">Giao diện</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Giao diện"
                    description="Sáng, tối hoặc theo thiết bị cho các trang tài khoản."
                />
                <AppearanceTabs />
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Giao diện',
            href: editAppearance(),
        },
    ],
};
