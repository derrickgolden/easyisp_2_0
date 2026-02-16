// API Configuration
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export interface ApiResponse<T> {
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  user?: T;
  token?: string;
  [key: string]: any;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('auth_token');
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = () => {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
};

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
axiosInstance.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status || 0;
    const data = error.response?.data as any;
    const errorMessage = data?.message || data?.error || error.message || `HTTP ${status}`;
    throw new ApiError(status, errorMessage, data?.errors);
  }
);

// Auth Endpoints
export const authApi = {
  register: async (organizationName: string, name: string, email: string, password: string) => {
    const response = await axiosInstance.post('/auth/register', {
      organization_name: organizationName,
      name,
      email,
      password,
      password_confirmation: password,
    });
    const data = response.data as { user: any; role?: any; token: string };
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  login: async (email: string, password: string) => {
    const response = await axiosInstance.post('/auth/login', { email, password });
    const data = response.data as { user: any; role?: any; token: string };
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  logout: async () => {
    try {
      await axiosInstance.post('/auth/logout');
    } finally {
      setAuthToken(null);
    }
  },

  me: async () => {
    const response = await axiosInstance.get('/auth/me');
    return response.data as { user: any; role?: any };
  },
};

// Users Endpoints
export const usersApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/users?page=${page}`);
    return response.data;
  },

  create: async (userData: any) => {
    const response = await axiosInstance.post('/users', userData);
    return response.data;
  },

  update: async (id: string, userData: any) => {
    const response = await axiosInstance.put(`/users/${id}`, userData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/users/${id}`);
    return response.data;
  },
};

// Roles Endpoints
export const rolesApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/roles?page=${page}`);
    return response.data;
  },

  create: async (roleData: any) => {
    const response = await axiosInstance.post('/roles', roleData);
    return response.data;
  },

  update: async (id: string, roleData: any) => {
    const response = await axiosInstance.put(`/roles/${id}`, roleData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/roles/${id}`);
    return response.data;
  },
};

// Customers Endpoints
export const customersApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/customers?page=${page}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/customers/${id}`);
    return response.data;
  },

  create: async (customerData: any) => {
    const response = await axiosInstance.post('/customers', customerData);
    return response.data;
  },

  update: async (id: string, customerData: any) => {
    const response = await axiosInstance.put(`/customers/${id}`, customerData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/customers/${id}`);
    return response.data;
  },

  getRadiusStatus: async (id: string) => {
    const response = await axiosInstance.get(`/customers/${id}/radius-status`);
    return response.data;
  },

  getWithRelations: async (id: string) => {
    const response = await axiosInstance.get(`/customers/${id}/with-relations`);
    return response.data;
  },

  syncToRadius: async (id: string) => {
    const response = await axiosInstance.post(`/customers/${id}/sync-radius`);
    return response.data;
  },

  syncAllToRadius: async () => {
    const response = await axiosInstance.post('/customers/sync-all-radius');
    return response.data;
  },

  getTechnicalSpecs: async (id: string) => {
    const response = await axiosInstance.get(`/customers/${id}/technical-specs`);
    return response.data;
  },

  resetMacBinding: async (id: string) => {
    const response = await axiosInstance.post(`/customers/${id}/reset-mac-binding`);
    return response.data;
  },

  pauseSubscription: async (id: string) => {
    const response = await axiosInstance.post(`/customers/${id}/pause-subscription`);
    return response.data;
  },

  resumeSubscription: async (id: string) => {
    const response = await axiosInstance.post(`/customers/${id}/resume-subscription`);
    return response.data;
  },
};

// Packages Endpoints
export const packagesApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/packages?page=${page}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/packages/${id}`);
    return response.data;
  },

  create: async (packageData: any) => {
    const response = await axiosInstance.post('/packages', packageData);
    return response.data;
  },

  update: async (id: string, packageData: any) => {
    const response = await axiosInstance.put(`/packages/${id}`, packageData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/packages/${id}`);
    return response.data;
  },
};

// Sites Endpoints
export const sitesApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/sites?page=${page}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/sites/${id}`);
    return response.data;
  },

  getIpam: async (id: string) => {
    const response = await axiosInstance.get(`/sites/${id}/ipam`);
    return response.data;
  },

  create: async (siteData: any) => {
    const response = await axiosInstance.post('/sites', siteData);
    return response.data;
  },

  update: async (id: string, siteData: any) => {
    const response = await axiosInstance.put(`/sites/${id}`, siteData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/sites/${id}`);
    return response.data;
  },
};

