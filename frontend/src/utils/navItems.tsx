import { ICONS } from "../constants";

type NavSubItem = { id: string; label: string; perm?: string | string[] };
type NavItem = { id: string; label: string; icon: React.ReactNode; perm?: string | string[]; subItems?: NavSubItem[] };

export const navItems: NavItem[] = [

    { id: 'dashboard', label: 'Dashboard', icon: <ICONS.Dashboard /> },
    { 
      id: 'management', label: 'Management', icon: <ICONS.Management />,
      subItems: [
        { id: 'sites', label: 'Sites', perm: 'view-sites' },
        { id: 'packages', label: 'Packages', perm: 'view-packages' },
      ]
    },
    { 
      id: 'crm', label: 'CRM', icon: <ICONS.CRM />,
      subItems: [
        { id: 'customers', label: 'Customers', perm: ['view-customers', 'view-customer-details'] },
        { id: 'leads', label: 'Leads', perm: 'view-leads' },
        { id: 'tickets', label: 'Tickets', perm: 'view-tickets' },
      ]
    },
    { 
      id: 'revenue', label: 'Revenue', icon: <ICONS.Revenue />,
      subItems: [
        { id: 'payments', label: 'Payments', perm: 'view-payments' },
        { id: 'transactions', label: 'Transactions', perm: 'view-transactions' },
        { id: 'invoices', label: 'Invoices', perm: 'view-invoices' },
        { id: 'expenses', label: 'Expenses', perm: 'view-expenses' },
        { id: 'reports', label: 'Reports', perm: 'view-reports' },
      ]
    },
    { 
      id: 'settings', label: 'Settings', icon: <ICONS.Settings />,
      subItems: [
        { id: 'general', label: 'General', perm: ['system-settings', 'manage-organization'] },
        { id: 'licence', label: 'Licence', perm: ['system-settings', 'manage-organization'] },
        { id: 'access-control', label: 'Access Control', perm: ['manage-admins', 'manage-roles'] },
        { id: 'payment-gateway', label: 'Payment Gateway', perm: 'system-settings' },
        { id: 'sms-gateway', label: 'Message Gateway', perm: 'system-settings' },
        { id: 'email-gateway', label: 'Email Gateway', perm: 'system-settings' },
        { id: 'notes-template', label: 'Notes Template', perm: ['view-templates', 'manage-templates'] },
        { id: 'change-password', label: 'Change Password', perm: 'change-password' },
      ]
    },
  ];