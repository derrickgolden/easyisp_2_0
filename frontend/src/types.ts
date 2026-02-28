
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in-progress',
  CLOSED = 'closed'
}

export interface Site {
  id: string;
  name: string;
  location: string;
  routers_count: number;
  status: 'online' | 'offline';
  ip_address: string;
  notify_on_down: boolean;
  last_seen?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  group: 'network' | 'billing' | 'crm' | 'system';
}

export interface Role {
  id: string;
  name: string;
  permissions: string[]; // Permission names
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string; // Optional for edit, usually required for create
  role_id: string; // References Role id
  status: 'Active' | 'Inactive';
  last_login: string;
  isSuperAdmin: boolean; // Flag to indicate if this admin has super admin privileges
  role?: Role; // Optional role details from auth response
}

export interface Package {
  id: string;
  name: string;
  speed_up: string;
  speed_down: string;
  price: number;
  validity_days: number;
  type: 'time' | 'data';
  // Burst configuration
  burst_limit_up?: string;
  burst_limit_down?: string;
  burst_threshold_up?: string;
  burst_threshold_down?: string;
  burst_time?: string;
  priority?: number; // 1-8
  min_limit_up?: string;
  min_limit_down?: string;
}

export interface RadiusLog {
  id: string;
  type: string;
  timestamp: string;
  status: string;
  passwordUsed: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  houseNo: string;
  apartment: string;
  location: string;
  connectionType: 'PPPoE' | 'Static IP' | 'DHCP';
  packageId: string;
  siteId?: string; // Linked network site
  installationFee: number;
  status: 'active' | 'expired' | 'suspended';
  expiryDate: string;
  extensionDate?: string;
  balance: number;
  createdAt: string;
  // Radius Credentials
  radiusUsername?: string;
  radiusPassword?: string;
  // Network Status Details
  ipAddress?: string;
  macAddress?: string;
  deviceType?: string;
  isOnline?: boolean;
  // Connection Logs
  radiusLogs?: RadiusLog[];
  // Hierarchy
  parentId?: string; // If set, this is a child account
  isIndependent?: boolean; // If true, sub-account does not depend on parent billing
  package?: Package; // Loaded package details
  subAccounts?: Customer[]; // Loaded sub-accounts
  parent?: Customer; // Loaded parent account
}

export interface TechnicalSpec {
  id: string;
  customerId: string;
  deviceType: string;
  macAddress: string;
  ipAddress: string;
  connectionDetails: string;
  notes?: string;
  logs: { data: [{
    id: number;
    reply: string;
    time: string;
    status_label: string;
    password_attempted: string;
  }]}
}

export interface Payment {
  id: string;
  subscriberId: string;
  mpesaCode: string;
  amount: number;
  billRef: string;
  phone: string;
  firstName: string;
  lastName: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'reversed';
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  status: 'new' | 'contacted' | 'survey' | 'converted' | 'lost';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  category: 'Billing' | 'SMS' | 'Email' | 'System';
  isDefault?: boolean;
}

export interface Ticket {
  id: string;
  customer_id?: string; // Optional for general tickets
  customer_name?: string; // Optional for general tickets
  subject: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  created_at: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  type: 'credit' | 'debit';
  category: 'Service Fee' | 'Deposit' | 'Refund' | 'Adjustment';
  method: 'M-Pesa' | 'Wallet' | 'Cash' | 'Bank';
  description: string;
  date: string;
  balance_before: number;
  balance_after: number;
  reference_id?: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  issue_date: string;
  due_date: string;
  status: 'paid' | 'unpaid' | 'overdue';
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string; // Changed to string to allow dynamic categories
  date: string;
  payment_method: string;
  reference_no?: string;
}

