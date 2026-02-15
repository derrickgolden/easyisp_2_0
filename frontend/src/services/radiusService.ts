import { ApiError } from './apiService';

const API_BASE_URL = 'http://localhost:8000/api';

export const radiusApi = {
  /**
   * Authenticate a customer using RADIUS credentials
   * This is what WiFi hotspots/access points would call
   */
  authenticate: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/radius/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.message || 'Authentication failed');
    }

    return data;
  },

  /**
   * Get RADIUS configuration for a customer
   */
  getCustomerConfig: async (customerId: string) => {
    const response = await fetch(`${API_BASE_URL}/radius/customer/${customerId}/config`);

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to get configuration');
    }

    return response.json();
  },

  /**
   * Verify customer WiFi access (requires auth token)
   */
  verifyWifiAccess: async (customerId: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}/radius/customer/${customerId}/wifi-access`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to verify access');
    }

    return response.json();
  },

  /**
   * Verify customer credentials (requires auth token)
   */
  verifyCredentials: async (customerId: string, username: string, password: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}/radius/customer/${customerId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.message || 'Verification failed');
    }

    return data;
  },

  /**
   * Test RADIUS authentication with a customer's credentials
   */
  testAuthentication: async (username: string, password: string) => {
    try {
      const result = await radiusApi.authenticate(username, password);
      return {
        success: true,
        message: result.message,
        customer: result.customer,
        status: result.status,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          success: false,
          message: error.message,
          status: 'Access-Reject',
          error: error.message,
        };
      }
      return {
        success: false,
        message: 'Unknown error',
        status: 'Access-Reject',
        error: String(error),
      };
    }
  },
};

/**
 * Helper function to generate a test RADIUS authentication result
 */
export const generateRadiusAuthResult = (success: boolean, customer?: any) => {
  return {
    timestamp: new Date().toISOString(),
    type: 'Access-Request',
    status: success ? 'Access-Accept' : 'Access-Reject',
    message: success ? 'Authentication successful' : 'Authentication failed',
    customer: success ? customer : null,
  };
};
