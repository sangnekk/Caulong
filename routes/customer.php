<?php

use App\Http\Controllers\CustomerEventController;
use App\Http\Controllers\MarketingConsentController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\WishlistController;
use Illuminate\Support\Facades\Route;

// What the browser reports once a page is on screen: a product viewed, a search, checkout opened.
Route::post('/events', CustomerEventController::class)->middleware('throttle:60,1')->name('events.store');

// The "stop these emails" link of a promotional email: signed by the shop, no sign-in needed.
Route::get('/email/unsubscribe/{user}', [MarketingConsentController::class, 'show'])->whereNumber('user')->name('email.unsubscribe');
Route::post('/email/unsubscribe/{user}', [MarketingConsentController::class, 'unsubscribe'])->whereNumber('user')
    ->middleware('throttle:10,1')->name('email.unsubscribe.store');

Route::middleware('auth')->group(function () {
    Route::patch('/account/marketing', [MarketingConsentController::class, 'update'])->name('account.marketing');
    Route::post('/wishlist/{product:slug}', [WishlistController::class, 'store'])->middleware('throttle:30,1')->name('wishlist.store')->block();
    Route::delete('/wishlist/{product:slug}', [WishlistController::class, 'destroy'])->middleware('throttle:30,1')->name('wishlist.destroy')->block();
    Route::post('/products/{product:slug}/reviews', [ReviewController::class, 'store'])->middleware('throttle:6,1')->name('products.reviews.store')->block();
});
