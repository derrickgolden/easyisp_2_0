<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Site;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get dashboard statistics
     */
    public function getStats(Request $request)
    {
        $organizationId = $request->user()->organization_id;
        $now = Carbon::now();
        $days = max((int) $request->query('days', 30), 1);
        $lostMode = $request->query('lost_mode', 'either');

        // Active and online users count
        $activeUsers = Customer::where('organization_id', $organizationId)
            ->where('status', 'active')
            ->count();

        $totalUsers = Customer::where('organization_id', $organizationId)
            ->count();

        $onlineUsers = Customer::where('organization_id', $organizationId)
            ->whereRaw('EXISTS (
                SELECT 1 FROM radius.radacct 
                WHERE radacct.username COLLATE utf8mb4_unicode_ci = customers.radius_username 
                AND acctstoptime IS NULL
            )')
            ->count();

        // Daily revenue (today)
        $dailyRevenue = Payment::where('organization_id', $organizationId)
            ->whereDate('created_at', $now->toDateString())
            ->sum('amount');

        // Offline routers count
        $offlineRouters = Site::where('organization_id', $organizationId)
            ->where('is_online', false)
            ->count();

        // Clients gained by registration date within selected range.
        $windowStart = $now->copy()->subDays($days);
        $clientsGained = Customer::where('organization_id', $organizationId)
            ->where('created_at', '>=', $windowStart)
            ->count();

        // Lost filters:
        // - expired: expiry_date within range and status expired/suspended
        // - offline: no active RADIUS session
        // - either: expired OR offline
        // - both: expired AND offline
        $expiredCondition = function ($query) use ($windowStart, $now) {
            $query->whereIn('status', ['expired', 'suspended'])
                ->whereNotNull('expiry_date')
                ->whereBetween('expiry_date', [$windowStart, $now]);
        };

        $offlineCondition = function ($query) {
            $query->whereRaw('NOT EXISTS (
                SELECT 1 FROM radius.radacct
                WHERE radacct.username COLLATE utf8mb4_unicode_ci = customers.radius_username
                AND acctstoptime IS NULL
            )');
        };

        $clientsLostQuery = Customer::where('organization_id', $organizationId);

        if ($lostMode === 'expired') {
            $clientsLostQuery->where($expiredCondition);
        } elseif ($lostMode === 'offline') {
            $clientsLostQuery->where($offlineCondition);
        } elseif ($lostMode === 'both') {
            $clientsLostQuery->where($expiredCondition)->where($offlineCondition);
        } else {
            $clientsLostQuery->where(function ($query) use ($expiredCondition, $offlineCondition) {
                $query->where($expiredCondition)
                    ->orWhere($offlineCondition);
            });
            $lostMode = 'either';
        }

        $clientsLost = $clientsLostQuery->count();

        return response()->json([
            'total_users' => $totalUsers,
            'active_users' => $activeUsers,
            'online_users' => $onlineUsers,
            'daily_revenue' => $dailyRevenue,
            'offline_routers' => $offlineRouters,
            'clients_gained' => $clientsGained,
            'clients_lost' => $clientsLost,
            'window_days' => $days,
            'lost_mode' => $lostMode,
        ]);
    }

    /**
     * Get revenue data for last 12 months
     */
    public function getRevenueChart(Request $request)
    {
        $organizationId = $request->user()->organization_id;
        $now = Carbon::now();
        $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Get revenue data from database
        $oneYearAgo = $now->copy()->subMonths(11)->startOfMonth();
        $monthlyRevenue = Payment::where('organization_id', $organizationId)
            ->where('created_at', '>=', $oneYearAgo)
            ->select([
                DB::raw('SUM(amount) as total'),
                DB::raw("YEAR(created_at) as year"),
                DB::raw("MONTH(created_at) as month_num")
            ])
            ->groupBy('year', 'month_num')
            ->get()
            ->keyBy(function($item) {
                return $item->year . '-' . $item->month_num;
            });

        // Build complete 12 months array (including months with 0 revenue)
        $last12Months = [];
        for ($i = 11; $i >= 0; $i--) {
            $date = $now->copy()->subMonths($i);
            $month = $date->month;
            $year = $date->year;
            $key = $year . '-' . $month;
            
            $revenue = isset($monthlyRevenue[$key]) ? (float) $monthlyRevenue[$key]->total : 0;
            
            $last12Months[] = [
                'label' => $monthNames[$month - 1],
                'value' => $revenue
            ];
        }

        // Calculate total and growth
        $total = array_sum(array_column($last12Months, 'value'));
        $lastSixMonths = array_sum(array_slice(array_column($last12Months, 'value'), -6));
        $previousSixMonths = array_sum(array_slice(array_column($last12Months, 'value'), 0, 6));
        
        $growth = $previousSixMonths > 0 
            ? (($lastSixMonths - $previousSixMonths) / $previousSixMonths * 100) 
            : 0;

        return response()->json([
            'data' => $last12Months,
            'total' => $total,
            'growth' => round($growth, 1),
        ]);
    }
}
