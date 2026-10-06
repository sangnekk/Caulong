import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminReports from '@/views/admin/reports';

export default laravelPage(AdminReports, AdminLayout);
