/**
 * BizPilot Mobile POS — Auth Store Tests
 */

import { useAuthStore } from "@/stores/authStore";
import { setSecureItem, getSecureItem, deleteSecureItem } from "@/services/auth/SecureStorage";
import { apiClient } from "@/services/api/client";

// Mock services
jest.mock("@/services/auth/SecureStorage", () => ({
  setSecureItem: jest.fn(),
  getSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}));

jest.mock("@/services/api/client", () => ({
  apiClient: {
    post: jest.fn(),
  },
  setAccessToken: jest.fn(),
}));

describe("AuthStore", () => {
  beforeEach(async () => {
    // Manually reset store state since it's persisted
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  it("login sets isAuthenticated to true on success", async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: "fake-token", user: { id: "1", email: "test@test.com", firstName: "Test", lastName: "User", role: "admin" } },
    });

    await useAuthStore.getState().login("test@test.com", "password");

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe("fake-token");
  });

  it("login stores token in SecureStore", async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: "fake-token", user: { id: "1", email: "test@test.com", firstName: "Test", lastName: "User", role: "admin" } },
    });

    await useAuthStore.getState().login("test@test.com", "password");

    expect(setSecureItem).toHaveBeenCalledWith("auth_token", "fake-token");
  });

  it("logout sets isAuthenticated to false", async () => {
    useAuthStore.setState({ isAuthenticated: true, token: "fake-token" });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("logout clears token from SecureStore", async () => {
    await useAuthStore.getState().logout();
    expect(deleteSecureItem).toHaveBeenCalledWith("auth_token");
  });

  it("restoreSession sets token from SecureStore if it exists", async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce("stored-token");

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().token).toBe("stored-token");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("restoreSession leaves isAuthenticated false if no token in SecureStore", async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce(null);

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("login sets isLoading to false on success", async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: "fake-token", user: { id: "1", email: "test@test.com", firstName: "Test", lastName: "User", role: "admin" } },
    });
    await useAuthStore.getState().login("test@test.com", "password");
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("restoreSession sets isLoading to false after completion", async () => {
    (getSecureItem as jest.Mock).mockResolvedValueOnce("some-token");
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
