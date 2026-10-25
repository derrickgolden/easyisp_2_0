<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\NotificationController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
        ]);
        DB::purge('sqlite');

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->string('title');
            $table->text('body');
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::create('admin_notifications_states', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_id');
            $table->uuid('notification_id');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_notifications_states');
        Schema::dropIfExists('notifications');

        parent::tearDown();
    }

    public function test_index_only_returns_notifications_assigned_to_the_authenticated_admin(): void
    {
        DB::table('notifications')->insert([
            [
                'id' => '00000000-0000-4000-8000-000000000001',
                'type' => 'site_status',
                'title' => 'Site offline',
                'body' => 'Site one is offline.',
                'data' => json_encode(['status' => 'offline'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000002',
                'type' => 'site_status',
                'title' => 'Site recovered',
                'body' => 'Site two is online.',
                'data' => json_encode(['status' => 'online'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('admin_notifications_states')->insert([
            [
                'admin_id' => 11,
                'notification_id' => '00000000-0000-4000-8000-000000000001',
                'is_read' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'admin_id' => 22,
                'notification_id' => '00000000-0000-4000-8000-000000000002',
                'is_read' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $admin = new User;
        $admin->id = 11;
        $request = Request::create('/api/notifications');
        $request->setUserResolver(fn () => $admin);

        $response = (new NotificationController)->index($request);

        $this->assertSame(
            ['00000000-0000-4000-8000-000000000001'],
            array_column($response->getData(true)['data'], 'id')
        );
    }

    public function test_mark_as_read_only_updates_the_authenticated_admins_notification_state(): void
    {
        $notificationId = '00000000-0000-4000-8000-000000000001';
        DB::table('admin_notifications_states')->insert([
            [
                'admin_id' => 11,
                'notification_id' => $notificationId,
                'is_read' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'admin_id' => 22,
                'notification_id' => $notificationId,
                'is_read' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $admin = new User;
        $admin->id = 11;
        $request = Request::create("/api/notifications/{$notificationId}/read", 'PATCH');
        $request->setUserResolver(fn () => $admin);

        $response = (new NotificationController)->markAsRead($request, $notificationId);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertDatabaseHas('admin_notifications_states', [
            'admin_id' => 11,
            'notification_id' => $notificationId,
            'is_read' => true,
        ]);
        $this->assertDatabaseHas('admin_notifications_states', [
            'admin_id' => 22,
            'notification_id' => $notificationId,
            'is_read' => false,
        ]);
    }

    public function test_mark_all_as_read_only_updates_the_authenticated_admins_unread_notifications(): void
    {
        DB::table('admin_notifications_states')->insert([
            [
                'admin_id' => 11,
                'notification_id' => '00000000-0000-4000-8000-000000000001',
                'is_read' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'admin_id' => 11,
                'notification_id' => '00000000-0000-4000-8000-000000000002',
                'is_read' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'admin_id' => 22,
                'notification_id' => '00000000-0000-4000-8000-000000000001',
                'is_read' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $admin = new User;
        $admin->id = 11;
        $request = Request::create('/api/notifications/read-all', 'PATCH');
        $request->setUserResolver(fn () => $admin);

        $response = (new NotificationController)->markAllAsRead($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(1, $response->getData(true)['updated_count']);
        $this->assertDatabaseHas('admin_notifications_states', [
            'admin_id' => 11,
            'notification_id' => '00000000-0000-4000-8000-000000000001',
            'is_read' => true,
        ]);
        $this->assertDatabaseHas('admin_notifications_states', [
            'admin_id' => 22,
            'notification_id' => '00000000-0000-4000-8000-000000000001',
            'is_read' => false,
        ]);
    }
}
