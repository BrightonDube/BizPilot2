/**
 * BizPilot Mobile POS — AuthService Unit Tests (task 6.8)
 *
 * Tests the authentication service functions:
 * - login() / logout() / restoreSession()
 * - hashPin() / verifyPinHash() / loginWithPin()
 * - checkBiometricAvailability() / authenticateWithBiometric()
 *
 * Why mock the API and SecureStorage?
 * AuthService coordinates between the network, secure storage, and the
 * API client. Unit tests must isolate AuthService logic from those
 * external dependencies to run deterministically without a real server.
 */

import {
  login,
  logout,
  restoreSession,
  hashPin,
  verifyPinHash,
  loginWithPin,
  checkBiometricAvailability,
  authenticateWithBiometric,
} from "@/services/auth/AuthService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock SecureStorage — we don't want to touch native secure store in tests
jest.mock("@/services/auth/SecureStorage", () => ({
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  getSecureItem: jest.fn().mockResolvedValue(null),
  deleteSecureItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock the API auth module
jest.mock("@/services/api/auth", () => ({
  loginApi: jest.fn(),
  refreshTokenApi: jest.fn(),
  getMeApi: jest.fn(),
}));

// Mock the API client token setters
jest.mock("@/services/api/client", () => ({
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  setTokenRefresher: jest.fn(),
}));

// Import the mocked modules so we can access jest.fn() references
import { getSecureItem, deleteSecureItem, setSecureItem } from "@/services/auth/SecureStorage";
import { loginApi, refreshTokenApi, getMeApi } from "@/services/api/auth";
import { setAccessToken, setRefreshToken, setTokenRefresher } from "@/services/api/client";

// expo-local-authentication is globally mocked via jest.setup.ts.
// We import it here to get access to the mocked jest.fn() instances.
import * as LocalAuth from "expo-local-authentication";

const mockGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;
const mockDeleteSecureItem = deleteSecureItem as jest.MockedFunction<typeof deleteSecureItem>;
const mockSetSecureItem = setSecureItem as jest.MockedFunction<typeof setSecureItem>;
const mockLoginApi = loginApi as jest.MockedFunction<typeof loginApi>;
const mockRefreshTokenApi = refreshTokenApi as jest.MockedFunction<typeof refreshTokenApi>;
const mockGetMeApi = getMeApi as jest.MockedFunction<typeof getMeApi>;
const mockSetAccessToken = setAccessToken as jest.MockedFunction<typeof setAccessToken>;
const mockSetRefreshToken = setRefreshToken as jest.MockedFunction<typeof setRefreshToken>;
const mockSetTokenRefresher = setTokenRefresher as jest.MockedFunction<typeof setTokenRefresher>;

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const MOCK_LOGIN_RESPONSE = {
  access_token: "access-token-abc",
  refresh_token: "refresh-token-xyz",
  user: {
    id: "user-001",
    email: "cashier@shop.com",
    first_name: "Jane",
    last_name: "Smith",
    role: "cashier",
  },
};

const MOCK_ME_RESPONSE = {
  id: "user-001",
  email: "cashier@shop.com",
  first_name: "Jane",
  last_name: "Smith",
  role: "cashier",
};

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe("login()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoginApi.mockResolvedValue(MOCK_LOGIN_RESPONSE);
  });

  it("returns success with user data on valid credentials", async () => {
    const result = await login("cashier@shop.com", "password123");

    expect(result.success).toBe(true);
    expect(result.user?.id).toBe("user-001");
    expect(result.user?.email).toBe("cashier@shop.com");
    expect(result.user?.firstName).toBe("Jane");
    expect(result.user?.lastName).toBe("Smith");
    expect(result.user?.role).toBe("cashier");
  });

  it("stores access and refresh tokens in SecureStorage", async () => {
    await login("cashier@shop.com", "password123");

    expect(mockSetSecureItem).toHaveBeenCalledWith(
      expect.any(String),
      "access-token-abc"
    );
    expect(mockSetSecureItem).toHaveBeenCalledWith(
      expect.any(String),
      "refresh-token-xyz"
    );
  });

  it("configures the API client with the access token", async () => {
    await login("cashier@shop.com", "password123");

    expect(mockSetAccessToken).toHaveBeenCalledWith("access-token-abc");
    expect(mockSetRefreshToken).toHaveBeenCalledWith("refresh-token-xyz");
    expect(mockSetTokenRefresher).toHaveBeenCalledWith(expect.any(Function));
  });

  it("returns failure with error message on API error", async () => {
    mockLoginApi.mockRejectedValue(new Error("Invalid credentials"));

    const result = await login("wrong@email.com", "badpassword");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid credentials");
  });

  it("returns failure with generic message on non-Error rejection", async () => {
    mockLoginApi.mockRejectedValue("network error");

    const result = await login("user@example.com", "pass");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Login failed");
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------

describe("logout()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes both tokens from SecureStorage", async () => {
    await logout();

    expect(mockDeleteSecureItem).toHaveBeenCalledTimes(2);
  });

  it("clears the API client tokens", async () => {
    await logout();

    expect(mockSetAccessToken).toHaveBeenCalledWith(null);
    expect(mockSetRefreshToken).toHaveBeenCalledWith(null);
    expect(mockSetTokenRefresher).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// restoreSession()
// ---------------------------------------------------------------------------

describe("restoreSession()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns failure when no tokens are stored", async () => {
    mockGetSecureItem.mockResolvedValue(null);

    const result = await restoreSession();

    expect(result.success).toBe(false);
  });

  it("returns success with user when valid tokens are stored", async () => {
    mockGetSecureItem
      .mockResolvedValueOnce("stored-access-token")
      .mockResolvedValueOnce("stored-refresh-token");

    mockGetMeApi.mockResolvedValue(MOCK_ME_RESPONSE);

    const result = await restoreSession();

    expect(result.success).toBe(true);
    expect(result.user?.email).toBe("cashier@shop.com");
  });

  it("configures API client with stored access token", async () => {
    mockGetSecureItem
      .mockResolvedValueOnce("stored-access-token")
      .mockResolvedValueOnce("stored-refresh-token");

    mockGetMeApi.mockResolvedValue(MOCK_ME_RESPONSE);

    await restoreSession();

    expect(mockSetAccessToken).toHaveBeenCalledWith("stored-access-token");
  });

  it("attempts token refresh when access token is invalid", async () => {
    mockGetSecureItem
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("valid-refresh-token")
      // Second call inside refreshAccessToken
      .mockResolvedValueOnce("valid-refresh-token");

    // getMeApi fails first (expired token), then succeeds after refresh
    mockGetMeApi
      .mockRejectedValueOnce(new Error("Unauthorized"))
      .mockResolvedValueOnce(MOCK_ME_RESPONSE);

    mockRefreshTokenApi.mockResolvedValue({
      access_token: "new-access-token",
    });

    const result = await restoreSession();

    expect(result.success).toBe(true);
  });

  it("returns failure when refresh token is also invalid", async () => {
    mockGetSecureItem
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("expired-refresh");

    mockGetMeApi.mockRejectedValue(new Error("Unauthorized"));
    mockRefreshTokenApi.mockRejectedValue(new Error("Refresh expired"));

    const result = await restoreSession();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Session expired");
  });
});

// ---------------------------------------------------------------------------
// hashPin() / verifyPinHash()
// ---------------------------------------------------------------------------

describe("hashPin()", () => {
  it("returns a non-empty string for a 4-digit PIN", () => {
    const hash = hashPin("1234");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("produces the same hash for the same PIN (deterministic)", () => {
    expect(hashPin("5678")).toBe(hashPin("5678"));
  });

  it("produces different hashes for different PINs", () => {
    expect(hashPin("1234")).not.toBe(hashPin("5678"));
  });
});

describe("verifyPinHash()", () => {
  it("returns true when the PIN matches the stored hash", () => {
    const hash = hashPin("4321");
    expect(verifyPinHash("4321", hash)).toBe(true);
  });

  it("returns false when the PIN does not match the stored hash", () => {
    const hash = hashPin("4321");
    expect(verifyPinHash("1111", hash)).toBe(false);
  });

  it("is case-insensitive to leading zeros (e.g., '0001')", () => {
    const hash = hashPin("0001");
    expect(verifyPinHash("0001", hash)).toBe(true);
    expect(verifyPinHash("0002", hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loginWithPin()
// ---------------------------------------------------------------------------

describe("loginWithPin()", () => {
  const users = [
    { id: "cashier-1", name: "Alice", pinHash: hashPin("1111") },
    { id: "cashier-2", name: "Bob", pinHash: hashPin("2222") },
    { id: "cashier-3", name: "Carol", pinHash: null }, // No PIN set
  ];

  it("returns the matching user when PIN is correct", () => {
    const result = loginWithPin("1111", users);
    expect(result?.id).toBe("cashier-1");
  });

  it("returns the correct user when multiple users have PINs", () => {
    const result = loginWithPin("2222", users);
    expect(result?.id).toBe("cashier-2");
  });

  it("returns null when no user has the given PIN", () => {
    const result = loginWithPin("9999", users);
    expect(result).toBeNull();
  });

  it("returns null when the PIN is not 4 digits", () => {
    expect(loginWithPin("123", users)).toBeNull();
    expect(loginWithPin("12345", users)).toBeNull();
    expect(loginWithPin("", users)).toBeNull();
  });

  it("skips users without a PIN hash", () => {
    const onlyNoPinUsers = [{ id: "u1", pinHash: null }];
    expect(loginWithPin("1234", onlyNoPinUsers)).toBeNull();
  });

  it("returns null for an empty users array", () => {
    expect(loginWithPin("1234", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkBiometricAvailability()
// ---------------------------------------------------------------------------

describe("checkBiometricAvailability()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns unavailable when hardware is not present", async () => {
    (LocalAuth.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

    const result = await checkBiometricAvailability();

    expect(result.available).toBe(false);
    expect(result.type).toBeNull();
  });

  it("returns unavailable when biometrics are not enrolled", async () => {
    (LocalAuth.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuth.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

    const result = await checkBiometricAvailability();

    expect(result.available).toBe(false);
    expect(result.type).toBeNull();
  });

  it("returns available with type when biometrics are fully configured", async () => {
    (LocalAuth.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuth.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuth.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([2]); // Face ID

    const result = await checkBiometricAvailability();

    expect(result.available).toBe(true);
    expect(result.type).toBe("Face ID");
  });

  it("returns available with Fingerprint for type 1", async () => {
    (LocalAuth.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuth.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuth.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);

    const result = await checkBiometricAvailability();

    expect(result.available).toBe(true);
    expect(result.type).toBe("Fingerprint");
  });
});

// ---------------------------------------------------------------------------
// authenticateWithBiometric()
// ---------------------------------------------------------------------------

describe("authenticateWithBiometric()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns true when biometric authentication succeeds", async () => {
    (LocalAuth.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    const result = await authenticateWithBiometric();

    expect(result).toBe(true);
  });

  it("returns false when biometric authentication fails", async () => {
    (LocalAuth.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });

    const result = await authenticateWithBiometric();

    expect(result).toBe(false);
  });

  it("returns false when an error is thrown", async () => {
    (LocalAuth.authenticateAsync as jest.Mock).mockRejectedValue(
      new Error("Not available")
    );

    const result = await authenticateWithBiometric();

    expect(result).toBe(false);
  });
});
