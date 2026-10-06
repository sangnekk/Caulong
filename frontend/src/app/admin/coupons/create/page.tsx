import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminCouponForm from '@/views/admin/coupon-form';

export default laravelPage(AdminCouponForm, AdminLayout);
