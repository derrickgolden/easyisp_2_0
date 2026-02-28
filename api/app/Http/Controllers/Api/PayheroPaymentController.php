<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Payment;
use App\Http\Controllers\Controller;

class PayheroPaymentController extends Controller
{
    //
    private $apiUsername;
    private $apiPassword;
    private $baseUrl = 'https://backend.payhero.co.ke/api/v2/payments';
    
    public function __construct(){
        $this->middleware('permission:stk-push')->only(['stkPush']);
        $this->apiUsername = env('API_USERNAME');
        $this->apiPassword = env('API_PASSWORD');
    }

    private function getBasicAuthToken()
    {
        $credentials = $this->apiUsername . ':' . $this->apiPassword;
        return 'Basic ' . base64_encode($credentials);
    }

    public function stkPush(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'amount' => 'required|numeric|min:1',
        ]);

        try {
            $response =  Http::withOptions([
                'verify' => true, // <- ignore SSL verification
            ])->withHeaders([
                'Authorization' => $this->getBasicAuthToken(),
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl, [
                'amount' => floatval($request->input('amount')),
                'phone_number' => $request->phone,
                'channel_id' => env('CHANNEL_ID'),
                'provider' => 'm-pesa',
                'external_reference' => 'INV-' . now()->timestamp,
                'callback_url' => 'https://ee99-102-210-173-182.ngrok-free.app/api/payments/payhero/stk/callback',
            ]);

            if ($response->successful()) {
                session(['session-details' => $request->phone]);
                Log::info("stk msg" . $response);

                // Payment::create([
                //     'phone' => $request->phone,
                //     'amount' => $request->amount,
                //     'checkout_request_id' => $response['CheckoutRequestID'],
                //     'transaction_status' => 'Pending',
                // ]);

                return response()->json([
                    'success' => true,
                    'message' => 'STK push initiated. Enter PIN to continue.',
                    'data' => $response->json(),
                ]);
            } else {
                Log::error('STK Push error: ' . $response);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to initiate STK push.',
                    'data' => $response->json(),
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('STK Push error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Server Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function stkCallback(Request $request)
    {
        Log::info('Callback Resuest: ', $request->all());
        $status = $request->input('status');
        $response = $request->input('response');

        $checkoutId = $response['CheckoutRequestID'] ?? null;

        if ($status && ($response['ResultCode'] ?? 1) == 0) {
            $amount = $response['Amount'] ?? null;
            $phone = $response['Phone'] ?? null;

            if ($amount && $phone) {
                // Update user's balance
                $user = \DB::table('users')->where('phone', $phone)->first();

                if ($user) {
                    // Assuming your 'balance' column is numeric (e.g., decimal(10,2))
                    \DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'balance' => $user->balance + $amount,
                            'updated_at' => now(),
                    ]);

                    if ($checkoutId) {
                        Payment::where('checkout_request_id', $checkoutId)->update([
                            'transaction_status' => 'Success',
                            'mpesa_receipt_number' => $response['MpesaReceiptNumber'],
                            'payment_time' => now(),
                        ]);
                    }

                }
                return response()->json(['success' => true]);
            }
        } else {
            if ($checkoutId) {
                Payment::where('checkout_request_id', $checkoutId)->update([
                    'transaction_status' => 'Failed',
                    'mpesa_receipt_number' => $response['MpesaReceiptNumber'] ?? null,
                    'payment_time' => now(),
                ]);
            }
        }

        // Log failed or incomplete transactions
        Log::info('Failed STK callback: ', $request->all());

        return response()->json(['success' => false]);
    }

}
