<?php

namespace App\Http\Controllers;

use App\Services\EasyIspApi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class CustomerPortalController extends Controller
{
    public function __construct(
        protected EasyIspApi $api
    ) {
    }

    /**
     * Entry point from MikroTik.
     *
     * Example:
     * https://aqua.easytech.africa/?ip=10.0.0.200
     */

    public function index(Request $request)
    {
        $ip = $request->query('ip');
        
        
        Log::info('Customer portal accessed', [
            'ip' => $request->ip(),
        ]);
        /*
         * If MikroTik supplies the IP, use it.
         *
         * Otherwise attempt to use the connecting client's IP.
         */
        if (!$ip) {
            $ip = $request->ip();
        }

        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            abort(400, 'Invalid customer IP.');
        }

        try {
            $portalContext = $this->api->customerByIp($ip);
            Log::info('CustomerPortalController: Retrieved customer data', [
                'ip' => $ip,
                'customer' => $portalContext,
            ]);

            if (
                empty($portalContext['success']) ||
                empty($portalContext['data'])
            ) {
                Log::warning('Customer not found', [
                    'ip' => $ip,
                ]);
                return view('customer.not-found');
            }

            $data = $portalContext['data'];
            $subscriber = $data['subscriber'] ?? [];

            if (empty($subscriber['id'])) {
                Log::warning('Portal context resolved without subscriber id', [
                    'ip' => $ip,
                    'subscriber' => $subscriber,
                ]);
                return view('customer.not-found');
            }

            session([
                'customer_id' => (int) $subscriber['id'],
                'customer_ip' => $ip,
                'customer_type' => $subscriber['type'] ?? null,
            ]);

            return redirect()->route('customer.dashboard');

        } catch (Throwable $e) {

            Log::error('Customer portal error', [
                'ip' => $ip,
                'error' => $e->getMessage(),
            ]);

            return view('customer.error');
        }
    }

    public function dashboard(Request $request)
    {
        $customerId = session('customer_id');

        if (!$customerId) {
            return redirect('/');
        }

        try {

            $result = $this->api->customer(
                (int) $customerId
            );

            $customerData = $result['customer'] ?? $result;
            if (!is_array($customerData) || empty($customerData['id'])) {
                session()->flush();

                return redirect('/');
            }

            return view('customer.dashboard', [
                'customer' => $customerData,
                'ip' => session('customer_ip'),
            ]);

        } catch (Throwable $e) {

            Log::error('Customer dashboard error', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
            ]);

            return view('customer.error');
        }
    }

    public function packages()
    {
        $customerId = session('customer_id');

        if (!$customerId) {
            return redirect('/');
        }

        try {

            $customer = $this->api->customer(
                (int) $customerId
            );

            $customerData = $customer['customer'] ?? $customer;
            if (!is_array($customerData) || empty($customerData['id'])) {
                session()->flush();

                return redirect('/');
            }

            $siteId = $customerData['site_id'] ?? null;

            $packages = $this->api->packages(
                $siteId ? (int) $siteId : null
            );

            Log::info('CustomerPortalController: Retrieved packages', [
                'customer_id' => $customerId,
                'site_id' => $siteId,
                'packages' => $packages,
                'customer' => $customerData,
            ]);

            return view('customer.packages', [
                'customer' => $customerData,
                'packages' => $packages['packages'] ?? [],
            ]);

        } catch (Throwable $e) {

            Log::error('Package loading error', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
            ]);

            return view('customer.error');
        }
    }

    public function pay(Request $request)
    {
        $customerId = session('customer_id');

        if (!$customerId) {
            return redirect('/');
        }

        $validated = $request->validate([
            'package_id' => [
                'required',
                'integer',
            ],
            'account_reference' => [
                'required',
                'string',
                'max:100',
            ],
            'amount' => [
                'required',
                'numeric',
                'min:0',
            ],
            'phone' => [
                'required',
                'string',
                'max:20',
            ],
        ]);

        try {
            Log::info('CustomerPortalController: Payment initiation request', [
            'customer_id' => $customerId,
            'request_data' => $validated,
            ]); 

            $result = $this->api->initiatePayment(
                (int) $customerId,
                (int) $validated['package_id'],
                $validated['phone'],
                $validated['amount'],
                $validated['account_reference']
            );

            return back()->with(
                'success',
                $result['message'] ?? 'Payment request sent.'
            );

        } catch (Throwable $e) {

            Log::error('Payment initiation failed', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
            ]);

            return back()->with(
                'error',
                'Unable to initiate payment. Please try again.'
            );
        }
    }

    public function logout()
    {
        session()->flush();

        return redirect('/');
    }
}