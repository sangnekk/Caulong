import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminServiceStrings from '@/views/admin/service-strings';

export default laravelPage(AdminServiceStrings, AdminLayout);
