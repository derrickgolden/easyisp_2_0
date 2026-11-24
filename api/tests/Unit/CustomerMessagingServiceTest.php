<?php

namespace Tests\Unit;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\Organization;
use App\Services\CustomerMessagingService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class CustomerMessagingServiceTest extends TestCase
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

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('organization_id');
        });

        Schema::create('admin_notifications_states', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_id');
            $table->uuid('notification_id');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['admin_id', 'notification_id']);
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_notifications_states');
        Schema::dropIfExists('users');
        Schema::dropIfExists('notifications');
        parent::tearDown();
    }

    public function test_message_failures_are_counted_by_client_and_reason(): void
    {
        DB::table('users')->insert([
            ['id' => 21, 'organization_id' => 42],
            ['id' => 22, 'organization_id' => 42],
            ['id' => 23, 'organization_id' => 99],
        ]);

        $service = new CustomerMessagingService;
        $recordFailure = new ReflectionMethod($service, 'recordMessageFailure');

        $clientOne = new Customer;
        $clientOne->id = 12;
        $clientOne->organization_id = 42;
        $clientTwo = new Customer;
        $clientTwo->id = 13;
        $clientTwo->organization_id = 99;

        $recordFailure->invoke($service, $clientOne, 'Provider rejected message');
        $recordFailure->invoke($service, $clientOne, 'Provider rejected message');
        $recordFailure->invoke($service, $clientOne, 'Invalid phone number');
        $recordFailure->invoke($service, $clientTwo, 'Provider rejected message');

        $this->assertSame(3, Notification::query()->count());
        $group = Notification::query()
            ->where('failure_key', hash('sha256', json_encode(
                ['12', 'Provider rejected message'],
                JSON_THROW_ON_ERROR
            )))
            ->firstOrFail();

        $this->assertSame('message_failure', $group->type);
        $this->assertSame('Provider rejected message', $group->body);
        $this->assertSame([
            'organization_id' => 42,
            'client_id' => 12,
            'failed_count' => 2,
            'severity' => 'warning',
        ], $group->data);
        $this->assertSame([21, 22], DB::table('admin_notifications_states')
            ->where('notification_id', $group->id)
            ->orderBy('admin_id')
            ->pluck('admin_id')
            ->all());
    }

    public function test_expiry_notification_is_emailed_through_the_organizations_resend_config(): void
    {
        Http::fake([
            'api.resend.com/emails' => Http::response(['id' => 'email-123']),
        ]);

        $customer = $this->makeExpiryCustomer('subscriber@example.com', [
            'provider' => 'resend',
            'api_key' => 'isp-resend-key',
            'from_address' => 'notices@isp.example',
            'from_name' => 'Example ISP',
        ]);

        (new CustomerMessagingService)->send(
            $customer,
            CustomerMessagingService::TYPE_EXPIRY_NOTIFICATION,
            ['{Expiry}' => 'Nov 24, 2026 9:00 AM']
        );

        Http::assertSent(function ($request): bool {
            return $request->url() === 'https://api.resend.com/emails'
                && $request->hasHeader('Authorization', 'Bearer isp-resend-key')
                && $request['from'] === 'Example ISP <notices@isp.example>'
                && $request['to'] === ['subscriber@example.com']
                && $request['subject'] === 'Your internet subscription has expired'
                && str_contains($request['text'], 'Nov 24, 2026 9:00 AM');
        });
    }

    public function test_expiry_email_is_skipped_without_a_customer_email_or_resend_configuration(): void
    {
        Http::fake();

        $withNoEmail = $this->makeExpiryCustomer(null, [
            'provider' => 'resend',
            'api_key' => 'isp-resend-key',
            'from_address' => 'notices@isp.example',
        ]);
        $withNoResendConfig = $this->makeExpiryCustomer('subscriber@example.com', []);
        $preExpiryWarning = $this->makeExpiryCustomer('subscriber@example.com', [
            'provider' => 'resend',
            'api_key' => 'isp-resend-key',
            'from_address' => 'notices@isp.example',
        ]);

        $service = new CustomerMessagingService;
        $service->send($withNoEmail, CustomerMessagingService::TYPE_EXPIRY_NOTIFICATION);
        $service->send($withNoResendConfig, CustomerMessagingService::TYPE_EXPIRY_NOTIFICATION);
        $service->send($preExpiryWarning, CustomerMessagingService::TYPE_EXPIRY_WARNING);

        Http::assertNothingSent();
    }

    private function makeExpiryCustomer(?string $email, array $emailSettings): Customer
    {
        $organization = new Organization;
        $organization->id = 42;
        $organization->name = 'Example ISP';
        $organization->settings = ['email-gateway' => $emailSettings];

        $customer = new Customer([
            'organization_id' => 42,
            'first_name' => 'Jane',
            'last_name' => 'Subscriber',
            'email' => $email,
        ]);
        $customer->id = random_int(1, 100000);
        $customer->setRelation('organization', $organization);
        $customer->setRelation('package', null);

        return $customer;
    }
}
