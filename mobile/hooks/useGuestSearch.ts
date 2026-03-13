/**
 * BizPilot Mobile POS — useGuestSearch Hook
 *
 * Searches for hotel guests by room number or name.
 *
 * Why debounce name search but not room search?
 * Room numbers are short (3-4 chars), typed quickly, and exact-match.
 * Name searches are longer and trigger on every keystroke — debouncing
 * prevents hammering the PMS API with partial queries like "J", "Jo", "Joh".
 */

import { useState, useCallback, useRef } from "react";
import { usePMSStore } from "@/stores/pmsStore";
import type { PMSGuest } from "@/types/pms";

const DEBOUNCE_MS = 400;

// Mock guests for development — replaced by API calls when backend is ready
const MOCK_GUESTS: PMSGuest[] = [
  {
    id: "g1",
    name: "John Smith",
    roomNumber: "101",
    checkInDate: "2025-01-15T14:00:00Z",
    checkOutDate: "2025-01-20T10:00:00Z",
    folioNumber: "F-10001",
    vipLevel: 0,
    isActive: true,
    canCharge: true,
    dailyChargeLimit: 5000,
    transactionChargeLimit: 2000,
    confirmationNumber: "CNF-12345",
    lastFetchedAt: new Date().toISOString(),
  },
  {
    id: "g2",
    name: "Sarah Johnson",
    roomNumber: "205",
    checkInDate: "2025-01-16T15:00:00Z",
    checkOutDate: "2025-01-19T11:00:00Z",
    folioNumber: "F-10002",
    vipLevel: 2,
    isActive: true,
    canCharge: true,
    dailyChargeLimit: null,
    transactionChargeLimit: null,
    confirmationNumber: "CNF-12346",
    lastFetchedAt: new Date().toISOString(),
  },
  {
    id: "g3",
    name: "Michael Brown",
    roomNumber: "310",
    checkInDate: "2025-01-14T12:00:00Z",
    checkOutDate: "2025-01-17T10:00:00Z",
    folioNumber: "F-10003",
    vipLevel: 1,
    isActive: true,
    canCharge: false, // No-post flag
    dailyChargeLimit: 3000,
    transactionChargeLimit: 1000,
    confirmationNumber: "CNF-12347",
    lastFetchedAt: new Date().toISOString(),
  },
];

interface UseGuestSearchReturn {
  /** Search results */
  results: PMSGuest[];
  /** Whether a search is in progress */
  loading: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Search by room number (exact match, no debounce) */
  searchByRoom: (roomNumber: string) => void;
  /** Search by guest name (debounced) */
  searchByName: (name: string) => void;
  /** Select a guest and set as current in pmsStore */
  selectGuest: (guest: PMSGuest) => void;
  /** Clear search results */
  clearResults: () => void;
}

/**
 * Guest search hook for the POS checkout flow.
 * Searches PMS for guests by room number or name.
 */
export function useGuestSearch(): UseGuestSearchReturn {
  const [results, setResults] = useState<PMSGuest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setCurrentGuest = usePMSStore((s) => s.setCurrentGuest);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchByRoom = useCallback((roomNumber: string) => {
    if (!roomNumber.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.get(`/pms/guests?room=${roomNumber}`);
      const filtered = MOCK_GUESTS.filter(
        (g) => g.roomNumber === roomNumber.trim() && g.isActive
      );
      setResults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchByName = useCallback((name: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!name.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Replace with actual API call
        const query = name.toLowerCase();
        const filtered = MOCK_GUESTS.filter(
          (g) => g.name.toLowerCase().includes(query) && g.isActive
        );
        setResults(filtered);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const selectGuest = useCallback(
    (guest: PMSGuest) => {
      setCurrentGuest(guest);
    },
    [setCurrentGuest]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    searchByRoom,
    searchByName,
    selectGuest,
    clearResults,
  };
}
