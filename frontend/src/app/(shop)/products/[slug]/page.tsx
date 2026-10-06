import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopProduct from '@/views/shop/product';

export default laravelPage(ShopProduct, ShopLayout);
