<?php

namespace Tests\Unit;

use App\Services\RadiusService;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class RadiusOrgIsolationTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_assign_user_to_group_scopes_the_insert_to_organization_id(): void
    {
        $connection = Mockery::mock();
        $query = Mockery::mock();

        DB::shouldReceive('connection')->with('radius')->andReturn($connection);

        $connection->shouldReceive('table')->with('radusergroup')->andReturn($query);
        $query->shouldReceive('where')->with('username', 'shared-user')->once()->andReturnSelf();
        $query->shouldReceive('where')->with('groupname', 'package_7')->once()->andReturnSelf();
        $query->shouldReceive('where')->with('organization_id', 42)->once()->andReturnSelf();
        $query->shouldReceive('first')->once()->andReturnNull();
        $query->shouldReceive('insert')->with([
            'username' => 'shared-user',
            'groupname' => 'package_7',
            'priority' => 1,
            'organization_id' => 42,
        ])->once();

        $service = new RadiusService();
        $service->assignUserToGroup('shared-user', 'package_7', 42);

        $this->assertTrue(true);
    }

    public function test_null_organization_id_is_rejected_for_radius_lookups(): void
    {
        $connection = Mockery::mock();

        DB::shouldReceive('connection')->with('radius')->andReturn($connection);

        $service = new RadiusService();

        $this->assertFalse($service->userExists('shared-user', null));
        $this->assertSame([], $service->getUserAttributes('shared-user', null));
        $this->assertSame([], $service->getUserReplyAttributes('shared-user', null));
    }

    public function test_technical_specs_scopes_radacct_queries_to_org_site_nas_ips(): void
    {
        $request = new \Illuminate\Http\Request();
        $request->setUserResolver(fn () => (object) ['organization_id' => 42]);

        $customer = (object) [
            'organization_id' => 42,
            'radius_username' => 'shared-user',
            'status' => 'active',
        ];

        $customerModel = Mockery::mock('alias:App\\Models\\Customer');
        $customerModel->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $customerModel->shouldReceive('find')->with(7)->andReturn($customer);

        $siteModel = Mockery::mock('alias:App\\Models\\Site');
        $siteModel->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $siteModel->shouldReceive('whereNotNull')->with('ip_address')->andReturnSelf();
        $siteModel->shouldReceive('pluck')->with('ip_address')->andReturn(collect(['10.0.0.1', '10.0.0.2']));

        $radius = Mockery::mock();
        $radCheckQuery = Mockery::mock();
        $radAcctQuery = Mockery::mock();

        DB::shouldReceive('connection')->with('radius')->andReturn($radius);

        $radius->shouldReceive('table')->with('radcheck')->andReturn($radCheckQuery);
        $radCheckQuery->shouldReceive('where')->with('username', 'shared-user')->andReturnSelf();
        $radCheckQuery->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $radCheckQuery->shouldReceive('first')->once()->andReturn((object) ['username' => 'shared-user']);

        $radius->shouldReceive('table')->with('radacct')->andReturn($radAcctQuery)->times(3);
        $radAcctQuery->shouldReceive('where')->with('username', 'shared-user')->andReturnSelf()->times(3);
        $radAcctQuery->shouldReceive('when')->with(true, Mockery::type('Closure'))->andReturnUsing(function ($condition, $closure) use ($radAcctQuery) {
            $closure($radAcctQuery);
            return $radAcctQuery;
        })->times(3);
        $radAcctQuery->shouldReceive('whereIn')->with('nasipaddress', ['10.0.0.1', '10.0.0.2'])->andReturnSelf()->times(3);
        $radAcctQuery->shouldReceive('whereNull')->with('acctstoptime')->andReturnSelf()->once();
        $radAcctQuery->shouldReceive('whereNotNull')->with('acctstoptime')->andReturnSelf()->once();
        $radAcctQuery->shouldReceive('orderBy')->with('acctstarttime', 'desc')->andReturnSelf()->times(2);
        $radAcctQuery->shouldReceive('orderBy')->with('acctstoptime', 'desc')->andReturnSelf()->once();
        $radAcctQuery->shouldReceive('first')->twice()->andReturn(
            (object) ['acctsessiontime' => 60, 'acctstarttime' => now()->subMinutes(1), 'framedipaddress' => '10.10.10.10','callingstationid' => 'AA:BB:CC:DD:EE:FF','nasipaddress' => '10.0.0.1'],
            (object) ['acctsessiontime' => 60, 'acctstoptime' => now()->subMinutes(1), 'framedipaddress' => '10.10.10.10','callingstationid' => 'AA:BB:CC:DD:EE:FF','nasipaddress' => '10.0.0.1']
        );
        $radAcctQuery->shouldReceive('take')->with(5)->andReturnSelf()->once();
        $radAcctQuery->shouldReceive('get')->once()->andReturn(collect([]));

        $radPostAuthQuery = Mockery::mock();
        $radius->shouldReceive('table')->with('radpostauth')->andReturn($radPostAuthQuery);
        $radPostAuthQuery->shouldReceive('where')->with('username', 'shared-user')->andReturnSelf();
        $radPostAuthQuery->shouldReceive('when')->with(true, Mockery::type('Closure'))->andReturnUsing(function ($condition, $closure) use ($radPostAuthQuery) {
            $closure($radPostAuthQuery);
            return $radPostAuthQuery;
        });
        $radPostAuthQuery->shouldReceive('whereIn')->with('nasipaddress', ['10.0.0.1', '10.0.0.2'])->andReturnSelf();
        $radPostAuthQuery->shouldReceive('select')->with('id', 'reply', 'authdate', 'reason', 'pass')->andReturnSelf();
        $radPostAuthQuery->shouldReceive('orderBy')->with('id', 'desc')->andReturnSelf();
        $radPostAuthQuery->shouldReceive('paginate')->with(3)->andReturn(new \Illuminate\Pagination\LengthAwarePaginator([], 0, 3));

        $service = new \App\Services\CustomerRadiusService();
        $result = $service->getTechnicalSpecs($request, 7, \App\Models\Customer::class);

        $this->assertSame('10.0.0.1', $result['nas_ip_address']);
        $this->assertTrue($result['is_online']);
    }

    public function test_remove_customer_from_radius_skips_radacct_and_radpostauth_when_org_has_no_nas_ips(): void
    {
        $connection = Mockery::mock();
        $radCheckQuery = Mockery::mock();
        $radReplyQuery = Mockery::mock();
        $radGroupQuery = Mockery::mock();

        DB::shouldReceive('connection')->with('radius')->andReturn($connection);

        $siteModel = Mockery::mock('alias:App\\Models\\Site');
        $siteModel->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $siteModel->shouldReceive('whereNotNull')->with('ip_address')->andReturnSelf();
        $siteModel->shouldReceive('pluck')->with('ip_address')->andReturn(collect([]));

        $connection->shouldReceive('table')->with('radcheck')->andReturn($radCheckQuery);
        $radCheckQuery->shouldReceive('where')->with('username', 'shared-user')->andReturnSelf();
        $radCheckQuery->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $radCheckQuery->shouldReceive('delete')->once();

        $connection->shouldReceive('table')->with('radreply')->andReturn($radReplyQuery);
        $radReplyQuery->shouldReceive('where')->with('username', 'shared-user')->andReturnSelf();
        $radReplyQuery->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $radReplyQuery->shouldReceive('delete')->once();

        $connection->shouldReceive('table')->with('radusergroup')->andReturn($radGroupQuery);
        $radGroupQuery->shouldReceive('where')->with('username', 'shared-user')->andReturnSelf();
        $radGroupQuery->shouldReceive('where')->with('organization_id', 42)->andReturnSelf();
        $radGroupQuery->shouldReceive('delete')->once();

        $connection->shouldReceive('table')->with('radpostauth')->never();
        $connection->shouldReceive('table')->with('radacct')->never();

        $service = new \App\Services\CustomerRadiusService();

        $this->assertTrue($service->removeCustomerFromRadius('shared-user', 42));
    }

    public function test_auto_bind_uses_nasipaddress_to_keep_same_username_isolated_by_org(): void
    {
        $customersQuery = Mockery::mock();
        $sitesQuery = Mockery::mock();
        $radAcctQuery = Mockery::mock();
        $radCheckQuery = Mockery::mock();
        $radiusConnection = Mockery::mock();

        DB::shouldReceive('table')->with('customers')->andReturn($customersQuery);
        DB::shouldReceive('table')->with('sites')->andReturn($sitesQuery);
        DB::shouldReceive('connection')->with('radius')->andReturn($radiusConnection);

        $customersQuery->shouldReceive('whereNotNull')->with('radius_username')->andReturnSelf();
        $customersQuery->shouldReceive('where')->with('radius_username', '!=', '')->andReturnSelf();
        $customersQuery->shouldReceive('select')->with('radius_username', 'organization_id')->andReturnSelf();
        $customersQuery->shouldReceive('get')->once()->andReturn(collect([
            (object) ['radius_username' => 'shared-user', 'organization_id' => 2],
        ]));

        $sitesQuery->shouldReceive('whereNotNull')->with('ip_address')->andReturnSelf();
        $sitesQuery->shouldReceive('select')->with('ip_address', 'organization_id')->andReturnSelf();
        $sitesQuery->shouldReceive('get')->once()->andReturn(collect([
            (object) ['ip_address' => '10.0.0.1', 'organization_id' => 2],
            (object) ['ip_address' => '10.0.0.2', 'organization_id' => 9],
        ]));

        $radiusConnection->shouldReceive('table')->with('radacct')->andReturn($radAcctQuery);
        $radAcctQuery->shouldReceive('select')->with('username', 'callingstationid', 'nasipaddress')->andReturnSelf();
        $radAcctQuery->shouldReceive('whereIn')->with('username', ['shared-user'])->andReturnSelf();
        $radAcctQuery->shouldReceive('whereNull')->with('acctstoptime')->andReturnSelf();
        $radAcctQuery->shouldReceive('whereNotNull')->with('callingstationid')->andReturnSelf();
        $radAcctQuery->shouldReceive('where')->with('callingstationid', '!=', '')->andReturnSelf();
        $radAcctQuery->shouldReceive('orderBy')->with('radacctid', 'desc')->andReturnSelf();
        $radAcctQuery->shouldReceive('get')->once()->andReturn(collect([
            (object) ['username' => 'shared-user', 'callingstationid' => 'AA:BB:CC:DD:EE:FF', 'nasipaddress' => '10.0.0.1'],
            (object) ['username' => 'shared-user', 'callingstationid' => '11:22:33:44:55:66', 'nasipaddress' => '10.0.0.2'],
        ]));

        $radiusConnection->shouldReceive('table')->with('radcheck')->andReturn($radCheckQuery)->times(2);
        $radCheckQuery->shouldReceive('whereIn')->with('username', ['shared-user'])->andReturnSelf()->times(2);
        $radCheckQuery->shouldReceive('where')->with('attribute', 'Calling-Station-Id')->andReturnSelf()->once();
        $radCheckQuery->shouldReceive('where')->with('attribute', 'Cleartext-Password')->andReturnSelf()->once();
        $radCheckQuery->shouldReceive('where')->with('client_type', 'pppoe')->andReturnSelf()->twice();
        $radCheckQuery->shouldReceive('select')->with('username', 'organization_id')->andReturnSelf()->twice();
        $radCheckQuery->shouldReceive('get')->once()->andReturn(collect([]));
        $radCheckQuery->shouldReceive('get')->once()->andReturn(collect([
            (object) ['username' => 'shared-user', 'organization_id' => 2],
        ]));
        $radCheckQuery->shouldReceive('insert')->with([
            [
                'username' => 'shared-user',
                'attribute' => 'Calling-Station-Id',
                'op' => '==',
                'value' => 'AA:BB:CC:DD:EE:FF',
                'organization_id' => 2,
                'client_type' => 'pppoe',
            ],
        ])->once();

        $command = new \App\Console\Commands\AutoBindMacAddress();
        $command->setOutput(new \Illuminate\Console\OutputStyle(
            new \Symfony\Component\Console\Input\ArgvInput(),
            new \Symfony\Component\Console\Output\BufferedOutput()
        ));

        $command->handle();
        $this->assertTrue(true);
    }

    public function test_close_stale_radius_sessions_scopes_to_org_nas_ips_for_shared_usernames(): void
    {
        $sitesQuery = Mockery::mock();
        $customersQuery = Mockery::mock();
        $radAcctQuery = Mockery::mock();
        $radiusConnection = Mockery::mock();

        DB::shouldReceive('table')->with('sites')->andReturn($sitesQuery);
        DB::shouldReceive('table')->with('customers')->andReturn($customersQuery);
        DB::shouldReceive('connection')->with('radius')->andReturn($radiusConnection);

        $sitesQuery->shouldReceive('whereNotNull')->with('ip_address')->andReturnSelf();
        $sitesQuery->shouldReceive('select')->with('organization_id', 'ip_address')->andReturnSelf();
        $sitesQuery->shouldReceive('get')->once()->andReturn(collect([
            (object) ['organization_id' => 2, 'ip_address' => '10.0.0.1'],
            (object) ['organization_id' => 9, 'ip_address' => '10.0.0.2'],
        ]));

        $customersQuery->shouldReceive('where')->with('organization_id', 2)->andReturnSelf();
        $customersQuery->shouldReceive('whereNotNull')->with('radius_username')->andReturnSelf();
        $customersQuery->shouldReceive('where')->with('radius_username', '!=', '')->andReturnSelf();
        $customersQuery->shouldReceive('pluck')->with('radius_username')->andReturn(collect(['shared-user']));

        $customersQuery->shouldReceive('where')->with('organization_id', 9)->andReturnSelf();
        $customersQuery->shouldReceive('whereNotNull')->with('radius_username')->andReturnSelf();
        $customersQuery->shouldReceive('where')->with('radius_username', '!=', '')->andReturnSelf();
        $customersQuery->shouldReceive('pluck')->with('radius_username')->andReturn(collect(['shared-user']));

        $radiusConnection->shouldReceive('table')->with('radacct')->andReturn($radAcctQuery);
        $radAcctQuery->shouldReceive('whereIn')->with('username', ['shared-user'])->andReturnSelf();
        $radAcctQuery->shouldReceive('whereIn')->with('nasipaddress', ['10.0.0.1'])->andReturnSelf();
        $radAcctQuery->shouldReceive('whereNull')->with('acctstoptime')->andReturnSelf();
        $radAcctQuery->shouldReceive('whereNotNull')->with('acctupdatetime')->andReturnSelf();
        $radAcctQuery->shouldReceive('where')->with('acctupdatetime', '<', Mockery::type('object'))->andReturnSelf();
        $radAcctQuery->shouldReceive('where')->with('acctstarttime', '<', Mockery::type('object'))->andReturnSelf();
        $radAcctQuery->shouldReceive('update')->with([
            'acctstoptime' => Mockery::type('object'),
            'acctterminatecause' => 'Stale-Session',
        ])->andReturn(1);

        $command = new \App\Console\Commands\CloseStaleRadiusSessions();
        $command->setOutput(new \Illuminate\Console\OutputStyle(
            new \Symfony\Component\Console\Input\ArgvInput(),
            new \Symfony\Component\Console\Output\BufferedOutput()
        ));

        $this->assertSame(0, $command->handle());
    }

    public function test_customer_delete_clears_radcheck_before_disconnect(): void
    {
        $service = Mockery::mock(\App\Services\CustomerRadiusService::class)
            ->makePartial()
            ->shouldAllowMockingProtectedMethods();

        $service->shouldReceive('removeCustomerFromRadius')->once()->with('shared-user', 42)->ordered();
        $service->shouldReceive('disconnectCustomer')->once()->with('shared-user', 42)->ordered();

        $service->deleteCustomerAndDisconnect('shared-user', 42);
    }

    public function test_same_organization_duplicate_radius_username_returns_frontend_ready_response(): void
    {
        $response = \App\Http\Controllers\Api\CustomerController::duplicateUsernameConflictResponse('0714475702');

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame(
            'This RADIUS username is already in use in your organization.',
            $response->getData()->message
        );
        $this->assertSame(
            'This RADIUS username is already in use in your organization.',
            $response->getData()->errors->radius_username[0]
        );
    }
}
