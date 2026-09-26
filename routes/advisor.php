<?php

use App\Http\Controllers\AdvisorController;
use Illuminate\Support\Facades\Route;

Route::get('/advisor', [AdvisorController::class, 'index'])->name('advisor.index');
