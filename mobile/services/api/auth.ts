/**
 * BizPilot Mobile POS — Auth API Module
 *
 * API calls related to authentication (login, token refresh).
 */

import apiClient from "./client";

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    business_id: string;
  };
}

interface RefreshResponse {
  access_token: string;
  token_type: string;
}

/**
 * Login with email and password.
 * Returns JWT tokens and user profile.
 */
export async function loginApi(
  credentials: LoginRequest
): Promise<LoginResponse> {
  // Why URLSearchParams?
  // The backend uses OAuth2PasswordRequestForm which expects
  // application/x-www-form-urlencoded, not JSON.
  const formData = new URLSearchParams();
  formData.append("username", credentials.email);
  formData.append("password", credentials.password);

  const response = await apiClient.post<LoginResponse>(
    "/api/auth/login",
    formData.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return response.data;
}

/**
 * Refresh the access token using a refresh token.
 */
export async function refreshTokenApi(
  refreshToken: string
): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>(
    "/api/auth/refresh",
    { refresh_token: refreshToken }
  );
  return response.data;
}

/**
 * Get the current user's profile.
 */
export async function getMeApi(): Promise<LoginResponse["user"]> {
  const response = await apiClient.get("/api/users/me");
  return response.data;
}
