import AuthLayout from '@/layouts/auth-layout';
import { laravelPage } from '@/lib/laravel/page';
import AuthTwoFactorChallenge from '@/views/auth/two-factor-challenge';

export default laravelPage(AuthTwoFactorChallenge, AuthLayout);
