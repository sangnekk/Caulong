import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminDashboard from '@/views/admin/dashboard';

export default laravelPage(AdminDashboard, AdminLayout);
