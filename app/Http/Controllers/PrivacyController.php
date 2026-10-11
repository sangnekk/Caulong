<?php

namespace App\Http\Controllers;

use App\Models\CustomerEvent;
use App\Models\EmailLog;
use App\Models\SupportConversation;
use App\Services\SeoService;
use App\Services\ShopSettings;
use App\Support\Frontend;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * What the shop keeps about its customers, why, and for how long. The page states what the
 * code does: its periods come from the same constants the clean-up jobs use, and it mentions
 * a way of paying or a service only while the shop offers it.
 *
 * It speaks in the shop's name, so it is a draft until the owner publishes it in the
 * settings: before that only admins can open it.
 */
class PrivacyController extends Controller
{
    public function __invoke(Request $request, ShopSettings $settings, SeoService $seo): Response
    {
        $published = $settings->privacyPublished();
        abort_unless($published || $request->user()?->can('administer-shop'), 404);
        $contact = $settings->all();

        return Inertia::render('shop/privacy', [
            'published' => $published,
            'policy' => [
                'shop' => (string) config('app.name'),
                'updated' => (string) config('shop.privacy.updated'),
                'contact' => ['hotline' => $contact['hotline'], 'email' => $contact['contact_email'], 'address' => $contact['contact_address']],
                // How long each kind of record is kept, in days.
                'keep' => [
                    'events' => CustomerEvent::KEEP_DAYS,
                    'emails' => EmailLog::KEEP_DAYS,
                    'guest_chats' => SupportConversation::GUEST_KEEP_DAYS,
                    'order_link' => Frontend::ORDER_LINK_DAYS,
                    'chat_code' => (int) config('shop.support.code_days'),
                ],
                // Said only while the shop does it.
                'bank_transfer' => $settings->bankTransfer()['ready'],
                'stringing' => $settings->stringing()['enabled'],
                // Email leaves through a provider only when one is set up; else it is only logged.
                'email_provider' => config('mail.default') === 'resend' ? 'Resend' : null,
                // Sessions kept in the database note the address and browser they come from.
                'session_ip' => config('session.driver') === 'database',
            ],
            'seo' => $seo->privacy($published),
        ]);
    }
}
