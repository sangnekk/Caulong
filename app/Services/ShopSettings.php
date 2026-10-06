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
    /** The thresholds of the customer groups, as keys of config('shop.segments'). */
    public const SEGMENT_RULES = ['vip_spend', 'inactive_days', 'lost_days', 'new_days', 'potential_events'];

    /** @var array<string, string>|null */
    private ?array $saved = null;

    /**
     * Everything the settings page edits. The group thresholds are saved as "segment_<rule>".
     *
     * @return array{shipping_fee: int, free_shipping_threshold: int, hotline: string, contact_email: string, contact_address: string, contact_chat_url: string, segment_vip_spend: int, segment_inactive_days: int, segment_lost_days: int, segment_new_days: int, segment_potential_events: int}
     */
    public function all(): array
    {
        $segments = $this->segments();

        return [
            'shipping_fee' => $this->shippingFee(),
            'free_shipping_threshold' => $this->freeShippingThreshold(),
            'hotline' => $this->string('hotline'),
            'contact_email' => $this->string('contact_email'),
            'contact_address' => $this->string('contact_address'),
            'contact_chat_url' => $this->string('contact_chat_url'),
            'segment_vip_spend' => $segments['vip_spend'],
            'segment_inactive_days' => $segments['inactive_days'],
            'segment_lost_days' => $segments['lost_days'],
            'segment_new_days' => $segments['new_days'],
            'segment_potential_events' => $segments['potential_events'],
        ];
    }

    /**
     * Where one customer group ends and the next begins (App\Services\CustomerSegmentation).
     *
     * @return array{vip_spend: int, inactive_days: int, lost_days: int, new_days: int, potential_events: int}
     */
    public function segments(): array
    {
        $rule = fn (string $key): int => (int) ($this->saved()['segment_'.$key] ?? config('shop.segments.'.$key));

        return [
            'vip_spend' => $rule('vip_spend'),
            'inactive_days' => $rule('inactive_days'),
            'lost_days' => $rule('lost_days'),
            'new_days' => $rule('new_days'),
            'potential_events' => $rule('potential_events'),
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

    /** @param  array<string, int|string|null>  $values  by the keys of all() */
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
