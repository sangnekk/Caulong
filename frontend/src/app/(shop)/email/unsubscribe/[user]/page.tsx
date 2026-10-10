import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopUnsubscribe from '@/views/shop/unsubscribe';

export default laravelPage(ShopUnsubscribe, ShopLayout);
