<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Services\EmailService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Every email the shop sent or tried to: what, to whom, when, and what went wrong. */
class EmailController extends Controller
{
    /** Queued for longer than this, an email says the queue worker is not running. */
    private const STALLED_MINUTES = 10;

    public function __invoke(Request $request): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(EmailLog::STATUSES)],
            'type' => ['nullable', Rule::in(EmailService::TYPES)],
            'q' => ['nullable', 'string', 'max:190'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $filters = ['status' => $validated['status'] ?? '', 'type' => $validated['type'] ?? '', 'q' => trim($validated['q'] ?? '')];
        $base = fn (): Builder => EmailLog::query()
            ->when($filters['type'], fn (Builder $query, string $type) => $query->where('type', $type))
            ->when($filters['q'] !== '', fn (Builder $query) => $query->where('recipient', 'like', '%'.mb_strtolower($filters['q']).'%'));

        return Inertia::render('admin/emails', [
            'emails' => $base()->when($filters['status'], fn (Builder $query, string $status) => $query->where('status', $status))
                ->latest('id')->paginate(30)->withQueryString()
                ->through(fn (EmailLog $email) => $email->only([
                    'id', 'type', 'recipient', 'subject', 'status', 'provider_message_id', 'error', 'user_id', 'order_id', 'sent_at', 'created_at',
                ])),
            'filters' => $filters,
            'types' => EmailService::TYPES,
            'counts' => ['all' => $base()->count()] + array_replace(
                array_fill_keys(EmailLog::STATUSES, 0),
                $base()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')->map(fn ($total) => (int) $total)->all(),
            ),
            // How mail leaves this server: "log" and "array" write it down instead of sending it.
            'mailer' => (string) config('mail.default'),
            'stalled' => EmailLog::query()->where('status', 'queued')->where('created_at', '<', now()->subMinutes(self::STALLED_MINUTES))->count(),
        ]);
    }
}
