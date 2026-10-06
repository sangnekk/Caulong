import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthConfirmPassword from '@/views/auth/confirm-password';

export default laravelPage(AuthConfirmPassword, AuthLayout);
