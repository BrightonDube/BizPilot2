/**
 * BizPilot Mobile POS — Authentication Service
 *
 * Manages login, logout, token refresh, and PIN-based quick login.
 *
 * Why a service class instead of just API calls?
 * Authentication involves multiple coordinated steps:
 * 1. Call the API
 * 2. Store tokens securely
 * 3. Update the Zustand store
 * 4. Configure the API client with the new token
 * 5. Trigger initial sync
 *
 * Putting all this in a service keeps it testable and prevents
 * screens from having to orchestrate these steps themselves.
 */

import {
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "./SecureStorage";
import { loginApi, refreshTokenApi, getMeApi } from "../api/auth";
import {
  setAccessToken,
  setRefreshToken,
  setTokenRefresher,
} from "../api/client";
import {
  SECURE_STORE_TOKEN_KEY,
  SECURE_STORE_REFRESH_KEY,
} from "@/utils/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

/**
 * Log in with email and password.
 *
 * 1. Calls the backend /auth/login endpoint
 * 2. Stores tokens in SecureStore (encrypted)
 * 3. Configures the API client with the access token
 * 4. Returns the authenticated user
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const response = await loginApi({ email, password });

    // Persist tokens securely
    await setSecureItem(SECURE_STORE_TOKEN_KEY, response.access_token);
    await setSecureItem(SECURE_STORE_REFRESH_KEY, response.refresh_token);

    // Configure API client for subsequent requests
    setAccessToken(response.access_token);
    setRefreshToken(response.refresh_token);
    setTokenRefresher(refreshAccessToken);

    return {
      success: true,
      user: {
        id: response.user.id,
        email: response.user.email,
        firstName: response.user.first_name,
        lastName: response.user.last_name,
        role: response.user.role,
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Login failed";
    return { success: false, error: message };
  }
}

/**
 * Log out — clear all tokens and reset the API client.
 *
 * Why not clear WatermelonDB?
 * Offline data should survive logout so the next user on this
 * device still has the product catalog cached. Only auth tokens
 * and sensitive session data are cleared.
 */
export async function logout(): Promise<void> {
  await deleteSecureItem(SECURE_STORE_TOKEN_KEY);
  await deleteSecureItem(SECURE_STORE_REFRESH_KEY);
  setAccessToken(null);
  setRefreshToken(null);
  setTokenRefresher(null);
}

/**
 * Attempt to restore a session from stored tokens.
 * Called on app launch to check if the user is already logged in.
 */
export async function restoreSession(): Promise<AuthResult> {
  try {
    const token = await getSecureItem(SECURE_STORE_TOKEN_KEY);
    const refresh = await getSecureItem(SECURE_STORE_REFRESH_KEY);

    if (!token || !refresh) {
      return { success: false };
    }

    setAccessToken(token);
    setRefreshToken(refresh);
    setTokenRefresher(refreshAccessToken);

    // Validate the token by fetching the user profile
    const user = await getMeApi();

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    };
  } catch {
    // Token expired or invalid — try refresh
    const refreshResult = await refreshAccessToken();
    if (refreshResult) {
      try {
        const user = await getMeApi();
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
          },
        };
      } catch {
        // Refresh worked but profile fetch failed
        return { success: false, error: "Session expired" };
      }
    }
    return { success: false, error: "Session expired" };
  }
}

/**
 * Refresh the access token using the stored refresh token.
 * Returns the new access token, or null if refresh fails.
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refresh = await getSecureItem(SECURE_STORE_REFRESH_KEY);
    if (!refresh) return null;

    const response = await refreshTokenApi(refresh);
    await setSecureItem(SECURE_STORE_TOKEN_KEY, response.access_token);
    setAccessToken(response.access_token);

    return response.access_token;
  } catch {
    // Refresh token is also invalid — user must re-login
    await logout();
    return null;
  }
}
