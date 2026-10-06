import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminOrders from '@/views/admin/orders';

export default laravelPage(AdminOrders, AdminLayout);
