import type { Metadata } from 'next';
import DeliveryDemo from '@/components/delivery-demo';

export const metadata: Metadata = {
    title: 'Một chút nữa, vợt xinh tới rồi | Shop Cầu Lông',
    description:
        'Cùng bé shipper và hộp vợt biết cười đi một chuyến giao hàng nhỏ.',
    robots: { index: false, follow: false },
};

export default function DeliveryDemoPage() {
    return <DeliveryDemo />;
}
