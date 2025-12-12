/**
 * API client configuration for BizPilot backend.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
    const originalRequest = error.config;
    
    // If 401 and we have a refresh token, try to refresh
    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          // Retry the original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return apiClient(originalRequest);
        } catch {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          // Note: Using window.location here because this is outside React context
          // In production, consider using a custom event that the app can listen to
          // and handle with Next.js router
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
