import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminOrder from '@/views/admin/order';

export default laravelPage(AdminOrder, AdminLayout);
