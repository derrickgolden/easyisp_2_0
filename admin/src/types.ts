export enum OrgStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
}

export enum SubscriptionTier {
  LITE = "lite",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}

export interface Organization {
  id: number;
  name: string;
  acronym: string;
  subscription_tier: SubscriptionTier;
  status: OrgStatus;
  settings?: Record<string, unknown> | null;
  created_at?: string;
  sites_count?: number;
  customers_count?: number;
  latest_license_snapshot?: {
    snapshot_month: string;
    total_amount: string | number;
    status: 'billed' | 'paid';
    active_users_count: number;
    price_per_user: string | number;
  } | null;
}

export interface Site {
  id: number | string;
  organization_id: number;
  name: string;
  status: "online" | "offline";
  location?: string | null;
  ip_address?: string | null;
  notify_on_down?: boolean;
  last_seen?: string | null;
  radius_secret?: string | null;
  organization_name?: string | null;
}

export interface Customer {
  id: number;
  organization_id: number;
  name: string;
  status: "Active" | "Inactive";
}

export interface Role {
  id: number;
  name: string;
  permissions?: string[];
}

export interface AdminUser {
  id: number;
  organization_id?: number | null;
  parent_id?: number | null;
  role_id: number;
  name: string;
  email: string;
  phone?: string | null;
  status: "Active" | "Inactive";
  is_super_admin?: boolean;
  last_login?: string | null;
  created_at?: string;
  role?: Role | null;
}

export interface DashboardStats {
  totalOrganizations: number;
  totalSites: number;
  totalCustomers: number;
  activeOrganizations: number;
}

export interface BillingSummary {
  organization_id: number;
  organization_name: string;
  total_customers: number;
  active_customers: number;
}

export interface LicenseBillingSnapshot {
  id: number;
  snapshot_month: string;
  active_users_count: number;
  price_per_user: string | number;
  total_amount: string | number;
  status: 'billed' | 'paid';
  billed_at?: string | null;
  paid_at?: string | null;
}

export interface OrganizationLicenseBillingResponse {
  organization_id: number;
  organization_name: string;
  organization_status: OrgStatus;
  current: LicenseBillingSnapshot | null;
  price_per_active_user: number;
  currency: string;
  history: LicenseBillingSnapshot[];
}
