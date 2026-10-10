<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A string the shop strings rackets with (the stringing service). Not a product: it is not
 * sold on its own and has one price, for one racket.
 *
 * @property int $id
 * @property string $name
 * @property string|null $brand
 * @property string|null $gauge
 * @property int $price
 * @property bool $is_active
 */
class ServiceString extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['price' => 'integer', 'is_active' => 'boolean'];
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * The requests that asked for this string.
     *
     * @return HasMany<ServiceOrder, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(ServiceOrder::class);
    }

    /** As customers read it: "Yonex BG65 (0.70 mm)". */
    public function label(): string
    {
        return trim(($this->brand ? $this->brand.' ' : '').$this->name).($this->gauge ? ' ('.$this->gauge.')' : '');
    }
}
