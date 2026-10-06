<?php

use App\Http\Controllers\CustomerEventController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\WishlistController;
use Illuminate\Support\Facades\Route;

// What the browser reports once a page is on screen: a product viewed, a search, checkout opened.
Route::post('/events', CustomerEventController::class)->middleware('throttle:60,1')->name('events.store');

Route::middleware('auth')->group(function () {
    Route::post('/wishlist/{product:slug}', [WishlistController::class, 'store'])->middleware('throttle:30,1')->name('wishlist.store')->block();
    Route::delete('/wishlist/{product:slug}', [WishlistController::class, 'destroy'])->middleware('throttle:30,1')->name('wishlist.destroy')->block();
    Route::post('/products/{product:slug}/reviews', [ReviewController::class, 'store'])->middleware('throttle:6,1')->name('products.reviews.store')->block();
});
