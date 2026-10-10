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
    // Emails that send themselves (App\Services\MarketingAutomation). Each one is off until the
    // owner turns it on in /admin/settings, and goes only to customers who agreed to such email.
    'marketing' => [
        'abandoned_cart' => false,
        // Hours after the last racket went into a cart before the reminder.
        'abandoned_cart_hours' => 24,
        'winback' => false,
        // The coupon a buyer who went quiet is offered: percent off, and days it stays valid.
        'winback_percent' => 10,
        'winback_valid_days' => 14,
        'post_purchase' => false,
        // Days after delivery before the review invitation.
        'post_purchase_days' => 7,
        'vip' => false,
        'vip_percent' => 10,
        'vip_valid_days' => 30,
        // Not in the admin. The most one such coupon takes off, in dong; emails queued per
        // automation per run; days before the same customer may get a "come back" offer again.
        'max_discount' => 300000,
        'batch' => 200,
        'winback_every_days' => 180,
    ],
];
