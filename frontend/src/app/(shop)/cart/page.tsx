import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopCart from '@/views/shop/cart';

export default laravelPage(ShopCart, ShopLayout);
