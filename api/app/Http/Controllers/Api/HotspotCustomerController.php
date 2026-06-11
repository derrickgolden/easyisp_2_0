<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HotspotCustomer;
use Illuminate\Http\Request;

class HotspotCustomerController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-customers')->only(['index']);
    }

    public function index(Request $request)
    {
        $perPage = max(1, min((int) $request->query('per_page', 50), 200));

        $customers = HotspotCustomer::query()
            ->where('organization_id', $request->user()->organization_id)
            ->with([
                'site:id,name,ip_address',
                'currentPackage:id,name,price,speed_down,speed_up',
            ])
            ->latest()
            ->paginate($perPage);

        return response()->json($customers);
    }
}
