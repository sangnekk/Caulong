<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\RecommendationController;
use Illuminate\Support\Facades\Route;

Route::get('/products', [CatalogController::class, 'index'])->name('products.index');
Route::get('/products/{product:slug}', [CatalogController::class, 'show'])->name('products.show');
// JSON for the lists a page loads after it is shown (recently viewed, suggestions).
Route::get('/recommendations', RecommendationController::class)->middleware('throttle:60,1,recommendations')->name('recommendations');
