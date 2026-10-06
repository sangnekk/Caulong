import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthResetPassword from '@/views/auth/reset-password';

export default laravelPage(AuthResetPassword, AuthLayout);
