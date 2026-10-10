import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminServiceOrder from '@/views/admin/service-order';

export default laravelPage(AdminServiceOrder, AdminLayout);
