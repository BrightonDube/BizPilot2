/**
 * API client configuration for BizPilot backend.
 * 
 * Authentication Strategy:
 * - Web clients: Uses HttpOnly cookies (automatically sent with credentials: 'include')
 * - Mobile clients: Uses Bearer tokens in Authorization header
 * 
 * The API client automatically includes cookies for web authentication.
 * For mobile apps (React Native), tokens should be managed with SecureStore/Keychain.
 * 
 * Session Expiration Handling:
 * - On 401 errors, the client attempts to refresh the token
 * - If refresh fails, emits an 'auth:session-expired' event
 * - The auth store subscribes to this event and handles logout + redirect
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:8000/api/v1');

/**
 * Event types for auth-related events.
 * These events allow decoupled communication between the API client and auth store.
 */
export type AuthEventType = 'auth:session-expired' | 'auth:unauthorized';

/**
 * Dispatch a custom auth event that components/stores can listen to.
 * Uses window events for browser-side communication.
 */
export function dispatchAuthEvent(type: AuthEventType, detail?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

/**
 * Subscribe to auth events.
 * Returns an unsubscribe function.
 */
export function subscribeToAuthEvent(type: AuthEventType, handler: (event: CustomEvent) => void): () => void {
  if (typeof window !== 'undefined') {
    window.addEventListener(type, handler as EventListener);
    return () => window.removeEventListener(type, handler as EventListener);
  }
  return () => {};
}

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

/**
 * Check if an error is an authentication error.
 * This includes:
 * - 401 Unauthorized
 * - 500 errors with specific auth-related messages (token validation failures)
 */
function isAuthError(error: AxiosError): boolean {
  const status = error.response?.status;
  
  // Direct 401 is always an auth error
  if (status === 401) {
    return true;
  }
  
  // Check for 500 errors that are actually auth-related
  // (e.g., token decode failures that weren't properly handled by backend)
  if (status === 500) {
    const data = error.response?.data as { detail?: string } | undefined;
    const detail = data?.detail?.toLowerCase() || '';
    const authMessages = [
      'could not validate credentials',
      'token',
      'expired',
      'invalid credentials',
      'authentication',
      'unauthorized',
    ];
    return authMessages.some(msg => detail.includes(msg));
  }
  
  return false;
}

// Response interceptor to handle token refresh and session expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Skip refresh logic for auth endpoints to prevent redirect loops
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/') || 
                           originalRequest?.url?.includes('/oauth/');
    
    // Check if this is an authentication error
    const authError = isAuthError(error);
    
    // If auth error and we haven't already retried, try to refresh (but not for auth endpoints)
    if (authError && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
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
        // Refresh failed - session has truly expired
        // Dispatch event so auth store can handle logout and redirect
        dispatchAuthEvent('auth:session-expired', {
          originalUrl: originalRequest?.url,
          message: 'Your session has expired. Please log in again.',
        });
        
        // Return a rejected promise with a user-friendly error
        return Promise.reject(new Error('Session expired. Please log in again.'));
      }
    }
    
    // For auth errors that already retried, dispatch event
    if (authError && originalRequest?._retry) {
      dispatchAuthEvent('auth:session-expired', {
        originalUrl: originalRequest?.url,
        message: 'Your session has expired. Please log in again.',
      });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
