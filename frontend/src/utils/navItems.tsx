import { ICONS } from "../constants";

type NavSubItem = { id: string; label: string; perm?: string | string[] };
export type NavItem = { id: string; label: string; icon: React.ReactNode; perm?: string | string[]; subItems?: NavSubItem[]; 
  css: string; cssActive: string; cssSubItem: string; cssSubItemActive: string; cssBorder: string };

export const navItems: NavItem[] = [

    { id: 'dashboard', label: 'Dashboard', icon: <ICONS.Dashboard />, 
      css: 'text-blue-400 hover:bg-slate-800 hover:text-blue-500', 
      cssActive: 'bg-blue-600 text-white shadow-lg shadow-blue-500/10',
      cssSubItem: 'text-blue-400 hover:bg-slate-800 hover:text-blue-500',
      cssSubItemActive: 'bg-blue-600 text-white shadow-lg shadow-blue-500/10',
      cssBorder: 'border-blue-500/50',
    },
    { 
      id: 'management', label: 'Management', icon: <ICONS.Management />, 
      css: 'text-purple-400 hover:bg-slate-800 hover:text-purple-500', 
      cssActive: 'bg-purple-600 text-white shadow-lg shadow-purple-500/10',
      cssSubItem: 'text-purple-200 hover:bg-slate-800 hover:text-purple-300',
      cssSubItemActive: 'bg-purple-200 text-purple-800 shadow-lg shadow-purple-500/10',
      cssBorder: 'border-purple-500/50',
      subItems: [
        { id: 'sites', label: 'Sites', perm: 'view-sites' },
        { id: 'packages', label: 'Packages', perm: 'view-packages' },
      ]
    },
    { 
      id: 'crm', label: 'CRM', icon: <ICONS.CRM />, 
      css: 'text-green-400 hover:bg-slate-800 hover:text-green-500', 
      cssActive: 'bg-green-600 text-white shadow-lg shadow-green-500/10',
      cssSubItem: 'text-green-200 hover:bg-slate-800 hover:text-green-300',
      cssSubItemActive: 'bg-green-200 text-green-800 shadow-lg shadow-green-500/10',
      cssBorder: 'border-green-500/50',
      subItems: [
        { id: 'customers', label: 'Customers', perm: ['view-customers', 'view-customer-details'] },
        { id: 'leads', label: 'Leads', perm: 'view-leads' },
        { id: 'tickets', label: 'Tickets', perm: 'view-tickets' },
      ]
    },
    { 
      id: 'revenue', label: 'Revenue', icon: <ICONS.Revenue />, 
      css: 'text-yellow-400 hover:bg-slate-800 hover:text-yellow-500', 
      cssActive: 'bg-yellow-600 text-white shadow-lg shadow-yellow-500/10',
      cssSubItem: 'text-yellow-200 hover:bg-slate-800 hover:text-yellow-300',
      cssSubItemActive: 'bg-yellow-200 text-yellow-800 shadow-lg shadow-yellow-500/10',
      cssBorder: 'border-yellow-500/50',
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
      css: 'text-orange-400 hover:bg-slate-800 hover:text-orange-500', 
      cssActive: 'bg-orange-600 text-white shadow-lg shadow-orange-500/10',
      cssSubItem: 'text-orange-200 hover:bg-slate-800 hover:text-orange-300',
      cssSubItemActive: 'bg-orange-200 text-orange-800 shadow-lg shadow-orange-500/10',
      cssBorder: 'border-orange-500/50',
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