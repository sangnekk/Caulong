import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { laravelPage } from '@/lib/laravel/page';
import SettingsAppearance from '@/views/settings/appearance';

export default laravelPage(SettingsAppearance, AppLayout, SettingsLayout);
