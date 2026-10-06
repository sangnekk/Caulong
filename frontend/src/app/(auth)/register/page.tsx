import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthRegister from '@/views/auth/register';

export default laravelPage(AuthRegister, AuthLayout);
