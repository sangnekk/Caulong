import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminStaff from '@/views/admin/staff';

export default laravelPage(AdminStaff, AdminLayout);
