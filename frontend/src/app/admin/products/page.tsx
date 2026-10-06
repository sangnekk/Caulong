import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminProducts from '@/views/admin/products';

export default laravelPage(AdminProducts, AdminLayout);
