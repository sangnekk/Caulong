<?php

namespace App\Support;

/**
 * Text going into a Markdown email. What a customer typed (their name, an address) must not
 * turn into links or headings in a message the shop signs: the views print it with line()
 * inside an HTML block, where Markdown is not read, and Blade escapes the HTML.
 */
final class MailText
{
    /** One line of plain text: no line breaks (a blank line would end the HTML block). */
    public static function line(?string $value, int $limit = 300): string
    {
        return mb_substr(trim((string) preg_replace('/\s+/u', ' ', (string) $value)), 0, $limit);
    }

    /** The shop's own text (a product name) as a table cell or a link's label. */
    public static function cell(?string $value): string
    {
        return str_replace(['|', '[', ']'], ['/', '(', ')'], self::line($value));
    }
}
