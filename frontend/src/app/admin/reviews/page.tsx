import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminReviews from '@/views/admin/reviews';

export default laravelPage(AdminReviews, AdminLayout);
