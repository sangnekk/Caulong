<?php

use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use Illuminate\Support\Facades\Route;

Route::get('/cart', [CartController::class, 'index'])->name('cart.index');
Route::post('/cart/items', [CartController::class, 'store'])->name('cart.store')->block();
Route::patch('/cart/items/{variant}', [CartController::class, 'update'])->whereNumber('variant')->name('cart.update')->block();
Route::delete('/cart/items/{variant}', [CartController::class, 'destroy'])->whereNumber('variant')->name('cart.destroy')->block();
Route::get('/checkout', [CheckoutController::class, 'index'])->name('checkout.index');
Route::post('/checkout', [CheckoutController::class, 'store'])->name('checkout.store')->middleware('throttle:10,1')->block();
Route::get('/orders/{order:public_id}', [CheckoutController::class, 'show'])->whereUuid('order')->name('orders.show');
