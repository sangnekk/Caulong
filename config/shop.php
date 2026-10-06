<?php

return [
    'shipping_fee' => 30000,
    'free_shipping_threshold' => 1000000,
    // Reports count days in the shop's own time; the database stays in UTC.
    'timezone' => 'Asia/Ho_Chi_Minh',
    // Customer groups (App\Services\CustomerSegmentation); the owner changes them in /admin/settings.
    'segments' => [
        // Money received from the customer, in dong, from which they are a VIP.
        'vip_spend' => 10000000,
        // Days since the last order after which a buyer is "inactive".
        'inactive_days' => 90,
        // Days without any sign of life (order, visit, sign-up) after which a customer is "lost".
        'lost_days' => 365,
        // Days after sign-up during which an account that has not bought yet is "new".
        'new_days' => 30,
        // Products viewed, saved or put in the cart in the last 30 days that make a non-buyer "potential".
        'potential_events' => 5,
    ],
];
