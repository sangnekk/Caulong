<?php

namespace App\Support;

use App\Models\Order;
use App\Models\Product;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Support\Facades\URL;

/**
 * Links into the storefront (the Next.js app at FRONTEND_URL) for places with no request to
 * build them from: emails sent by the queue worker.
 */
final class Frontend
{
    /** How long the order link in an email opens the order without signing in. */
    public const ORDER_LINK_DAYS = 60;

    public static function url(string $path = '/'): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/'.ltrim($path, '/');
    }

    public static function product(Product $product, string $fragment = ''): string
    {
        return self::url('/products/'.$product->slug).($fragment === '' ? '' : '#'.$fragment);
    }

    /**
     * The order page, opened by the signature in the link alone: whoever reads the email on
     * another device, or placed the order without an account, can still follow their order.
     * Signed without the host, because the storefront and Laravel answer on different ones.
     */
    public static function order(Order $order): string
    {
        return self::url(URL::temporarySignedRoute(
            'orders.show', now()->addDays(self::ORDER_LINK_DAYS), ['order' => $order->public_id], absolute: false,
        ));
    }

    /** A stringing request's page, opened the same way: by the signature, for as long. */
    public static function serviceOrder(ServiceOrder $order): string
    {
        return self::url(URL::temporarySignedRoute(
            'service-orders.show', now()->addDays(self::ORDER_LINK_DAYS), ['serviceOrder' => $order->public_id], absolute: false,
        ));
    }

    /** Where a customer stops promotional email, without having to sign in. */
    public static function unsubscribe(User $user): string
    {
        return self::url(URL::signedRoute('email.unsubscribe', ['user' => $user->id], absolute: false));
    }
}
