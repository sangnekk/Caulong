import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopServiceOrder from '@/views/shop/service-order';

export default laravelPage(ShopServiceOrder, ShopLayout);
