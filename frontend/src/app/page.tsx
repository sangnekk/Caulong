import type { Metadata } from 'next';
import { laravelPage } from '@/lib/laravel/page';
import Landing from './landing';

// The landing renders in the browser: its title and description are stated here so they
// are in the HTML the server sends (the same words as the page's own <Head>).
export const metadata: Metadata = {
    title: 'Shop Cầu Lông — Hiểu cây vợt trước khi chọn - Shop Cầu Lông',
    description:
        'Xem gần từng phần của một cây vợt cầu lông qua mô hình 3D, rồi chọn vợt hợp với lối chơi của bạn. Thanh toán khi nhận hàng.',
};

export default laravelPage(Landing);
