import { ICONS } from "../constants";

type NavSubItem = { id: string; label: string; perm?: string | string[] };
type NavItem = { id: string; label: string; icon: React.ReactNode; perm?: string | string[]; subItems?: NavSubItem[] };

export const navItems: NavItem[] = [

    { id: 'dashboard', label: 'Dashboard', icon: <ICONS.Dashboard /> },
    { 
      id: 'management', label: 'Management', icon: <ICONS.Management />,
      subItems: [
        { id: 'sites', label: 'Sites', perm: 'p1' },
        { id: 'packages', label: 'Packages', perm: 'p4' },
      ]
    },
    { 
      id: 'crm', label: 'CRM', icon: <ICONS.CRM />,
      subItems: [
        { id: 'customers', label: 'Customers', perm: ['p10', 'p11'] },
        { id: 'leads', label: 'Leads', perm: 'p12' },
        { id: 'tickets', label: 'Tickets', perm: 'p13' },
      ]
    },
    { 
      id: 'revenue', label: 'Revenue', icon: <ICONS.Revenue />,
      subItems: [
        { id: 'payments', label: 'Payments', perm: 'p6' },
        { id: 'transactions', label: 'Transactions', perm: 'p7' },
        { id: 'invoices', label: 'Invoices', perm: 'p5' },
        { id: 'expenses', label: 'Expenses', perm: 'p8' },
        { id: 'reports', label: 'Reports', perm: 'p9' },
      ]
    },
    { 
      id: 'settings', label: 'Settings', icon: <ICONS.Settings />,
      subItems: [
        { id: 'general', label: 'General', perm: ['p16', 'p17'] },
        { id: 'licence', label: 'Licence', perm: ['p16', 'p17'] },
        { id: 'access-control', label: 'Access Control', perm: ['p14', 'p15'] },
        { id: 'payment-gateway', label: 'Payment Gateway', perm: 'p16' },
        { id: 'sms-gateway', label: 'Message Gateway', perm: 'p16' },
        { id: 'email-gateway', label: 'Email Gateway', perm: 'p16' },
        { id: 'notes-template', label: 'Notes Template', perm: 'p16' },
        { id: 'change-password', label: 'Change Password' },
      ]
    },
  ];