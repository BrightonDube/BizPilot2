/**
 * BizPilot Mobile POS — API Client
 *
 * Axios-based HTTP client with authentication interceptors,
 * retry logic, and request cancellation.
 *
 * Why Axios instead of fetch?
 * - Request/response interceptors for automatic token injection
 * - Built-in timeout support
 * - Automatic JSON parsing
 * - Easier error handling with status codes
 * - Consistent with the web app's API client
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  API_MAX_RETRIES,
  API_RETRY_DELAY_MS,
} from "@/utils/constants";

// ---------------------------------------------------------------------------
// Token accessor — set by AuthService after login
// ---------------------------------------------------------------------------

/**
 * Why a module-level variable instead of importing SecureStore directly?
 * The API client should not depend on SecureStore (circular dependency).
 * AuthService sets these after login; the interceptor reads them.
 */
let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let onTokenRefresh: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setRefreshToken(token: string | null): void {
  refreshTokenValue = token;
}

export function setTokenRefresher(
  refresher: (() => Promise<string | null>) | null
): void {
  onTokenRefresh = refresher;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — inject auth token
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 with token refresh
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and we haven't already retried, attempt token refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      onTokenRefresh
    ) {
      originalRequest._retry = true;
      const newToken = await onTokenRefresh();
      if (newToken) {
        accessToken = newToken;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Retry utility for transient failures
// ---------------------------------------------------------------------------

/**
 * Execute an API call with exponential backoff retry.
 *
 * Why exponential backoff?
 * Hammering a struggling server with immediate retries makes
 * the problem worse. Doubling the delay gives the server time
 * to recover and prevents thundering herd issues.
 *
 * @param fn - The async function to retry
 * @param retries - Maximum retry attempts (default: API_MAX_RETRIES)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = API_MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const axiosError = error as AxiosError;

      // Don't retry client errors (4xx) except 408 (timeout) and 429 (rate limit)
      const status = axiosError.response?.status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw error;
      }

      if (attempt < retries) {
        const delay = API_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export { apiClient };
export default apiClient;
