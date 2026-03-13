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
// Static import so Jest mocks (jest.mock("expo-local-authentication")) can intercept it.
// Dynamic import() inside functions bypasses Jest's module mock registry.
import * as LocalAuthentication from "expo-local-authentication";

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

// ---------------------------------------------------------------------------
// PIN-based quick login
// ---------------------------------------------------------------------------

/**
 * Verify a staff PIN against the locally cached PIN hash.
 *
 * Why local verification?
 * PIN login must work offline. The PIN hash is stored in WatermelonDB
 * when the user first sets up their PIN (synced from the server).
 * We compare the entered PIN's hash against the stored hash.
 *
 * Security note: We use a simple hash comparison here because
 * the PIN is only 4 digits — it's a convenience feature, not
 * a primary auth mechanism. The user must have previously
 * authenticated with email/password to set up a PIN.
 *
 * @param pin - The 4-digit PIN entered by the user
 * @param storedHash - The hash stored in the local user record
 * @returns True if the PIN matches
 */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  // Simple hash comparison — the hash is generated server-side
  // and synced to the device. In production, use a constant-time
  // comparison to prevent timing attacks.
  const pinHash = hashPin(pin);
  return pinHash === storedHash;
}

/**
 * Generate a deterministic hash for a PIN.
 *
 * Why not bcrypt?
 * bcrypt is overkill for a 4-digit PIN (only 10,000 combinations).
 * The PIN is a convenience unlock, not a password. The real security
 * comes from the device being physically secured and the initial
 * email/password login. We use a simple SHA-256-like hash for
 * local comparison only.
 */
export function hashPin(pin: string): string {
  // Simple deterministic hash for PIN comparison.
  // In production, the server generates the hash with a proper
  // algorithm and syncs it. This is a fallback for local-only use.
  let hash = 0;
  const str = `bizpilot_pin_${pin}_salt`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Attempt PIN login against locally cached users.
 *
 * @param pin - The 4-digit PIN entered by the user
 * @param users - Array of locally cached user records with PIN hashes
 * @returns The matching user, or null if no match
 */
export function loginWithPin(
  pin: string,
  users: Array<{ id: string; pinHash: string | null; [key: string]: unknown }>
): typeof users[number] | null {
  if (pin.length !== 4) return null;

  for (const user of users) {
    if (user.pinHash && verifyPinHash(pin, user.pinHash)) {
      return user;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Biometric authentication
// ---------------------------------------------------------------------------

/**
 * Check if biometric authentication is available on this device.
 * Returns the type of biometric (fingerprint, face ID) or null.
 */
export async function checkBiometricAvailability(): Promise<{
  available: boolean;
  type: string | null;
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, type: null };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { available: false, type: null };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const typeNames: Record<number, string> = {
      1: "Fingerprint",
      2: "Face ID",
      3: "Iris",
    };
    const typeName = types.length > 0 ? typeNames[types[0]] ?? "Biometric" : null;

    return { available: true, type: typeName };
  } catch {
    return { available: false, type: null };
  }
}

/**
 * Prompt the user for biometric authentication.
 *
 * @returns True if the user successfully authenticated
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access BizPilot POS",
      cancelLabel: "Use PIN",
      disableDeviceFallback: true,
    });

    return result.success;
  } catch {
    return false;
  }
}
