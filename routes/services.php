<?php

use App\Http\Controllers\ServiceOrderController;
use Illuminate\Support\Facades\Route;

// The racket stringing service: its page with the form, and one request's own page (opened by
// the session that made it, its owner's account, or the signed link in its emails).
Route::get('/services', [ServiceOrderController::class, 'index'])->name('services.index');
Route::post('/service-orders', [ServiceOrderController::class, 'store'])->middleware('throttle:6,1,service-orders')->name('service-orders.store')->block();
Route::get('/service-orders/{serviceOrder:public_id}', [ServiceOrderController::class, 'show'])->whereUuid('serviceOrder')->name('service-orders.show');
