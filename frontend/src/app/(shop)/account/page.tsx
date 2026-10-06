import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopAccount from '@/views/shop/account';

export default laravelPage(ShopAccount, ShopLayout);
