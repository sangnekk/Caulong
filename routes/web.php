<?php

use App\Http\Controllers\AccountController;
use App\Http\Responses\SignedInResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// Fortify's home after verification or passkey sign-in: no page of its own, just the right place.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', fn (Request $request) => redirect()->to(SignedInResponse::home($request)))->name('dashboard');
});

// The customer's account. Not behind "verified": after changing email they still need it.
Route::middleware('auth')->group(function () {
    Route::get('account', [AccountController::class, 'show'])->name('account');
    Route::patch('account', [AccountController::class, 'update'])->name('account.update');
    Route::put('account/password', [AccountController::class, 'password'])->middleware('throttle:6,1')->name('account.password');
});

require __DIR__.'/settings.php';
require __DIR__.'/catalog.php';
require __DIR__.'/checkout.php';
require __DIR__.'/admin.php';
require __DIR__.'/advisor.php';
