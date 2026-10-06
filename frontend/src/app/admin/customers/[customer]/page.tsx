import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminCustomer from '@/views/admin/customer';

export default laravelPage(AdminCustomer, AdminLayout);
