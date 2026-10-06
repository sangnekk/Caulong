import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminProductForm from '@/views/admin/product-form';

export default laravelPage(AdminProductForm, AdminLayout);
