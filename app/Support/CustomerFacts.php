<?php

namespace App\Support;

use Carbon\CarbonInterface;

/** What the customer groups are decided from (App\Services\CustomerSegmentation). */
final readonly class CustomerFacts
{
    public function __construct(
        public CarbonInterface $registeredAt,
        /** Orders that were not cancelled. */
        public int $orders = 0,
        /** Money received from them, in dong. */
        public int $spent = 0,
        public ?CarbonInterface $lastOrderAt = null,
        /** Last thing they did in the shop while signed in. */
        public ?CarbonInterface $lastEventAt = null,
        /** Products viewed, saved or put in the cart lately. */
        public int $interest = 0,
    ) {}
}
