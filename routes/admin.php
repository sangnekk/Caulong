<?php

use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ImportController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\TaxonomyController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', EnsureAdmin::class])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::get('reports', ReportController::class)->name('reports');
    Route::get('settings', [SettingsController::class, 'edit'])->name('settings.edit');
    Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
    Route::post('products/bulk', [ProductController::class, 'bulk'])->name('products.bulk');
    Route::patch('products/{product}/variants', [ProductController::class, 'quick'])->name('products.quick');
    Route::get('orders/export', [OrderController::class, 'export'])->name('orders.export');
    Route::resource('products', ProductController::class)->except(['show', 'destroy']);
    Route::get('taxonomies', [TaxonomyController::class, 'index'])->name('taxonomies.index');
    Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
    Route::post('brands', [TaxonomyController::class, 'brand'])->name('brands.store');
    Route::post('categories', [TaxonomyController::class, 'category'])->name('categories.store');
    Route::get('imports', [ImportController::class, 'index'])->name('imports.index');
    Route::get('imports/template', [ImportController::class, 'template'])->name('imports.template');
    Route::post('imports', [ImportController::class, 'store'])->name('imports.store');
    Route::post('imports/retire-demo', [ImportController::class, 'retireDemo'])->name('imports.retire-demo');
    Route::post('imports/publish-stocked', [ImportController::class, 'publishStocked'])->name('imports.publish-stocked');
    Route::get('imports/{import}', [ImportController::class, 'show'])->whereUuid('import')->name('imports.show');
    Route::post('imports/{import}', [ImportController::class, 'commit'])->whereUuid('import')->name('imports.commit');
    Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
    Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
    Route::patch('orders/{order}', [OrderController::class, 'update'])->name('orders.update');
    Route::post('orders/{order}/collected', [OrderController::class, 'collected'])->name('orders.collected');
});
