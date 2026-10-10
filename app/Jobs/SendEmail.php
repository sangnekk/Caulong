<?php

namespace App\Jobs;

use App\Mail\ResendTransport;
use App\Mail\ShopMail;
use App\Models\EmailLog;
use App\Services\EmailService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Str;
use Symfony\Component\Mime\Message;
use Throwable;

/**
 * Sends one email off the request that caused it, and keeps its row in email_logs true:
 * sent with the provider's id, or failed with the reason once every try is spent.
 */
class SendEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> seconds before the second and third try */
    public array $backoff = [60, 600];

    /**
     * The email as it was queued. Opened only in handle(): a coupon or an order deleted while
     * the email waited then ends as a line in the log, not as a job the worker cannot read.
     */
    public string $mail;

    public function __construct(public int $logId, ShopMail $mail)
    {
        $this->mail = serialize($mail);
    }

    public function handle(Mailer $mailer, EmailService $emails): void
    {
        $log = EmailLog::find($this->logId);
        // Deleted with its account, or already delivered by an earlier try.
        if ($log === null || $log->status === 'sent') {
            return;
        }
        // The customer's choice as it stands now: they may have said stop while this waited.
        if (in_array($log->type, EmailService::MARKETING, true) && ($log->user === null || ! $emails->mayMarketTo($log->user))) {
            $log->update(['status' => 'failed', 'error' => 'Khách đã tắt email ưu đãi trước khi email này được gửi.']);

            return;
        }
        try {
            /** @var ShopMail $mail */
            $mail = unserialize($this->mail);
        } catch (ModelNotFoundException) {
            $log->update(['status' => 'failed', 'error' => 'Mã giảm giá hoặc đơn hàng của email này đã bị xóa trước khi email được gửi.']);

            return;
        }
        $message = $mailer->to($log->recipient)->send($mail)?->getOriginalMessage();
        $log->update([
            'status' => 'sent',
            'sent_at' => now(),
            'error' => null,
            'provider_message_id' => $message instanceof Message
                ? $message->getHeaders()->get(ResendTransport::ID_HEADER)?->getBodyAsString()
                : null,
        ]);
    }

    public function failed(?Throwable $reason): void
    {
        EmailLog::whereKey($this->logId)->where('status', '!=', 'sent')
            ->update(['status' => 'failed', 'error' => Str::limit($reason?->getMessage() ?? 'Không rõ lỗi.', 1000)]);
    }
}
