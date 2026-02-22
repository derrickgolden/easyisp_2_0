<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Organization;
use App\Models\User;
use App\Models\SystemAdmin;
use App\Models\Role;
use App\Models\Package;
use App\Models\Site;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Transaction;
use App\Models\Ticket;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */

    public function run(): void
    {
        // Call individual seeders here if you have them, e.g.:
        // $this->call(OrganizationSeeder::class);
        // $this->call(UserSeeder::class);
        // $this->call(RoleSeeder::class);
        // $this->call(PackageSeeder::class);
        // $this->call(SiteSeeder::class);
        // $this->call(CustomerSeeder::class);
        // $this->call(PaymentSeeder::class);
        // $this->call(TransactionSeeder::class);
        // $this->call(TicketSeeder::class);

        // Seed system admin account
        $admin = SystemAdmin::updateOrCreate(
            ['email' => 'goldenderrick95@gmail.com'],
            [
                'name' => 'System Admin',
                'email_verified_at' => now(),
                'phone' => '+254714475702',
                'password' => Hash::make('system@123'),
                'is_god_mode' => true,
            ]
        );

        // Create roles (aligned to Access Control UI InitialPermissions)
        $allPermissions = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

        $adminRole = Role::updateOrCreate(
            ['organization_id' => null, 'name' => 'Super Admin'],
            ['permissions' => $allPermissions]
        );

    }
    
    // public function run(): void
    // {
    //     // Create test organization
    //     $organization = Organization::updateOrCreate(
    //         ['name' => 'Easy Tech ISP'],
    //         [
    //             'subscription_tier' => 'pro',
    //             'status' => 'active',
    //             'settings' => ['theme' => 'dark', 'language' => 'en'],
    //             'acronym' => 'ETC',
    //         ]
    //     );

    //     // Create roles (aligned to Access Control UI InitialPermissions)
    //     $allPermissions = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

    //     $adminRole = Role::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Super Admin'],
    //         ['permissions' => $allPermissions]
    //     );

    //     $managerRole = Role::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Manager'],
    //         ['permissions' => ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']]
    //     );

    //     $staffRole = Role::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Staff'],
    //         ['permissions' => ['p5', 'p6']]
    //     );

    //     // Create system user
    //     $admin = User::updateOrCreate(
    //         ['email' => 'goldenderrick95@gmail.com'],
    //         [
    //             'organization_id' => null, // System user not tied to any organization
    //             'role_id' => 1, // Assuming role ID 1 is for system admin
    //             'name' => 'System Admin',
    //             'phone' => '+254714475702',
    //             'password' => Hash::make('system@123'),
    //             'is_super_admin' => true,
    //             'status' => 'Active',
    //         ]
    //     );

    //     // Create admin user
    //     $admin = User::updateOrCreate(
    //         ['email' => 'admin@easyisp.local'],
    //         [
    //             'organization_id' => $organization->id,
    //             'role_id' => $adminRole->id,
    //             'name' => 'Admin User',
    //             'phone' => '+254712345678',
    //             'password' => Hash::make('password123'),
    //             'is_super_admin' => true,
    //             'status' => 'Active',
    //         ]
    //     );

    //     // Create additional users
    //     User::updateOrCreate(
    //         ['email' => 'manager@easyisp.local'],
    //         [
    //             'organization_id' => $organization->id,
    //             'role_id' => $managerRole->id,
    //             'parent_id' => $admin->id,
    //             'name' => 'Manager User',
    //             'phone' => '+254712345679',
    //             'password' => Hash::make('password123'),
    //             'is_super_admin' => false,
    //             'status' => 'Active',
    //         ]
    //     );

    //     User::updateOrCreate(
    //         ['email' => 'staff@easyisp.local'],
    //         [
    //             'organization_id' => $organization->id,
    //             'role_id' => $staffRole->id,
    //             'parent_id' => $admin->id,
    //             'name' => 'Staff User',
    //             'phone' => '+254712345680',
    //             'password' => Hash::make('password123'),
    //             'is_super_admin' => false,
    //             'status' => 'Active',
    //         ]
    //     );

    //     // Create sites
    //     $site1 = Site::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Main Site - Nairobi'],
    //         [
    //             'location' => 'Nairobi CBD',
    //             'ip_address' => '10.20.20.3',
    //             'radius_secret' => 'testing123',
    //             'notify_on_down' => true,
    //         ]
    //     );

    //     $site2 = Site::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Secondary Site - Mombasa'],
    //         [
    //             'location' => 'Mombasa',
    //             'ip_address' => '192.168.2.1',
    //             'radius_secret' => 'secret456',
    //             'notify_on_down' => true,
    //         ]
    //     );

    //     // Create packages
    //     $package1 = Package::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Basic Package'],
    //         [
    //             'speed_up' => '5M',
    //             'speed_down' => '20M',
    //             'price' => 500,
    //             'validity_days' => 30,
    //             'type' => 'time',
    //             'burst_limit_up' => '10M',
    //             'burst_limit_down' => '40M',
    //             'burst_threshold_up' => '5M',
    //             'burst_threshold_down' => '20M',
    //             'burst_time' => '1h',
    //         ]
    //     );

    //     $package2 = Package::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Premium Package'],
    //         [
    //             'speed_up' => '10M',
    //             'speed_down' => '50M',
    //             'price' => 1200,
    //             'validity_days' => 30,
    //             'type' => 'time',
    //             'burst_limit_up' => '20M',
    //             'burst_limit_down' => '100M',
    //             'burst_threshold_up' => '10M',
    //             'burst_threshold_down' => '50M',
    //             'burst_time' => '2h',
    //         ]
    //     );

    //     $package3 = Package::updateOrCreate(
    //         ['organization_id' => $organization->id, 'name' => 'Enterprise Package'],
    //         [
    //             'speed_up' => '20Mbps',
    //             'speed_down' => '100Mbps',
    //             'price' => 2500,
    //             'validity_days' => 30,
    //             'type' => 'time',
    //         ]
    //     );

    //     // Create customers
    //     $customer1 = Customer::updateOrCreate(
    //         ['email' => 'john.doe@example.com'],
    //         [
    //             'organization_id' => $organization->id,
    //             'package_id' => $package1->id,
    //             'site_id' => $site1->id,
    //             'first_name' => 'John',
    //             'last_name' => 'Doe',
    //             'phone' => '+254712345681',
    //             'location' => 'Westlands',
    //             'apartment' => 'Apt 101',
    //             'house_no' => '123',
    //             'connection_type' => 'PPPoE',
    //             'installation_fee' => 1000,
    //             'status' => 'active',
    //             'expiry_date' => now()->addDays(30),
    //             'balance' => 500,
    //             'is_independent' => true,
    //             'radius_username' => 'johndoe',
    //             'radius_password' => 'securepass123',
    //             'ip_address' => '10.0.0.1',
    //             'mac_address' => '00:11:22:33:44:55',
    //             'password' => Hash::make('securepass123'),
    //         ]
    //     );

    //     $customer2 = Customer::updateOrCreate(
    //         ['email' => 'jane.smith@example.com'],
    //         [
    //             'organization_id' => $organization->id,
    //             'package_id' => $package2->id,
    //             'site_id' => $site1->id,
    //             'first_name' => 'Jane',
    //             'last_name' => 'Smith',
    //             'phone' => '+254712345682',
    //             'location' => 'Karen',
    //             'apartment' => 'Apt 202',
    //             'house_no' => '456',
    //             'connection_type' => 'Static IP',
    //             'installation_fee' => 1500,
    //             'status' => 'active',
    //             'expiry_date' => now()->addDays(25),
    //             'balance' => 1200,
    //             'is_independent' => true,
    //             'radius_username' => 'janesmith',
    //             'radius_password' => 'securepass456',
    //             'ip_address' => '10.0.0.2',
    //             'mac_address' => '00:11:22:33:44:66',
    //             'password' => Hash::make('securepass456'),
    //         ]
    //     );

    //     $customer3 = Customer::updateOrCreate(
    //         ['email' => 'bob.johnson@example.com'],
    //         [
    //             'organization_id' => $organization->id,
    //             'parent_id' => $customer1->id,
    //             'package_id' => $package1->id,
    //             'site_id' => $site1->id,
    //             'first_name' => 'Bob',
    //             'last_name' => 'Johnson',
    //             'phone' => '+254712345683',
    //             'location' => 'Westlands',
    //             'apartment' => 'Apt 103',
    //             'house_no' => '123',
    //             'connection_type' => 'DHCP',
    //             'installation_fee' => 0,
    //             'status' => 'active',
    //             'expiry_date' => now()->addDays(30),
    //             'balance' => 0,
    //             'is_independent' => false,
    //             'radius_username' => 'bobjohnson',
    //             'radius_password' => 'securepass789',
    //             'ip_address' => '10.0.0.3',
    //             'mac_address' => '00:11:22:33:44:77',
    //             'password' => Hash::make('securepass789'),
    //         ]
    //     );

    //     // Create additional customers for pagination testing
    //     $firstNames = ['Alex', 'Brian', 'Carol', 'Diana', 'Evan', 'Faith', 'George', 'Hannah', 'Ian', 'Joy', 'Kevin', 'Linda', 'Mark', 'Nina', 'Oscar', 'Paula', 'Quinn', 'Rita', 'Sam', 'Tina'];
    //     $lastNames = ['Otieno', 'Njeri', 'Mwangi', 'Kiptoo', 'Wanjiku', 'Kariuki', 'Mutiso', 'Omondi', 'Munyao', 'Kamau', 'Achieng', 'Mburu', 'Barasa', 'Limo', 'Cheruiyot', 'Kimani', 'Gichuhi', 'Ngugi', 'Karanja', 'Muthoni'];
    //     $locations = ['Westlands', 'Kilimani', 'Ruiru', 'Thika', 'Karen', 'Rongai', 'Embakasi', 'Kasarani', 'Muthaiga', 'Parklands'];
    //     $apartments = ['Apt 1A', 'Apt 2B', 'Apt 3C', 'Apt 4D', 'Apt 5E', 'Block F', 'Block G', 'Block H'];
    //     $connectionTypes = ['PPPoE', 'Static IP', 'DHCP'];
    //     $statuses = ['active', 'expired', 'suspended'];
    //     $packages = [$package1, $package2, $package3];
    //     $sites = [$site1, $site2];

    //     for ($i = 1; $i <= 20; $i++) {
    //         $firstName = $firstNames[($i - 1) % count($firstNames)];
    //         $lastName = $lastNames[($i - 1) % count($lastNames)];
    //         $package = $packages[($i - 1) % count($packages)];
    //         $site = $sites[($i - 1) % count($sites)];
    //         $status = $statuses[($i - 1) % count($statuses)];
    //         $location = $locations[($i - 1) % count($locations)];
    //         $apartment = $apartments[($i - 1) % count($apartments)];
    //         $connectionType = $connectionTypes[($i - 1) % count($connectionTypes)];
    //         $phone = '+2547' . str_pad((string)(10000000 + $i), 8, '0', STR_PAD_LEFT);
    //         $radiusUsername = 'user' . $i;
    //         $macSuffix = str_pad(dechex($i), 2, '0', STR_PAD_LEFT);

    //         $email = strtolower($firstName) . '.' . strtolower($lastName) . $i . '@example.com';

    //         Customer::updateOrCreate(
    //             ['email' => $email],
    //             [
    //                 'organization_id' => $organization->id,
    //                 'package_id' => $package->id,
    //                 'site_id' => $site->id,
    //                 'first_name' => $firstName,
    //                 'last_name' => $lastName,
    //                 'phone' => $phone,
    //                 'location' => $location,
    //                 'apartment' => $apartment,
    //                 'house_no' => 'H' . $i,
    //                 'connection_type' => $connectionType,
    //                 'installation_fee' => ($i % 3 === 0) ? 0 : 1000,
    //                 'status' => $status,
    //                 'expiry_date' => now()->addDays(10 + $i),
    //                 'balance' => ($i * 100),
    //                 'is_independent' => true,
    //                 'radius_username' => $radiusUsername,
    //                 'radius_password' => 'pass' . $i . 'Secure',
    //                 'password' => Hash::make('pass' . $i . 'Secure'),
    //                 'ip_address' => '10.0.1.' . $i,
    //                 'mac_address' => '00:11:22:33:44:' . $macSuffix,
    //             ]
    //         );
    //     }

    //     // Create payments
    //     Payment::updateOrCreate(
    //         ['mpesa_code' => 'RDJ1234567890'],
    //         [
    //             'organization_id' => $organization->id,
    //             'customer_id' => $customer1->id,
    //             'amount' => 500,
    //             'bill_ref' => 'INV001',
    //             'phone' => '+254712345681',
    //             'sender_name' => 'John Doe',
    //             'status' => 'completed',
    //         ]
    //     );

    //     Payment::updateOrCreate(
    //         ['mpesa_code' => 'RDJ0987654321'],
    //         [
    //             'organization_id' => $organization->id,
    //             'customer_id' => $customer2->id,
    //             'amount' => 1200,
    //             'bill_ref' => 'INV002',
    //             'phone' => '+254712345682',
    //             'sender_name' => 'Jane Smith',
    //             'status' => 'completed',
    //         ]
    //     );

    //     // Create transactions
    //     Transaction::updateOrCreate(
    //         ['reference_id' => 'RDJ1234567890'],
    //         [
    //             'organization_id' => $organization->id,
    //             'customer_id' => $customer1->id,
    //             'amount' => 500,
    //             'type' => 'credit',
    //             'category' => 'payment',
    //             'method' => 'mpesa',
    //             'description' => 'Monthly subscription payment',
    //             'balance_before' => 0,
    //             'balance_after' => 500,
    //         ]
    //     );

    //     Transaction::updateOrCreate(
    //         ['reference_id' => 'RDJ0987654321'],
    //         [
    //             'organization_id' => $organization->id,
    //             'customer_id' => $customer2->id,
    //             'amount' => 1200,
    //             'type' => 'credit',
    //             'category' => 'payment',
    //             'method' => 'mpesa',
    //             'description' => 'Monthly subscription payment',
    //             'balance_before' => 0,
    //             'balance_after' => 1200,
    //         ]
    //     );

    //     // Create tickets
    //     Ticket::updateOrCreate(
    //         ['customer_id' => $customer1->id, 'subject' => 'Slow Internet Speed'],
    //         [
    //             'organization_id' => $organization->id,
    //             'description' => 'Internet speed is very slow, experiencing buffering while streaming',
    //             'priority' => 'high',
    //             'status' => 'open',
    //         ]
    //     );

    //     Ticket::updateOrCreate(
    //         ['customer_id' => $customer2->id, 'subject' => 'Connection Dropped'],
    //         [
    //             'organization_id' => $organization->id,
    //             'description' => 'Connection keeps dropping, need immediate assistance',
    //             'priority' => 'critical',
    //             'status' => 'in-progress',
    //         ]
    //     );

    //     Ticket::updateOrCreate(
    //         ['customer_id' => $customer1->id, 'subject' => 'Billing Query'],
    //         [
    //             'organization_id' => $organization->id,
    //             'description' => 'Need to understand recent billing charges',
    //             'priority' => 'low',
    //             'status' => 'closed',
    //         ]
    //     );
    // }
}
