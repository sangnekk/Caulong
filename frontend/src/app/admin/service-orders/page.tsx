import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminServiceOrders from '@/views/admin/service-orders';

export default laravelPage(AdminServiceOrders, AdminLayout);
