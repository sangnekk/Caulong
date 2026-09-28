import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
/* @chisel-registration */
import { register } from '@/routes';
/* @end-chisel-registration */
import { store } from '@/routes/login';
import { request } from '@/routes/password';
/* @chisel-passkeys */
import PasskeyVerify from '@/components/passkey-verify';
/* @end-chisel-passkeys */

type LocalAccount = {
    email: string;
    password: string;
    name: string;
    role: string;
};

type Props = {
    status?: string;
    canResetPassword: boolean;
    /** Only sent when APP_ENV=local. */
    localAccounts?: LocalAccount[];
};

/** Fill the (uncontrolled) login form and submit it, as if typed. */
function signInAs(account: LocalAccount) {
    const email = document.getElementById('email') as HTMLInputElement | null;
    const password = document.getElementById(
        'password',
    ) as HTMLInputElement | null;
    if (!email || !password) return;
    email.value = account.email;
    password.value = account.password;
    email.form?.requestSubmit();
}

export default function Login({
    status,
    canResetPassword,
    localAccounts = [],
}: Props) {
    return (
        <>
            <Head title="Đăng nhập" />

            {localAccounts.length > 0 && (
                <section
                    aria-labelledby="local-accounts-title"
                    className="mb-6 rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-950"
                >
                    <h2 id="local-accounts-title" className="font-semibold">
                        Tài khoản dùng thử
                    </h2>
                    <p className="mt-0.5 text-xs text-amber-900">
                        Chỉ hiện khi chạy local (APP_ENV=local). Mật khẩu:{' '}
                        <code className="font-mono whitespace-nowrap">
                            {localAccounts[0].password}
                        </code>
                    </p>
                    <ul className="mt-2 grid gap-2">
                        {localAccounts.map((account) => (
                            <li
                                key={account.email}
                                className="flex items-center justify-between gap-3"
                            >
                                <span className="min-w-0">
                                    <strong className="block">
                                        {account.role}
                                    </strong>
                                    <span className="block truncate font-mono text-xs">
                                        {account.email}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 bg-white"
                                    onClick={() => signInAs(account)}
                                >
                                    Đăng nhập
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* @chisel-passkeys */}
            <PasskeyVerify
                label="Đăng nhập bằng passkey"
                loadingLabel="Đang xác thực…"
                separator="Hoặc đăng nhập bằng email"
            />
            {/* @end-chisel-passkeys */}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Địa chỉ email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Mật khẩu</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm"
                                            tabIndex={5}
                                        >
                                            Quên mật khẩu?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Mật khẩu"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">Ghi nhớ tôi</Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Đăng nhập
                            </Button>
                        </div>

                        {/* @chisel-registration */}
                        <div className="text-center text-sm text-muted-foreground">
                            Chưa có tài khoản?{' '}
                            <TextLink href={register()} tabIndex={5}>
                                Đăng ký
                            </TextLink>
                        </div>
                        {/* @end-chisel-registration */}
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}
        </>
    );
}

Login.layout = {
    title: 'Đăng nhập vào tài khoản của bạn',
    description: 'Nhập email và mật khẩu bên dưới để đăng nhập',
};
