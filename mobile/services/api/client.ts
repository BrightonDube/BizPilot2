/**
 * BizPilot Mobile POS — API Client
 *
 * Axios-based HTTP client with authentication interceptors and standardized error handling.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getSecureItem, deleteSecureItem } from "@/services/auth/SecureStorage";
import { router } from "expo-router";

// Base URL from environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let onTokenRefresh: (() => Promise<string | null>) | null = null;

/**
 * Update the in-memory access token.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Update the in-memory refresh token.
 */
export function setRefreshToken(token: string | null): void {
  refreshTokenValue = token;
}

/**
 * Set the function to call when a token needs to be refreshed.
 */
export function setTokenRefresher(refresher: (() => Promise<string | null>) | null): void {
  onTokenRefresh = refresher;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor: Attach JWT from SecureStore or memory
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = accessToken || (await getSecureItem("auth_token"));
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 and errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 1. On 401: Try refresh or clear token and redirect to login
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (onTokenRefresh) {
        originalRequest._retry = true;
        const newToken = await onTokenRefresh();
        if (newToken) {
          accessToken = newToken;
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        }
      }

      await deleteSecureItem("auth_token");
      setAccessToken(null);
      router.replace("/(auth)/login");
      return Promise.reject(new Error("Session expired. Please login again."));
    }

    // 2. On network error:
    if (!error.response && error.message === "Network Error") {
      throw new Error("No internet connection");
    }

    // 3. On other errors: throw with message from response body
    const apiMessage = (error.response?.data as any)?.detail || error.message;
    throw new Error(apiMessage);
  }
);

export { apiClient };
export default apiClient;
