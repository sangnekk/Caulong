import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopProducts from '@/views/shop/products';

export default laravelPage(ShopProducts, ShopLayout);
