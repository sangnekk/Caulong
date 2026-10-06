import ShopLayout from '@/layouts/shop-layout';
import { laravelPage } from '@/lib/laravel/page';
import ShopAdvisor from '@/views/shop/advisor';

export default laravelPage(ShopAdvisor, ShopLayout);
