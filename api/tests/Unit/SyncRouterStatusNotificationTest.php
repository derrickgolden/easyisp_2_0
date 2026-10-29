<?php

namespace Tests\Unit;

use App\Console\Commands\SyncRouterStatus;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Site;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class SyncRouterStatusNotificationTest extends TestCase
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
            $table->string('failure_key', 64)->nullable()->unique();
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

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('organization_id');
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('admin_notifications_states');
        Schema::dropIfExists('notifications');

        parent::tearDown();
    }

    public function test_site_status_transition_is_saved_for_organization_admins(): void
    {
        DB::table('users')->insert([
            ['id' => 11, 'organization_id' => 42],
            ['id' => 12, 'organization_id' => 42],
            ['id' => 13, 'organization_id' => 99],
        ]);

        $organization = new Organization;
        $organization->id = 42;

        $site = new Site([
            'organization_id' => 42,
            'name' => 'Main office',
            'ip_address' => '192.0.2.10',
            'location' => 'Nairobi',
        ]);
        $site->id = 7;
        $site->setRelation('organization', $organization);

        $command = new SyncRouterStatus;
        $recordNotification = new ReflectionMethod($command, 'recordSiteStatusNotification');
        $recordNotification->invoke($command, $site, false);

        $notification = Notification::query()->firstOrFail();
        $this->assertSame('site_status', $notification->type);
        $this->assertSame('Site offline', $notification->title);
        $this->assertSame([
            'organization_id' => 42,
            'site_id' => 7,
            'site_name' => 'Main office',
            'ip_address' => '192.0.2.10',
            'location' => 'Nairobi',
            'status' => 'offline',
            'severity' => 'critical',
        ], $notification->data);
        $this->assertSame([11, 12], DB::table('admin_notifications_states')
            ->orderBy('admin_id')
            ->pluck('admin_id')
            ->all());
        $this->assertSame(
            [0, 0],
            DB::table('admin_notifications_states')->orderBy('admin_id')->pluck('is_read')->all()
        );
    }
}
