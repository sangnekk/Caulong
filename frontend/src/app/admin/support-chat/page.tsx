import AdminLayout from '@/layouts/admin-layout';
import { laravelPage } from '@/lib/laravel/page';
import AdminSupportChat from '@/views/admin/support-chat';

export default laravelPage(AdminSupportChat, AdminLayout);
