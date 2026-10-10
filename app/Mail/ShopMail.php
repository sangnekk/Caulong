<?php

namespace App\Mail;

use App\Models\User;
use App\Support\Frontend;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

/**
 * An email of the shop: a subject and a Markdown view (resources/views/emails). Sent through
 * App\Services\EmailService, which queues it and keeps the record.
 */
abstract class ShopMail extends Mailable
{
    use Queueable, SerializesModels;

    /** The subject line. */
    abstract public function title(): string;

    /**
     * The view and what it shows, worked out when the email is sent (not when it is queued).
     *
     * @return array{0: view-string, 1: array<string, mixed>}
     */
    abstract protected function body(): array;

    /** The customer a promotional email is for: it then carries their way to stop them. */
    protected function subscriber(): ?User
    {
        return null;
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->title());
    }

    public function content(): Content
    {
        [$view, $data] = $this->body();
        $subscriber = $this->subscriber();

        return new Content(markdown: $view, with: [...$data, 'unsubscribe' => $subscriber ? Frontend::unsubscribe($subscriber) : null]);
    }

    public function headers(): Headers
    {
        $subscriber = $this->subscriber();

        return new Headers(text: $subscriber ? ['List-Unsubscribe' => '<'.Frontend::unsubscribe($subscriber).'>'] : []);
    }
}
