import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopOrder from '@/views/shop/order';

export default laravelPage(ShopOrder, ShopLayout);
