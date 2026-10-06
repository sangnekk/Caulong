import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthForgotPassword from '@/views/auth/forgot-password';

export default laravelPage(AuthForgotPassword, AuthLayout);
