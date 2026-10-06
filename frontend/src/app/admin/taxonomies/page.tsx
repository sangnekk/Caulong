import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminTaxonomies from '@/views/admin/taxonomies';

export default laravelPage(AdminTaxonomies, AdminLayout);
