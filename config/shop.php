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
    // The racket stringing service (App\Services\StringingService). The strings and their prices
    // are the shop's own list in /admin/service-strings: none are made up here.
    'stringing' => [
        // Whether requests are taken online; the owner switches it in /admin/settings.
        'enabled' => true,
        // Dong for stringing one racket, besides the string. 0: told when the racket is handed in.
        'fee' => 0,
        // The tensions the form takes, in kg, in steps of half a kilogram.
        'tension_min' => 8,
        'tension_max' => 15,
        // How many rackets one request can hold, and how far ahead a visit can be planned.
        'max_rackets' => 10,
        'book_ahead_days' => 30,
    ],
    // Paying by bank transfer before delivery (App\Services\PaymentService). The account is the
    // owner's, entered in /admin/settings: none is made up here, and until there is one the
    // checkout offers cash on delivery only. The shop confirms each transfer by hand.
    'bank_transfer' => [
        'enabled' => false,
        // Hours an order waits for its transfer, goods held, before it is cancelled.
        'hold_hours' => 24,
    ],
    // Banks a transfer by QR code (VietQR) can go to, by their NAPAS code. As published at
    // api.vietqr.io/v2/banks on 2026-10-11, banks that receive such transfers only.
    'banks' => [
        '970436' => 'Vietcombank',
        '970415' => 'VietinBank',
        '970418' => 'BIDV',
        '970405' => 'Agribank',
        '970407' => 'Techcombank',
        '970422' => 'MB Bank',
        '970416' => 'ACB',
        '970432' => 'VPBank',
        '970423' => 'TPBank',
        '970403' => 'Sacombank',
        '970437' => 'HDBank',
        '970441' => 'VIB',
        '970443' => 'SHB',
        '970431' => 'Eximbank',
        '970426' => 'MSB',
        '970448' => 'OCB',
        '970440' => 'SeABank',
        '970449' => 'LPBank',
        '970428' => 'Nam A Bank',
        '970425' => 'ABBANK',
        '970409' => 'Bac A Bank',
        '970412' => 'PVcomBank',
        '970429' => 'SCB',
        '970454' => 'BVBank (Bản Việt)',
        '970452' => 'KienlongBank',
        '970400' => 'Saigonbank',
        '970438' => 'BaoViet Bank',
        '970419' => 'NCB',
        '970430' => 'PGBank',
        '970427' => 'VietABank',
        '970433' => 'VietBank',
        '970414' => 'MBV',
        '970446' => 'Co-opBank',
        '970424' => 'Shinhan Bank',
        '970457' => 'Woori Bank',
        '422589' => 'CIMB',
        '668888' => 'KBank',
        '546034' => 'CAKE by VPBank',
        '546035' => 'Ubank by VPBank',
        '963388' => 'Timo',
    ],
    // Search engines (App\Services\SeoService). Only the live site may be indexed: a copy on a
    // developer's machine or a staging server tells them to stay away (robots.txt and a
    // "noindex" on every page). SHOP_SEO_INDEX overrides the guess from APP_ENV.
    'seo' => [
        'index' => (bool) env('SHOP_SEO_INDEX', env('APP_ENV') === 'production'),
    ],
    // The support chat (App\Services\SupportChat).
    'support' => [
        // Days a conversation staff marked as solved waits for the customer before it closes itself.
        'resolved_days' => 3,
        // Days the code for reading a finished conversation again stays good.
        'code_days' => 30,
    ],
];
