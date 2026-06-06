<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\HotspotController;
use App\Http\Controllers\DarajaPaymentController;

Route::get('/', [HotspotController::class, 'portal']);
Route::post('/pay', [DarajaPaymentController::class, 'stkPush']);
Route::post('/daraja/{token}/callback', [DarajaPaymentController::class, 'stkCallback']);
Route::get('/success', [HotspotController::class, 'success']);
