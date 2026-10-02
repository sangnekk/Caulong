<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;

/**
 * Settings the shop owner controls from the admin. Defaults come from config/shop.php, so a
 * fresh install behaves exactly as before anything is saved.
 */
class ShopSettings
{
    /** @var array<string, string>|null */
    private ?array $saved = null;

    /** @return array{shipping_fee: int, free_shipping_threshold: int, hotline: string, contact_email: string, contact_address: string, contact_chat_url: string} */
    public function all(): array
    {
        return [
            'shipping_fee' => $this->shippingFee(),
            'free_shipping_threshold' => $this->freeShippingThreshold(),
            'hotline' => $this->string('hotline'),
            'contact_email' => $this->string('contact_email'),
            'contact_address' => $this->string('contact_address'),
            'contact_chat_url' => $this->string('contact_chat_url'),
        ];
    }

    public function shippingFee(): int
    {
        return (int) ($this->saved()['shipping_fee'] ?? config('shop.shipping_fee'));
    }

    public function freeShippingThreshold(): int
    {
        return (int) ($this->saved()['free_shipping_threshold'] ?? config('shop.free_shipping_threshold'));
    }

    /** @param  array{shipping_fee: int, free_shipping_threshold: int, hotline: ?string, contact_email: ?string, contact_address: ?string, contact_chat_url: ?string}  $values */
    public function save(array $values): void
    {
        foreach ($values as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => (string) ($value ?? '')]);
        }
        $this->saved = null;
    }

    private function string(string $key): string
    {
        return $this->saved()[$key] ?? '';
    }

    /** @return array<string, string> */
    private function saved(): array
    {
        // Before the migration has run (fresh clone, some tests) the defaults apply.
        return $this->saved ??= Schema::hasTable('settings')
            ? Setting::query()->pluck('value', 'key')->map(fn ($value) => (string) $value)->all()
            : [];
    }
}
