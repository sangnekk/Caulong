import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminEmails from '@/views/admin/emails';

export default laravelPage(AdminEmails, AdminLayout);
