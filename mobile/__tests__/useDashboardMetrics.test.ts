/**
 * useDashboardMetrics hook unit tests (task 16.1–16.4)
 *
 * Tests verify:
 * 1. Returns cached data when network fails (offline resilience — task 16.3)
 * 2. Marks data as stale when cache is old
 * 3. Sets isLoading correctly
 * 4. Shows error state when no cache and no network
 */

import { renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDashboardMetrics, DashboardMetrics } from "@/hooks/useDashboardMetrics";
import { apiClient } from "@/services/api/client";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

// AsyncStorage is mocked via __mocks__/async-storage.js but we need the
// standard mock pattern for typed access in this file.
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedApiGet = apiClient.get as jest.Mock;

const MOCK_METRICS: DashboardMetrics = {
  businessId: "biz-1",
  period: "today",
  fetchedAt: Date.now(),
  salesTotal: 12345.67,
  ordersCount: 42,
  avgOrderValue: 293.94,
  topProducts: [
    { name: "Coffee", revenue: 3200, units: 80 },
    { name: "Sandwich", revenue: 1800, units: 36 },
  ],
  lowStockCount: 3,
  kpis: [],
};

describe("useDashboardMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns data from the API when online", async () => {
    mockedApiGet.mockResolvedValueOnce({ data: MOCK_METRICS });
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useDashboardMetrics("biz-1", "today")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metrics).not.toBeNull();
    expect(result.current.metrics?.salesTotal).toBe(12345.67);
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("falls back to cache when network fails (offline resilience)", async () => {
    const cachedMetrics: DashboardMetrics = {
      ...MOCK_METRICS,
      fetchedAt: Date.now() - 60_000, // 1 minute old — not stale yet
    };

    mockedAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify(cachedMetrics)
    );
    mockedApiGet.mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() =>
      useDashboardMetrics("biz-1", "today")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metrics).not.toBeNull();
    expect(result.current.metrics?.salesTotal).toBe(12345.67);
    // Should not show error since we have cached data
    expect(result.current.error).toBeNull();
  });

  it("marks data as stale when cache is older than 5 minutes and we are offline", async () => {
    const oldCache: DashboardMetrics = {
      ...MOCK_METRICS,
      fetchedAt: Date.now() - 10 * 60_000, // 10 minutes old — stale
    };

    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(oldCache));
    mockedApiGet.mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() =>
      useDashboardMetrics("biz-1", "today")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isStale).toBe(true);
    expect(result.current.metrics).not.toBeNull();
  });

  it("sets error when no cache and network fails", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockedApiGet.mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() =>
      useDashboardMetrics("biz-1", "today")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it("saves fetched data to AsyncStorage cache", async () => {
    mockedApiGet.mockResolvedValueOnce({ data: MOCK_METRICS });
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useDashboardMetrics("biz-1", "today")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
    const [key, value] = mockedAsyncStorage.setItem.mock.calls[0];
    expect(key).toContain("dashboard_metrics_cache");
    const saved = JSON.parse(value as string) as DashboardMetrics;
    expect(saved.salesTotal).toBe(12345.67);
  });

  it("does not fetch when businessId is empty", async () => {
    const { result } = renderHook(() => useDashboardMetrics("", "today"));

    // Give it a tick to potentially trigger fetch
    await new Promise((r) => setTimeout(r, 50));

    expect(mockedApiGet).not.toHaveBeenCalled();
  });
});
