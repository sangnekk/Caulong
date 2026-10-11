<?php

namespace App\Support;

use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/**
 * The QR code a Vietnamese banking app scans to fill in a transfer (VietQR, NAPAS 247): the
 * receiving bank and account, and for one payment its amount and what to write.
 *
 * The text follows the EMV merchant-presented layout: fields of "id, two-digit length, value",
 * closed by a CRC over everything before it.
 */
class VietQr
{
    /**
     * @param  string  $bin  the receiving bank's six-digit NAPAS code
     * @param  int|null  $amount  dong; null for a code that leaves the amount to the payer
     * @param  string|null  $info  what the transfer says (the payment's reference)
     */
    public static function payload(string $bin, string $account, ?int $amount = null, ?string $info = null): string
    {
        $field = fn (string $id, string $value): string => $id.str_pad((string) strlen($value), 2, '0', STR_PAD_LEFT).$value;
        $receiver = $field('00', 'A000000727')
            .$field('01', $field('00', $bin).$field('01', $account))
            // A transfer to an account (not to a card).
            .$field('02', 'QRIBFTTA');
        $text = $field('00', '01')
            // 12: made for one payment; 11: the same code for every payment.
            .$field('01', $amount !== null ? '12' : '11')
            .$field('38', $receiver)
            .$field('53', '704')
            .($amount !== null ? $field('54', (string) $amount) : '')
            .$field('58', 'VN')
            .($info !== null && $info !== '' ? $field('62', $field('08', $info)) : '')
            .'6304';

        return $text.strtoupper(str_pad(dechex(self::crc($text)), 4, '0', STR_PAD_LEFT));
    }

    /** The code as a picture a page can show in an <img>: an SVG in a data: address. */
    public static function image(string $payload): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle(240, 2, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(0, 0, 0))),
            new SvgImageBackEnd,
        );

        return 'data:image/svg+xml;base64,'.base64_encode(
            (new Writer($renderer))->writeString($payload, ecLevel: ErrorCorrectionLevel::M()),
        );
    }

    /** CRC-16/CCITT-FALSE, as the layout asks for. */
    private static function crc(string $text): int
    {
        $crc = 0xFFFF;
        foreach (str_split($text) as $character) {
            $crc ^= ord($character) << 8;
            for ($bit = 0; $bit < 8; $bit++) {
                $crc = ($crc & 0x8000) !== 0 ? (($crc << 1) ^ 0x1021) & 0xFFFF : ($crc << 1) & 0xFFFF;
            }
        }

        return $crc;
    }
}
