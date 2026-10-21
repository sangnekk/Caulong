import ShopLayout from '@/layouts/shop-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { laravelPage } from '@/lib/laravel/page';
import SettingsProfile from '@/views/settings/profile';

export default laravelPage(SettingsProfile, ShopLayout, SettingsLayout);
