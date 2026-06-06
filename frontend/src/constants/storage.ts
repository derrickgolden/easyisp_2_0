// src/constants/storage.ts

export const STORAGE_KEYS = {
  SITES: 'easy-tech-sites',
  ADMINS: 'easy-tech-admins',
  ROLES: 'easy-tech-roles',
  PACKAGES: 'easy-tech-packages',
  HOTSPOT_PACKAGES: 'easy-tech-hotspot-packages',
  CUSTOMERS: 'easy-tech-customers',
  HOTSPOT_CUSTOMERS: 'easy-tech-hotspot-customers',
  PAYMENTS: 'easy-tech-payments',
  HOTSPOT_PAYMENTS: 'easy-tech-hotspot-payments',
  TRANSACTIONS: 'easy-tech-transactions',
  HOTSPOT_TRANSACTIONS: 'easy-tech-hotspot-transactions',
  INVOICES: 'easy-tech-invoices',
  HOTSPOT_INVOICES: 'easy-tech-hotspot-invoices',
  EXPENSES: 'easy-tech-expenses',
  CATEGORIES: 'easy-tech-expense-categories',
  LEADS: 'easy-tech-leads',
  TICKETS: 'easy-tech-tickets',
  AUTH: 'easy-tech-auth',
} as const;

export const THEME_STORAGE_KEY = 'easy-tech-theme';

export const clearLocalStorageData = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  localStorage.clear();

  if (savedTheme !== null) {
    localStorage.setItem(THEME_STORAGE_KEY, savedTheme);
  }
};