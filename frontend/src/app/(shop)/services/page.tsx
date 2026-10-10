import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopServices from '@/views/shop/services';

export default laravelPage(ShopServices, ShopLayout);
