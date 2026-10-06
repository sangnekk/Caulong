import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopCheckout from '@/views/shop/checkout';

export default laravelPage(ShopCheckout, ShopLayout);
