import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { laravelPage } from '@/lib/laravel/page';
import SettingsSecurity from '@/views/settings/security';

export default laravelPage(SettingsSecurity, AppLayout, SettingsLayout);
