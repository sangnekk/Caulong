import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthVerifyEmail from '@/views/auth/verify-email';

export default laravelPage(AuthVerifyEmail, AuthLayout);
