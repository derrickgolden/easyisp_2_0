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

export const setAuthToken = (token: string | null) => {
	authToken = token;
	if (token) {
		localStorage.setItem("admin_auth_token", token);
		axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
	} else {
		localStorage.removeItem("admin_auth_token");
		delete axiosInstance.defaults.headers.common.Authorization;
	}
};

export const getAuthToken = () => {
	if (!authToken) {
		authToken = localStorage.getItem("admin_auth_token");
	}
	return authToken;
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
