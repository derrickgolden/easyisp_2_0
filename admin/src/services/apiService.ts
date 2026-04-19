import axios, { AxiosError, AxiosInstance } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
	status: number;
	details?: unknown;

	constructor(status: number, message: string, details?: unknown) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.details = details;
	}
}

let authToken: string | null = null;
let tokenExpiration: number | null = null;
let onUnauthorized: (() => void) | null = null;
let isLoggingOut = false;

export const setOnUnauthorizedCallback = (callback: () => void) => {
  onUnauthorized = callback;
};

export const setIsLoggingOut = (value: boolean) => {
  isLoggingOut = value;
};

export const setAuthToken = (token: string | null) => {
	authToken = token;
	if (token) {
		// Token expires in 1 hour
		tokenExpiration = Date.now() + (1 * 60 * 60 * 1000);
		localStorage.setItem("admin_auth_token", token);
		localStorage.setItem("admin_auth_token_expiration", tokenExpiration.toString());
		axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
	} else {
		tokenExpiration = null;
		localStorage.removeItem("admin_auth_token");
		localStorage.removeItem("admin_auth_token_expiration");
		delete axiosInstance.defaults.headers.common.Authorization;
	}
};

export const getAuthToken = () => {
	if (!authToken) {
		authToken = localStorage.getItem("admin_auth_token");
		const expiration = localStorage.getItem("admin_auth_token_expiration");
		if (expiration) {
			tokenExpiration = parseInt(expiration);
		}
	}
	return authToken;
};

export const isTokenExpired = () => {
	const token = getAuthToken();
	if (!token) return true; // No token means expired
	if (!tokenExpiration) return true; // No expiration time means expired
	return Date.now() > tokenExpiration;
};

const axiosInstance: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

axiosInstance.interceptors.request.use((config) => {
	const token = getAuthToken();
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

axiosInstance.interceptors.response.use(
	(response) => response,
	(error: AxiosError) => {
		const status = error.response?.status || 0;
		const data = error.response?.data as any;
		const message = data?.message || data?.error || error.message || `HTTP ${status}`;

		// If token is expired (401), clear it and trigger logout (only once)
		if (status === 401 && !isLoggingOut) {
			isLoggingOut = true;
			setAuthToken(null);
			if (onUnauthorized) {
				onUnauthorized();
			}
		}

		throw new ApiError(status, message, data?.errors ?? data);
	}
);

export interface LoginResponse {
	token: string;
	user: {
		name: string;
		email?: string;
	};
	role?: {
		id: string;
		name: string;
		permissions?: string[];
	};
}

export interface OrganizationInput {
	name: string;
	acronym: string;
	subscription_tier: "lite" | "pro" | "enterprise";
	status?: "active" | "suspended";
	settings?: Record<string, unknown> | null;
}

export interface SiteInput {
	name?: string;
	location?: string;
	ip_address?: string;
	radius_secret?: string | null;
	notify_on_down?: boolean;
}

// Auth Endpoints
export const authApi = {
	login: async (email: string, password: string) => {
		const response = await axiosInstance.post("/auth/login", { email, password });
		const data = response.data as LoginResponse;
		if (data.token) {
			setAuthToken(data.token);
		}
		return data;
	},

	logout: async () => {
		setAuthToken(null);
	},
};

// Organization Endpoints
export const organizationsApi = {
	getAll: async () => {
		const response = await axiosInstance.get("/organizations");
		return response.data;
	},

	getLicenseBillingHistory: async (id: number | string) => {
		const response = await axiosInstance.get(`/organizations/${id}/license-billing`);
		return response.data;
	},

	updateLicenseBillingStatus: async (
		organizationId: number | string,
		snapshotId: number | string,
		status: "billed" | "paid"
	) => {
		const response = await axiosInstance.patch(
			`/organizations/${organizationId}/license-billing/${snapshotId}/status`,
			{ status }
		);
		return response.data;
	},

	getById: async (id: number | string) => {
		const response = await axiosInstance.get(`/organizations/${id}`);
		return response.data;
	},

	create: async (data: OrganizationInput) => {
		const response = await axiosInstance.post("/organizations", data);
		return response.data;
	},

	update: async (id: number | string, data: OrganizationInput) => {
		const response = await axiosInstance.put(`/organizations/${id}`, data);
		return response.data;
	},

	delete: async (id: number | string) => {
		const response = await axiosInstance.delete(`/organizations/${id}`);
		return response.data;
	},
};

export const dashboardApi = {
	getStats: async () => {
		const response = await axiosInstance.get("/stats");
		return response.data;
	},
};

export const sitesApi = {
	getAll: async (page = 1, organizationId?: number) => {
		const params = new URLSearchParams({ page: String(page) });
		if (organizationId) params.append('organization_id', String(organizationId));
		const response = await axiosInstance.get(`/sites?${params.toString()}`);
		return response.data;
	},

	update: async (id: number | string, data: SiteInput) => {
		const response = await axiosInstance.put(`/sites/${id}`, data);
		return response.data;
	},
};

export const customersApi = {
	getAll: async () => {
		const response = await axiosInstance.get("/customers");
		return response.data;
	},
};

export const billingApi = {
	getSummary: async () => {
		const response = await axiosInstance.get("/billing-summary");
		return response.data;
	},
};

export const usersApi = {
	getAll: async (page = 1, organizationId?: number) => {
		const params = new URLSearchParams({ page: String(page) });
		if (organizationId) params.append('organization_id', String(organizationId));
		const response = await axiosInstance.get(`/users?${params.toString()}`);
		return response.data;
	},

	create: async (data: {
		name: string;
		email: string;
		phone?: string;
		password: string;
		role_id: number;
		organization_id?: number | null;
		parent_id?: number | null;
		status?: "Active" | "Inactive";
		is_super_admin?: boolean;
	}) => {
		const response = await axiosInstance.post("/users", data);
		return response.data;
	},

	delete: async (id: number | string) => {
		const response = await axiosInstance.delete(`/users/${id}`);
		return response.data;
	},
};

export const rolesApi = {
	getAll: async (page = 1) => {
		const response = await axiosInstance.get(`/roles?page=${page}`);
		return response.data;
	},
};