// Payments Endpoints
export const paymentsApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/payments?page=${page}`);
    return response.data;
  },

  getByCustomer: async (customerId: string, page = 1) => {
    const response = await axiosInstance.get(`/payments/customer/${customerId}?page=${page}`);
    return response.data;
  },

  getPending: async (page = 1) => {
    const response = await axiosInstance.get(`/payments/pending?page=${page}`);
    return response.data;
  },

  create: async (paymentData: any) => {
    const response = await axiosInstance.post('/payments', paymentData);
    return response.data;
  },

  update: async (id: string, paymentData: any) => {
    const response = await axiosInstance.put(`/payments/${id}`, paymentData);
    return response.data;
  },

  resolvePending: async (paymentId: string, customerId: string) => {
    const response = await axiosInstance.post(`/payments/${paymentId}/resolve`, {
      customer_id: customerId,
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/payments/${id}`);
    return response.data;
  },

  registerC2BUrls: async (data: {
    paybill: string;
    consumer_key: string;
    consumer_secret: string;
    environment?: string;
    confirmation_url?: string;
    validation_url?: string;
  }) => {
    try {
      const response = await axiosInstance.post('/payments/c2b/register-urls', data);
      return response.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      const message =
        responseData?.message ||
        responseData?.error ||
        (responseData?.errors ? JSON.stringify(responseData.errors) : null) ||
        err?.message ||
        'Failed to register C2B URLs';
      throw new Error(message);
    }
  },

  stkPushPayhero: async (data: { phone: string; amount: number }) => {
    try {
      const response = await axiosInstance.post('/payments/payhero/stkpush', data);
      return response.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      const message =
        responseData?.message ||
        responseData?.error ||
        (responseData?.errors ? JSON.stringify(responseData.errors) : null) ||
        err?.message ||
        'Failed to initiate STK push';
      throw new Error(message);
    }
  },
};

// Transactions Endpoints
export const transactionsApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/transactions?page=${page}`);
    return response.data;
  },

  getByCustomer: async (customerId: string, page = 1) => {
    const response = await axiosInstance.get(`/transactions/customer/${customerId}?page=${page}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/transactions/${id}`);
    return response.data;
  },

  create: async (data: {
    customer_id: string;
    amount: number;
    type: 'credit' | 'debit';
    category: string;
    method: string;
    description: string;
  }) => {
    const response = await axiosInstance.post('/transactions', data);
    return response.data;
  },
};

// Tickets Endpoints
export const ticketsApi = {
  getAll: async (page = 1) => {
    const response = await axiosInstance.get(`/tickets?page=${page}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/tickets/${id}`);
    return response.data;
  },

  getByCustomer: async (customerId: string, page = 1) => {
    const response = await axiosInstance.get(`/tickets/customer/${customerId}?page=${page}`);
    return response.data;
  },

  create: async (ticketData: any) => {
    const response = await axiosInstance.post('/tickets', ticketData);
    return response.data;
  },

  update: async (id: string, ticketData: any) => {
    const response = await axiosInstance.put(`/tickets/${id}`, ticketData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/tickets/${id}`);
    return response.data;
  },
};

// Organization Endpoints
export const organizationApi = {
  get: async () => {
    const response = await axiosInstance.get('/organization');
    return response.data;
  },

  update: async (data: any) => {
    const response = await axiosInstance.put('/organization', data);
    return response.data;
  },
};

// sms Endpoints
// SMS Endpoints
export const smsApi = {
  send: async (phone: string, message: string) => {
    const response = await axiosInstance.post('/sms/send', {
      phone,
      message,
    });
    return response.data;
  },
};

// Dashboard Endpoints
export const dashboardApi = {
  getStats: async () => {
    const response = await axiosInstance.get('/dashboard/stats');
    return response.data;
  },

  getRevenueChart: async () => {
    const response = await axiosInstance.get('/dashboard/revenue-chart');
    return response.data;
  },
};

// Leads Endpoints
export const leadsApi = {
  getAll: async (page = 1, perPage = 10, status?: string, search?: string) => {
    let url = `/leads?page=${page}&per_page=${perPage}`;
    if (status && status !== 'all') {
      url += `&status=${status}`;
    }
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await axiosInstance.get(url);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/leads/${id}`);
    return response.data;
  },

  create: async (leadData: any) => {
    const response = await axiosInstance.post('/leads', leadData);
    return response.data;
  },

  update: async (id: string, leadData: any) => {
    const response = await axiosInstance.put(`/leads/${id}`, leadData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/leads/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await axiosInstance.get('/leads-stats');
    return response.data;
  },
};

// Expenses Endpoints
export const expensesApi = {
  getAll: async (page = 1, perPage = 15, category?: string, search?: string, startDate?: string, endDate?: string) => {
    let url = `/expenses?page=${page}&per_page=${perPage}`;
    if (category && category !== 'All') {
      url += `&category=${encodeURIComponent(category)}`;
    }
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (startDate) {
      url += `&start_date=${startDate}`;
    }
    if (endDate) {
      url += `&end_date=${endDate}`;
    }
    const response = await axiosInstance.get(url);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get(`/expenses/${id}`);
    return response.data;
  },

  create: async (expenseData: any) => {
    const response = await axiosInstance.post('/expenses', expenseData);
    return response.data;
  },

  update: async (id: string, expenseData: any) => {
    const response = await axiosInstance.put(`/expenses/${id}`, expenseData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete(`/expenses/${id}`);
    return response.data;
  },

  getStats: async (startDate?: string, endDate?: string) => {
    let url = '/expenses/stats';
    const params: string[] = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },
};
