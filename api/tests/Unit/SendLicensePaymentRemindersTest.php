<?php

namespace Tests\Unit;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SendLicensePaymentRemindersTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'mail.default' => 'array',
        ]);
        DB::purge('sqlite');
        Mail::purge('array');

        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('status')->default('active');
            $table->date('license_reminder_sent_at')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('organization_id');
            $table->boolean('is_super_admin')->default(false);
            $table->string('email')->nullable();
        });

        Schema::create('organization_license_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('organization_id');
            $table->date('snapshot_month');
            $table->decimal('total_amount', 12, 2);
            $table->string('status');
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('organization_license_snapshots');
        Schema::dropIfExists('users');
        Schema::dropIfExists('organizations');

        parent::tearDown();
    }

    public function test_it_reminds_super_admins_daily_until_all_license_bills_are_paid(): void
    {
        DB::table('organizations')->insert([
            'id' => 1,
            'name' => 'North Star ISP',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('users')->insert([
            ['id' => 1, 'organization_id' => 1, 'is_super_admin' => true, 'email' => 'admin@example.com'],
            ['id' => 2, 'organization_id' => 1, 'is_super_admin' => false, 'email' => 'staff@example.com'],
        ]);
        DB::table('organization_license_snapshots')->insert([
            [
                'organization_id' => 1,
                'snapshot_month' => '2026-10-01',
                'total_amount' => 1250,
                'status' => 'billed',
            ],
            [
                'organization_id' => 1,
                'snapshot_month' => '2026-09-01',
                'total_amount' => 900,
                'status' => 'paid',
            ],
        ]);

        Artisan::call('license:send-payment-reminders');
        Artisan::call('license:send-payment-reminders');

        $messages = Mail::mailer()->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $message = $messages->first()->getOriginalMessage();
        $this->assertSame('admin@example.com', $message->getTo()[0]->getAddress());
        $this->assertSame('Unpaid license payment: North Star ISP', $message->getSubject());
        $this->assertStringContainsString('October 2026: 1,250.00', $message->getTextBody());
        $this->assertStringContainsString('Outstanding balance: 1,250.00', $message->getTextBody());

        $this->travel(1)->days();
        Artisan::call('license:send-payment-reminders');
        $this->assertCount(2, Mail::mailer()->getSymfonyTransport()->messages());

        DB::table('organization_license_snapshots')
            ->where('status', 'billed')
            ->update(['status' => 'paid']);
        $this->travel(1)->days();
        Artisan::call('license:send-payment-reminders');

        $this->assertCount(2, Mail::mailer()->getSymfonyTransport()->messages());
    }

    public function test_it_does_not_remind_suspended_organizations(): void
    {
        DB::table('organizations')->insert([
            'id' => 1,
            'name' => 'Suspended ISP',
            'status' => 'suspended',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('users')->insert([
            'id' => 1,
            'organization_id' => 1,
            'is_super_admin' => true,
            'email' => 'admin@example.com',
        ]);
        DB::table('organization_license_snapshots')->insert([
            'organization_id' => 1,
            'snapshot_month' => '2026-10-01',
            'total_amount' => 1250,
            'status' => 'billed',
        ]);

        Artisan::call('license:send-payment-reminders');

        $this->assertCount(0, Mail::mailer()->getSymfonyTransport()->messages());
    }
}
