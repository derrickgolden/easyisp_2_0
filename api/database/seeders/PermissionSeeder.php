<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        
        $permissions = [
        
            // NETWORK
            ['name' => 'manage-sites', 'description' => 'Create, update and delete network sites', 'group' => 'network'],
            ['name' => 'view-sites', 'description' => 'View network sites and their details', 'group' => 'network'],
            ['name' => 'view-network-stats', 'description' => 'View network health and traffic statistics', 'group' => 'network'],
            ['name' => 'manage-radius', 'description' => 'Sync customers and manage RADIUS access', 'group' => 'network'],
        
            // BILLING
            ['name' => 'view-packages', 'description' => 'View service packages and pricing', 'group' => 'billing'],
            ['name' => 'manage-packages', 'description' => 'Create and update service packages and pricing', 'group' => 'billing'],
            ['name' => 'view-invoices', 'description' => 'View customer invoices and billing history', 'group' => 'billing'],
            ['name' => 'manage-invoices', 'description' => 'Create, update and send invoices', 'group' => 'billing'],
            ['name' => 'view-payments', 'description' => 'View customer payments and pending transactions', 'group' => 'billing'],
            ['name' => 'manage-payments', 'description' => 'Record and resolve customer payments', 'group' => 'billing'],
            ['name' => 'view-transactions', 'description' => 'View transaction ledger entries', 'group' => 'billing'],
            ['name' => 'view-expenses', 'description' => 'View company expenses', 'group' => 'billing'],
            ['name' => 'manage-expenses', 'description' => 'Track and approve expenses', 'group' => 'billing'],
            ['name' => 'view-reports', 'description' => 'Access financial and operational reports', 'group' => 'billing'],
        
            // CRM
            ['name' => 'view-customers', 'description' => 'View customer profiles and contact information', 'group' => 'crm'],
            ['name' => 'manage-customers', 'description' => 'Register and manage customer profiles', 'group' => 'crm'],
            ['name' => 'view-customer-details', 'description' => 'View customer details and usage history', 'group' => 'crm'],
            ['name' => 'send-message', 'description' => 'Send SMS, WhatsApp and email messages to single customers', 'group' => 'crm'],
            ['name' => 'send-bulk-messages', 'description' => 'Send SMS, WhatsApp and email messages to multiple customers', 'group' => 'crm'],
            ['name' => 'download-customer-data', 'description' => 'Download customer data and usage history', 'group' => 'crm'],
            ['name' => 'stk-push', 'description' => 'Initiate mobile money payment requests', 'group' => 'crm'],
            ['name' => 'change-expiry', 'description' => 'Manually change customer subscription expiry and extension dates', 'group' => 'crm'],
            ['name' => 'manage-subscriptions', 'description' => 'Pause, resume and cancel customer subscriptions', 'group' => 'crm'],
            ['name' => 'change-packages', 'description' => 'Manually change customer service packages', 'group' => 'crm'],
            ['name' => 'adjust-balances', 'description' => 'Manually adjust customer account balances', 'group' => 'crm'],
            ['name' => 'flash-mac-binding', 'description' => 'Reset customer MAC binding for RADIUS authentication', 'group' => 'crm'],
            ['name' => 'delete-customers', 'description' => 'Delete customer profiles and data', 'group' => 'crm'],
            ['name' => 'create-customers', 'description' => 'Create new customer profiles', 'group' => 'crm'],
            ['name' => 'view-leads', 'description' => 'View sales leads and customer inquiries', 'group' => 'crm'],
            ['name' => 'manage-leads', 'description' => 'Create and update sales leads', 'group' => 'crm'],
            ['name' => 'view-tickets', 'description' => 'View support tickets', 'group' => 'crm'],
            ['name' => 'manage-tickets', 'description' => 'Create, respond to and close support tickets', 'group' => 'crm'],
        
            // SYSTEM
            ['name' => 'view-dashboard', 'description' => 'Access system overview dashboards', 'group' => 'system'],
            ['name' => 'system-settings', 'description' => 'Access and modify system settings', 'group' => 'system'],
            ['name' => 'view-templates', 'description' => 'View sms, email and document templates', 'group' => 'system'],
            ['name' => 'manage-templates', 'description' => 'Create and edit sms, email and document templates', 'group' => 'system'],
        ];
        
        foreach ($permissions as $permission) {
            Permission::updateOrCreate(
                ['name' => $permission['name'], 'guard_name' => 'sanctum'],
                array_merge($permission, ['guard_name' => 'sanctum'])
            );
        }
    }
}
