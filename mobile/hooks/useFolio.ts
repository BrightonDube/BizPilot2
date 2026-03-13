/**
 * BizPilot Mobile POS — useFolio Hook
 *
 * Fetches and manages a guest's folio (accumulated hotel bill).
 *
 * Why cache folio data?
 * PMS API calls are slow (200-500ms per request to external systems).
 * Caching the folio locally means the operator doesn't wait every
 * time they switch between the charge modal and folio view.
 * The cache is invalidated after a successful charge posting.
 */

import { useState, useCallback } from "react";
import { usePMSStore } from "@/stores/pmsStore";
import type { PMSFolio, PMSFolioCharge } from "@/types/pms";

// Mock folio data for development
const MOCK_FOLIOS: Record<string, PMSFolio> = {
  g1: {
    guestId: "g1",
    folioNumber: "F-10001",
    balance: 3450.0,
    creditLimit: 10000,
    recentCharges: [
      { reference: "RC-001", description: "Room Service - Breakfast", amount: 185.0, date: "2025-01-16T08:30:00Z", isFromThisPOS: false },
      { reference: "RC-002", description: "Restaurant - Lunch", amount: 345.0, date: "2025-01-16T13:00:00Z", isFromThisPOS: true },
      { reference: "RC-003", description: "Bar Tab", amount: 220.0, date: "2025-01-16T19:30:00Z", isFromThisPOS: true },
      { reference: "RC-004", description: "Spa Treatment", amount: 850.0, date: "2025-01-17T10:00:00Z", isFromThisPOS: false },
    ],
    lastFetchedAt: new Date().toISOString(),
  },
  g2: {
    guestId: "g2",
    folioNumber: "F-10002",
    balance: 1200.5,
    creditLimit: null,
    recentCharges: [
      { reference: "RC-005", description: "Restaurant - Dinner", amount: 520.0, date: "2025-01-17T20:00:00Z", isFromThisPOS: true },
    ],
    lastFetchedAt: new Date().toISOString(),
  },
};

interface UseFolioReturn {
  /** The current folio data */
  folio: PMSFolio | null;
  /** Whether the folio is being fetched */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetch/refresh folio for a guest */
  fetchFolio: (guestId: string) => Promise<void>;
  /** Clear folio data */
  clearFolio: () => void;
}

/**
 * Manages folio lookup and caching for a guest.
 */
export function useFolio(): UseFolioReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFolio = usePMSStore((s) => s.currentFolio);
  const setCurrentFolio = usePMSStore((s) => s.setCurrentFolio);

  const fetchFolio = useCallback(
    async (guestId: string) => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Replace with actual API call
        // const response = await apiClient.get(`/pms/folios/${guestId}`);
        // setCurrentFolio(response.data);

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        const folio = MOCK_FOLIOS[guestId] ?? null;
        if (!folio) {
          setError("Folio not found for this guest");
          setCurrentFolio(null);
        } else {
          setCurrentFolio({ ...folio, lastFetchedAt: new Date().toISOString() });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch folio");
        setCurrentFolio(null);
      } finally {
        setLoading(false);
      }
    },
    [setCurrentFolio]
  );

  const clearFolio = useCallback(() => {
    setCurrentFolio(null);
    setError(null);
  }, [setCurrentFolio]);

  return {
    folio: currentFolio,
    loading,
    error,
    fetchFolio,
    clearFolio,
  };
}
