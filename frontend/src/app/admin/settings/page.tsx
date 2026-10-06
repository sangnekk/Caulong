import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminSettings from '@/views/admin/settings';

export default laravelPage(AdminSettings, AdminLayout);
