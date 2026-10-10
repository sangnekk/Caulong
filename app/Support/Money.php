<?php

namespace App\Support;

/** Amounts in dong, written the way the shop writes them: 1.250.000 ₫. */
final class Money
{
    public static function vnd(int $amount): string
    {
        return number_format($amount, 0, ',', '.').' ₫';
    }
}
