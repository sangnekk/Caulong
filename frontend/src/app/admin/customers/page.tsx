import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminCustomers from '@/views/admin/customers';

export default laravelPage(AdminCustomers, AdminLayout);
