<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = Notification::query()
            ->join('admin_notifications_states', 'notifications.id', '=', 'admin_notifications_states.notification_id')
            ->where('admin_notifications_states.admin_id', $request->user()->id)
            ->orderByDesc('notifications.created_at')
            ->limit(50)
            ->get([
                'notifications.id',
                'notifications.type',
                'notifications.title',
                'notifications.body',
                'notifications.data',
                'notifications.created_at',
                'admin_notifications_states.is_read',
                'admin_notifications_states.read_at',
            ]);

        return response()->json(['data' => $notifications]);
    }

    public function markAsRead(Request $request, string $id)
    {
        $updated = DB::table('admin_notifications_states')
            ->where('admin_id', $request->user()->id)
            ->where('notification_id', $id)
            ->update([
                'is_read' => true,
                'read_at' => now(),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Notification not found.'], 404);
        }

        return response()->json(['message' => 'Notification marked as read.']);
    }

    public function markAllAsRead(Request $request)
    {
        $updated = DB::table('admin_notifications_states')
            ->where('admin_id', $request->user()->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' => 'All notifications marked as read.',
            'updated_count' => $updated,
        ]);
    }
}
