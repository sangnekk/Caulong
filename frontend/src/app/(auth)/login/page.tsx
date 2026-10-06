import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthLogin from '@/views/auth/login';

export default laravelPage(AuthLogin, AuthLayout);
