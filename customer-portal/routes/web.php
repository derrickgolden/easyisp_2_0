<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CustomerPortalController;


// Route::get('/', function () {
//     return view('welcome');
// });

Route::get('/', [
    CustomerPortalController::class,
    'index'
])->name('customer.portal');

Route::get('/dashboard', [
    CustomerPortalController::class,
    'dashboard'
])->name('customer.dashboard');

Route::get('/packages', [
    CustomerPortalController::class,
    'packages'
])->name('customer.packages');

Route::post('/pay', [
    CustomerPortalController::class,
    'pay'
])->name('customer.pay');

Route::post('/logout', [
    CustomerPortalController::class,
    'logout'
])->name('customer.logout');
