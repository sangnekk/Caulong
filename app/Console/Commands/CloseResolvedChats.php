<?php

namespace App\Console\Commands;

use App\Services\SupportChat;
use Illuminate\Console\Command;

class CloseResolvedChats extends Command
{
    protected $signature = 'support:close-resolved';

    protected $description = 'Đóng các cuộc trò chuyện hỗ trợ đã được đánh dấu giải quyết mà khách không nhắn tiếp (chạy mỗi ngày theo lịch)';

    public function handle(SupportChat $chat): int
    {
        $this->info('Đã đóng '.$chat->closeResolved().' cuộc trò chuyện.');

        return self::SUCCESS;
    }
}
