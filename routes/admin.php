<?php

use App\Http\Controllers\Admin\CouponController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EmailController;
use App\Http\Controllers\Admin\ImportController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\ReviewController;
use App\Http\Controllers\Admin\ServiceOrderController;
use App\Http\Controllers\Admin\ServiceStringController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\Admin\SupportChatController;
use App\Http\Controllers\Admin\TaxonomyController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

// Every staff account (users.is_admin) gets in here. What it may do is its role's (the gates
// in AppServiceProvider): the support inbox is for all staff, the daily work of the shop for
// those who may manage it ("manage-shop"), and its settings, figures, exports and staff for
// its admins ("administer-shop"). Every route outside the inbox carries one of the two.
Route::middleware(['auth', 'verified', EnsureAdmin::class, 'staff.2fa'])->prefix('admin')->name('admin.')->group(function () {
    // Sends support staff on to their inbox, so it is not behind the gate itself.
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::get('support-chat', [SupportChatController::class, 'index'])->name('support-chat.index');
    Route::post('support-chat/{conversation}/claim', [SupportChatController::class, 'claim'])->whereNumber('conversation')->name('support-chat.claim');
    Route::post('support-chat/{conversation}/reply', [SupportChatController::class, 'reply'])->whereNumber('conversation')->name('support-chat.reply');
    Route::post('support-chat/{conversation}/resolve', [SupportChatController::class, 'resolve'])->whereNumber('conversation')->name('support-chat.resolve');
    Route::post('support-chat/{conversation}/close', [SupportChatController::class, 'close'])->whereNumber('conversation')->name('support-chat.close');
    // A ticket handed back to the inbox, by whoever holds it or by an admin for them.
    Route::post('support-chat/{conversation}/release', [SupportChatController::class, 'release'])->whereNumber('conversation')->name('support-chat.release');

    Route::middleware('can:administer-shop')->group(function () {
        Route::get('reports', ReportController::class)->name('reports');
        Route::get('settings', [SettingsController::class, 'edit'])->name('settings.edit');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
        // Every order with its customer's name, phone and address in one file.
        Route::get('orders/export', [OrderController::class, 'export'])->name('orders.export');
        // Who may get into /admin at all: asked for the password again first, as the
        // account's own security settings are.
        Route::middleware(RequirePassword::class)->group(function () {
            Route::get('staff', [StaffController::class, 'index'])->name('staff.index');
            Route::post('staff', [StaffController::class, 'store'])->name('staff.store');
            Route::patch('staff/{user}', [StaffController::class, 'update'])->whereNumber('user')->name('staff.update');
            Route::delete('staff/{user}', [StaffController::class, 'destroy'])->whereNumber('user')->name('staff.destroy');
        });
    });

    Route::middleware('can:manage-shop')->group(function () {
        Route::post('products/bulk', [ProductController::class, 'bulk'])->name('products.bulk');
        Route::patch('products/{product}/variants', [ProductController::class, 'quick'])->name('products.quick');
        Route::resource('products', ProductController::class)->except(['show', 'destroy']);
        Route::get('taxonomies', [TaxonomyController::class, 'index'])->name('taxonomies.index');
        Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::get('customers/{user}', [CustomerController::class, 'show'])->whereNumber('user')->name('customers.show');
        Route::get('coupons', [CouponController::class, 'index'])->name('coupons.index');
        Route::get('coupons/create', [CouponController::class, 'create'])->name('coupons.create');
        Route::get('coupons/products', [CouponController::class, 'products'])->middleware('throttle:60,1,admin-coupon-products')->name('coupons.products');
        Route::post('coupons', [CouponController::class, 'store'])->name('coupons.store');
        Route::get('coupons/{coupon}/edit', [CouponController::class, 'edit'])->whereNumber('coupon')->name('coupons.edit');
        Route::put('coupons/{coupon}', [CouponController::class, 'update'])->whereNumber('coupon')->name('coupons.update');
        Route::delete('coupons/{coupon}', [CouponController::class, 'destroy'])->whereNumber('coupon')->name('coupons.destroy');
        Route::post('coupons/{coupon}/email', [CouponController::class, 'email'])->whereNumber('coupon')->middleware('throttle:10,1,admin-coupon-email')->name('coupons.email');
        Route::get('emails', EmailController::class)->name('emails.index');
        Route::get('reviews', [ReviewController::class, 'index'])->name('reviews.index');
        Route::patch('reviews/{review}', [ReviewController::class, 'update'])->whereNumber('review')->name('reviews.update');
        Route::post('brands', [TaxonomyController::class, 'brand'])->name('brands.store');
        Route::post('categories', [TaxonomyController::class, 'category'])->name('categories.store');
        Route::get('imports', [ImportController::class, 'index'])->name('imports.index');
        Route::get('imports/template', [ImportController::class, 'template'])->name('imports.template');
        Route::post('imports', [ImportController::class, 'store'])->name('imports.store');
        Route::post('imports/retire-demo', [ImportController::class, 'retireDemo'])->name('imports.retire-demo');
        Route::post('imports/publish-stocked', [ImportController::class, 'publishStocked'])->name('imports.publish-stocked');
        Route::get('imports/{import}', [ImportController::class, 'show'])->whereUuid('import')->name('imports.show');
        Route::post('imports/{import}', [ImportController::class, 'commit'])->whereUuid('import')->name('imports.commit');
        Route::get('service-orders', [ServiceOrderController::class, 'index'])->name('service-orders.index');
        Route::get('service-orders/{serviceOrder}', [ServiceOrderController::class, 'show'])->whereNumber('serviceOrder')->name('service-orders.show');
        Route::patch('service-orders/{serviceOrder}', [ServiceOrderController::class, 'update'])->whereNumber('serviceOrder')->name('service-orders.update');
        Route::get('service-strings', [ServiceStringController::class, 'index'])->name('service-strings.index');
        Route::post('service-strings', [ServiceStringController::class, 'store'])->name('service-strings.store');
        Route::put('service-strings/{serviceString}', [ServiceStringController::class, 'update'])->whereNumber('serviceString')->name('service-strings.update');
        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::patch('orders/{order}', [OrderController::class, 'update'])->name('orders.update');
        Route::post('orders/{order}/collected', [OrderController::class, 'collected'])->name('orders.collected');
        // A bank transfer seen in the shop's account, or sent back: the payment must be this order's.
        Route::post('orders/{order}/payments/{payment}/confirm', [OrderController::class, 'paymentReceived'])
            ->whereNumber(['order', 'payment'])->scopeBindings()->name('orders.payments.confirm');
        Route::post('orders/{order}/payments/{payment}/refund', [OrderController::class, 'paymentRefunded'])
            ->whereNumber(['order', 'payment'])->scopeBindings()->name('orders.payments.refund');
    });
});
