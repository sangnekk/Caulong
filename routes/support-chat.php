<?php

use App\Http\Controllers\SupportChatController;
use Illuminate\Support\Facades\Route;

// Each limit names its counter (the third value). Without a name, every limit of a visitor
// counts on one: the open widget asks for new messages every few seconds, and that alone
// would use up what the same visitor may send, or even their checkout.
Route::get('/support-chat/messages', [SupportChatController::class, 'index'])->middleware('throttle:30,1,chat-read')->name('support-chat.messages.index');
Route::get('/support-chat/context', [SupportChatController::class, 'context'])->middleware('throttle:30,1,chat-context')->name('support-chat.context');
Route::post('/support-chat/messages', [SupportChatController::class, 'store'])->middleware('throttle:12,1,chat-send')->name('support-chat.messages.store');
// A finished conversation read again: the code is asked for by whoever is still in it, and
// opens it later for anyone who types it (SupportChatController counts the wrong ones).
Route::post('/support-chat/code', [SupportChatController::class, 'code'])->middleware('throttle:6,1,chat-code')->name('support-chat.code');
Route::post('/support-chat/lookup', [SupportChatController::class, 'lookup'])->middleware('throttle:30,1,chat-lookup')->name('support-chat.lookup');
Route::get('/support-chat/conversations/{conversation}', [SupportChatController::class, 'show'])->whereNumber('conversation')
    ->middleware(['auth', 'throttle:60,1,chat-history'])->name('support-chat.conversations.show');
