import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminImport from '@/views/admin/import';

export default laravelPage(AdminImport, AdminLayout);
