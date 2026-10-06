import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminCoupons from '@/views/admin/coupons';

export default laravelPage(AdminCoupons, AdminLayout);
