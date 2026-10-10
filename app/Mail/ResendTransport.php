<?php

namespace App\Mail;

use Illuminate\Support\Facades\Http;
use SensitiveParameter;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Message;
use Symfony\Component\Mime\MessageConverter;
use Throwable;

/**
 * Sends mail through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)
 * with Laravel's own HTTP client, so the shop needs no extra package. Registered as the
 * "resend" mail transport in AppServiceProvider; the key is read from RESEND_API_KEY only.
 */
class ResendTransport extends AbstractTransport
{
    public const ENDPOINT = 'https://api.resend.com/emails';

    /** The header that carries Resend's id for the message once it is sent. */
    public const ID_HEADER = 'X-Resend-Email-ID';

    public function __construct(#[SensitiveParameter] private string $key)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $original = $message->getOriginalMessage();
        if (! $original instanceof Message) {
            throw new TransportException('Resend chỉ nhận email có tiêu đề và nội dung, không nhận thư thô.');
        }
        $email = MessageConverter::toEmail($original);
        $headers = [];
        foreach ($email->getHeaders()->all() as $name => $header) {
            if (! in_array($name, ['from', 'to', 'cc', 'bcc', 'reply-to', 'sender', 'subject', 'content-type'], true)) {
                $headers[$header->getName()] = $header->getBodyAsString();
            }
        }
        $addresses = fn (array $list): array => array_map(fn (Address $address) => $address->toString(), $list);
        // Everyone the envelope names, less the copies: those go in their own fields.
        $copies = array_map(fn (Address $address) => $address->getAddress(), [...$email->getCc(), ...$email->getBcc()]);
        $to = array_values(array_filter(
            $message->getEnvelope()->getRecipients(),
            fn (Address $address) => ! in_array($address->getAddress(), $copies, true),
        ));

        try {
            $response = Http::withToken($this->key)->acceptJson()->timeout(15)->post(self::ENDPOINT, array_filter([
                'from' => $message->getEnvelope()->getSender()->toString(),
                'to' => $addresses($to),
                'cc' => $addresses($email->getCc()),
                'bcc' => $addresses($email->getBcc()),
                'reply_to' => $addresses($email->getReplyTo()),
                'subject' => $email->getSubject(),
                'html' => $email->getHtmlBody(),
                'text' => $email->getTextBody(),
                'headers' => $headers,
            ], fn ($value) => $value !== null && $value !== [] && $value !== ''));
        } catch (Throwable $failure) {
            throw new TransportException('Không kết nối được Resend: '.$failure->getMessage(), 0, $failure);
        }
        $id = $response->json('id');
        if (! $response->successful() || ! is_string($id)) {
            // Resend answers {name, message}; the key is never part of it.
            throw new TransportException('Resend từ chối email ('.$response->status().'): '.($response->json('message') ?? 'không rõ lý do'));
        }

        $message->setMessageId($id);
        $original->getHeaders()->addHeader(self::ID_HEADER, $id);
    }

    public function __toString(): string
    {
        return 'resend';
    }
}
