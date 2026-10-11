<?php

namespace App\Services;

use App\Jobs\SendEmail;
use App\Mail\CouponMail;
use App\Mail\OrderMail;
use App\Mail\ProductsMail;
use App\Mail\ResendTransport;
use App\Mail\ServiceOrderMail;
use App\Mail\ShopMail;
use App\Mail\WelcomeMail;
use App\Models\Coupon;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Support\DemoData;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Mail\Events\MessageSent;
use InvalidArgumentException;

/**
 * Every email of the shop goes out through here: recorded in email_logs first, then sent by
 * the queue worker (App\Jobs\SendEmail), never inside the customer's request.
 *
 * An email is never the reason an order or a sign-up fails: whatever goes wrong here is
 * reported and the caller carries on.
 */
class EmailService
{
    /** About something the customer did: sent whenever there is an address to send to. */
    public const TRANSACTIONAL = [
        'welcome', 'order_placed', 'order_paid', 'order_shipped', 'order_delivered', 'order_cancelled', 'coupon',
        'service_placed', 'service_ready', 'service_cancelled',
    ];

    /** Promotional: only to customers who agreed to it, each with a link to stop. */
    public const MARKETING = ['abandoned_cart', 'winback', 'post_purchase', 'vip'];

    /** Sent by Laravel's own account notifications; only recorded here (record()). */
    public const ACCOUNT = ['verify_email', 'reset_password'];

    public const TYPES = [...self::TRANSACTIONAL, ...self::MARKETING, ...self::ACCOUNT];

    /**
     * Records the email and hands it to the queue. Null when it is not sent: no usable
     * address, a sample customer, or a promotional email the customer did not ask for.
     */
    public function send(string $type, ?string $recipient, ShopMail $mail, ?User $user = null, ?Order $order = null): ?EmailLog
    {
        if (! in_array($type, [...self::TRANSACTIONAL, ...self::MARKETING], true)) {
            throw new InvalidArgumentException("Unknown email type: {$type}");
        }
        $recipient = mb_strtolower(trim((string) $recipient));
        if (filter_var($recipient, FILTER_VALIDATE_EMAIL) === false || str_ends_with($recipient, '@'.DemoData::EMAIL_DOMAIN)) {
            return null;
        }
        if (in_array($type, self::MARKETING, true) && ($user === null || ! $this->mayMarketTo($user))) {
            return null;
        }

        return rescue(function () use ($type, $recipient, $mail, $user, $order): EmailLog {
            $log = EmailLog::create([
                'type' => $type,
                'recipient' => $recipient,
                'subject' => $mail->title(),
                'user_id' => $user?->id,
                'order_id' => $order?->id,
            ]);
            SendEmail::dispatch($log->id, $mail);

            return $log;
        });
    }

    /** Promotional email needs the customer's yes, a verified address, and a customer account. */
    public function mayMarketTo(User $user): bool
    {
        return ! $user->is_admin && $user->marketing_opt_in_at !== null && $user->hasVerifiedEmail();
    }

    public function welcome(User $user): ?EmailLog
    {
        return $this->send('welcome', $user->email, new WelcomeMail($user), $user);
    }

    /**
     * To whoever placed the order: the address they gave at checkout, else their account's.
     * Sample orders are not real transactions and send nothing.
     *
     * @param  value-of<OrderMail::STAGES>  $stage
     */
    public function order(Order $order, string $stage): ?EmailLog
    {
        if ($order->is_demo) {
            return null;
        }
        $user = $order->user_id === null ? null : User::find($order->user_id);

        return $this->send('order_'.$stage, $order->email ?: $user?->email, new OrderMail($order, $stage), $user, $order);
    }

    /**
     * To whoever asked for the stringing: the address they gave, else their account's.
     *
     * @param  value-of<ServiceOrderMail::STAGES>  $stage
     */
    public function service(ServiceOrder $order, string $stage): ?EmailLog
    {
        $user = $order->user_id === null ? null : User::find($order->user_id);

        return $this->send('service_'.$stage, $order->email ?: $user?->email, new ServiceOrderMail($order, $stage), $user);
    }

    /**
     * A customer's own coupon. A gift is the shop writing to one customer; "winback" and
     * "vip" are promotional and follow the customer's choice about such email.
     */
    public function coupon(Coupon $coupon): ?EmailLog
    {
        $user = $coupon->user;
        $reason = $this->couponReason($coupon);

        return $user === null
            ? null
            : $this->send($reason === 'gift' ? 'coupon' : $reason, $user->email, new CouponMail($coupon, $reason), $user);
    }

    /**
     * Why a customer's coupon is theirs. An automation's offer (campaign "winback" or "vip")
     * stays one when the shop's staff send it again; any other is a gift.
     *
     * @return value-of<CouponMail::REASONS>
     */
    public function couponReason(Coupon $coupon): string
    {
        return in_array($coupon->campaign, CouponMail::REASONS, true) ? $coupon->campaign : 'gift';
    }

    /**
     * @param  value-of<ProductsMail::REASONS>  $reason
     * @param  list<int>  $productIds
     * @param  list<int>  $suggestedIds
     */
    public function products(User $user, string $reason, array $productIds, array $suggestedIds = [], ?Order $order = null): ?EmailLog
    {
        return $this->send($reason, $user->email, new ProductsMail($user, $reason, $productIds, $suggestedIds, $order), $user, $order);
    }

    /**
     * Laravel sends the "verify your address" and "reset your password" emails itself; they
     * are written down here once they have left, so the log holds every email.
     */
    public function record(MessageSent $event): void
    {
        $notification = $event->data['__laravel_notification'] ?? null;
        if (! is_string($notification)) {
            return;
        }
        $type = match (true) {
            is_a($notification, VerifyEmail::class, true) => 'verify_email',
            is_a($notification, ResetPassword::class, true) => 'reset_password',
            default => null,
        };
        if ($type === null) {
            return;
        }
        foreach ($event->message->getTo() as $address) {
            $recipient = mb_strtolower($address->getAddress());
            EmailLog::create([
                'type' => $type,
                'recipient' => $recipient,
                'subject' => (string) $event->message->getSubject(),
                'status' => 'sent',
                'sent_at' => now(),
                'provider_message_id' => $event->message->getHeaders()->get(ResendTransport::ID_HEADER)?->getBodyAsString(),
                'user_id' => User::query()->where('email', $recipient)->value('id'),
            ]);
        }
    }
}
