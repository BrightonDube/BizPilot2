/**
 * API client configuration for BizPilot backend.
 * 
 * Authentication Strategy:
 * - Web clients: Uses HttpOnly cookies (automatically sent with credentials: 'include')
 * - Mobile clients: Uses Bearer tokens in Authorization header
 * 
 * The API client automatically includes cookies for web authentication.
 * For mobile apps (React Native), tokens should be managed with SecureStore/Keychain.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with credentials for cookie-based auth
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Include cookies in requests for web authentication
  withCredentials: true,
});

// Request interceptor - no token handling needed for web (uses cookies)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Cookies are automatically sent with withCredentials: true
    // No need to manually add Authorization header for web clients
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // If 401 and we haven't already retried, try to refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh endpoint will read refresh_token from cookie
        // and set new cookies automatically
        await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        // Retry the original request - new cookies will be sent automatically
        return apiClient(originalRequest);
      } catch {
        // Refresh failed, redirect to login
        // Using window.location because this is outside React context
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
