import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminImportPreview from '@/views/admin/import-preview';

export default laravelPage(AdminImportPreview, AdminLayout);
