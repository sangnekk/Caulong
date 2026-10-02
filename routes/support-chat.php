<?php

use App\Http\Controllers\SupportChatController;
use Illuminate\Support\Facades\Route;

Route::get('/support-chat/messages', [SupportChatController::class, 'index'])->middleware('throttle:30,1')->name('support-chat.messages.index');
Route::get('/support-chat/context', [SupportChatController::class, 'context'])->middleware('throttle:30,1')->name('support-chat.context');
Route::post('/support-chat/messages', [SupportChatController::class, 'store'])->middleware('throttle:12,1')->name('support-chat.messages.store');
