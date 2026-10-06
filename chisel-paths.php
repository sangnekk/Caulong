<?php

return [
    'login' => 'frontend/src/views/auth/login.tsx',
    'register' => 'frontend/src/views/auth/register.tsx',
    'welcome' => 'frontend/src/views/welcome.tsx',
    'profile' => 'frontend/src/views/settings/profile.tsx',
    'security' => 'frontend/src/views/settings/security.tsx',
    'verify_email' => 'frontend/src/views/auth/verify-email.tsx',
    'two_factor_challenge' => 'frontend/src/views/auth/two-factor-challenge.tsx',
    'confirm_password' => 'frontend/src/views/auth/confirm-password.tsx',
    'auth_types' => 'frontend/src/types/auth.ts',

    'two_factor_files' => [
        'frontend/src/components/manage-two-factor.tsx',
        'frontend/src/components/two-factor-setup-modal.tsx',
        'frontend/src/components/two-factor-recovery-codes.tsx',
        'frontend/src/components/ui/input-otp.tsx',
        'frontend/src/hooks/use-two-factor-auth.ts',
    ],

    'two_factor_otp_package' => 'input-otp',

    'passkey_files' => [
        'frontend/src/components/passkey-item.tsx',
        'frontend/src/components/passkey-register.tsx',
        'frontend/src/components/passkey-verify.tsx',
        'frontend/src/components/manage-passkeys.tsx',
    ],
];
