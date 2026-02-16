<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\SiteController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PayheroPaymentController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\RadiusController;
use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LeadController;
use App\Services\CustomerRadiusService;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Health check route
Route::get('/health', function () {
    return response()->json(['status' => 'OK'], 200);
});

// Public auth routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Public RADIUS routes (for WiFi authentication)
Route::post('/radius/authenticate', [RadiusController::class, 'authenticate']);
Route::get('/radius/config/{username}', [RadiusController::class, 'getConfig']);
Route::post('/radius/verify/{username}', [RadiusController::class, 'verify']);

// Public M-Pesa C2B routes
Route::post('/payments/c2b/validation', [PaymentController::class, 'c2bValidation']);
Route::post('/payments/c2b/confirmation', [PaymentController::class, 'c2bConfirmation']);
Route::post('/payments/payhero/stk/callback', [PayheroPaymentController::class, 'stkCallback']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    
    // Dashboard routes
    Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
    Route::get('/dashboard/revenue-chart', [DashboardController::class, 'getRevenueChart']);
    
    // Organization routes
    Route::get('/organization', [OrganizationController::class, 'index']);
    Route::put('/organization', [OrganizationController::class, 'update']);
    Route::get('/organization/{id}', [OrganizationController::class, 'show']);
    
    // User management
    Route::apiResource('/users', UserController::class);
    
    // Role management
    Route::apiResource('/roles', RoleController::class);
    
    // Lead management
    Route::apiResource('/leads', LeadController::class);
    Route::get('/leads-stats', [LeadController::class, 'stats']);
    
    // Customer management
    Route::apiResource('/customers', CustomerController::class);
    Route::get('/customers/organization', [CustomerController::class, 'getByOrganization']);
    Route::get('/customers/{id}/with-relations', [CustomerController::class, 'showWithRelations']);
    
    // Customer RADIUS sync routes
    Route::get('/customers/{id}/technical-specs', [CustomerRadiusService::class, 'getTechnicalSpecs']);
    Route::post('/customers/{id}/sync-radius', [CustomerController::class, 'syncToRadius']);
    Route::post('/customers/sync-all-radius', [CustomerController::class, 'syncAllToRadius']);
    Route::get('/customers/{id}/radius-status', [CustomerController::class, 'getRadiusStatus']);
    Route::post('/customers/{id}/reset-mac-binding', [CustomerController::class, 'resetMacBinding']);
    
    // Customer pause/resume subscription routes
    Route::post('/customers/{customer}/pause-subscription', [CustomerController::class, 'pauseSubscription']);
    Route::post('/customers/{customer}/resume-subscription', [CustomerController::class, 'resumeSubscription']);
    
    // Package management
    Route::apiResource('/packages', PackageController::class);
    
    // Site management
    Route::apiResource('/sites', SiteController::class);
    Route::get('/sites/{id}/ipam', [SiteController::class, 'getIpamData']);
    
    // Payment management
    Route::post('/payments/payhero/stkpush', [PayheroPaymentController::class, 'stkPush']);
    Route::get('/payments/payhero/check-status', [PaymentController::class, 'checkPaymentStatus']);
    Route::get('/payments/pending', [PaymentController::class, 'pending']);
    Route::get('/payments/customer/{customerId}', [PaymentController::class, 'getByCustomer']);
    Route::post('/payments/{paymentId}/resolve', [PaymentController::class, 'resolvePending']);
    Route::post('/payments/c2b/register-urls', [PaymentController::class, 'registerC2BUrls']);
    Route::apiResource('/payments', PaymentController::class);
    
    // Transaction management
    Route::apiResource('/transactions', TransactionController::class);
    Route::get('/transactions/customer/{customerId}', [TransactionController::class, 'getByCustomer']);
    
    // Ticket management
    Route::apiResource('/tickets', TicketController::class);
    Route::get('/tickets/customer/{customerId}', [TicketController::class, 'getByCustomer']);
    
    // Expense management
    Route::get('/expenses/stats', [ExpenseController::class, 'stats']);
    Route::apiResource('/expenses', ExpenseController::class);
    
    // RADIUS management routes
    Route::get('/radius/wifi-access/{username}', [RadiusController::class, 'getWifiAccess']);
    Route::post('/radius/create-user', [RadiusController::class, 'createUser']);
    Route::put('/radius/update-password/{username}', [RadiusController::class, 'updatePassword']);
    Route::get('/radius/users', [RadiusController::class, 'listUsers']);
    Route::get('/radius/groups', [RadiusController::class, 'listGroups']);
    Route::delete('/radius/user/{username}', [RadiusController::class, 'deleteUser']);
    
    // Customer RADIUS sync routes
    Route::post('/radius/sync-customer/{customerId}', [RadiusController::class, 'syncCustomer']);
    Route::post('/radius/sync-all-customers', [RadiusController::class, 'syncAllCustomers']);
    Route::get('/radius/customer-status/{customerId}', [RadiusController::class, 'getCustomerRadiusStatus']);
    
    // SMS sending route
    Route::post('/sms/send', [SmsController::class, 'send']);

});
