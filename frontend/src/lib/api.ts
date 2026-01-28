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
 * - If refresh fails, sets isSessionExpiring flag and emits an 'auth:session-expired' event
 * - The auth store subscribes to this event and handles logout + redirect
 * - Components can check isSessionExpiring to avoid rendering error states
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';

/**
 * Extended request config with retry flag for token refresh logic.
 */
interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:8000/api/v1');

function getBackendBaseUrl(): string {
  // API_URL includes the /api/v1 prefix. CSRF endpoint is at /api/csrf-token.
  if (API_URL.endsWith('/api/v1')) {
    return API_URL.slice(0, -'/api/v1'.length);
  }
  return API_URL;
}

let csrfTokenCache: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfTokenCache) return csrfTokenCache;
  if (csrfTokenPromise) return csrfTokenPromise;

  const base = getBackendBaseUrl();
  const url = `${base}/api/csrf-token`;

  csrfTokenPromise = axios
    .get<{ csrf_token: string }>(url, { withCredentials: true })
    .then((res) => {
      csrfTokenCache = res.data.csrf_token;
      return csrfTokenCache;
    })
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
}

/**
 * Event types for auth-related events.
 * These events allow decoupled communication between the API client and auth store.
 */
export type AuthEventType = 'auth:session-expired';

/**
 * Flag indicating that session expiration is in progress.
 * Components can check this to avoid rendering error states during redirect.
 * 
 * Note: This flag is intentionally not reset because session expiration triggers
 * a hard redirect (window.location.href), which causes a full page reload and
 * resets all JavaScript state including this flag.
 */
let sessionExpiringFlag = false;

/**
 * Check if a session expiration redirect is in progress.
 * Use this in components to avoid rendering error states.
 */
export function isSessionExpiring(): boolean {
  return sessionExpiringFlag;
}

/**
 * Dispatch a custom auth event that components/stores can listen to.
 * Uses window events for browser-side communication.
 */
export function dispatchAuthEvent(type: AuthEventType, detail?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    // Set flag before dispatching to prevent error rendering
    if (type === 'auth:session-expired') {
      sessionExpiringFlag = true;
    }
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
  async (config: InternalAxiosRequestConfig) => {
    // Cookies are automatically sent with withCredentials: true
    // For state-changing requests, include CSRF token
    const method = (config.method || 'get').toLowerCase();
    const needsCsrf = ['post', 'put', 'patch', 'delete'].includes(method);

    if (needsCsrf) {
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      if (!config.headers.get('X-CSRF-Token')) {
        const token = await getCsrfToken();
        config.headers.set('X-CSRF-Token', token);
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Check if an error indicates an authentication/session issue.
 * This includes:
 * - 401 Unauthorized (always indicates auth issue)
 * - 500 errors with specific credential validation messages
 *   (e.g., when token decode fails and backend doesn't handle it gracefully)
 */
function isAuthError(error: AxiosError): boolean {
  const status = error.response?.status;
  
  // Direct 401 is always an auth error
  if (status === 401) {
    return true;
  }
  
  // Check for 500 errors that are specifically credential validation failures
  // We only check for the exact message from the backend's authentication code
  if (status === 500) {
    const data = error.response?.data as { detail?: string } | undefined;
    const detail = data?.detail?.toLowerCase() || '';
    // Only match the specific error message from the auth dependency
    if (detail === 'could not validate credentials') {
      return true;
    }
  }
  
  return false;
}

// Response interceptor to handle token refresh and session expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig;
    
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
    
    return Promise.reject(error);
  }
);

/**
 * Check if an error is a session expiration error.
 * Components can use this to suppress error UI when session is expiring.
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (sessionExpiringFlag) return true;
  if (error instanceof Error && error.message === 'Session expired. Please log in again.') {
    return true;
  }
  return false;
}

export default apiClient;
