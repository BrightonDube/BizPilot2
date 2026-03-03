/**
 * BizPilot Mobile POS — useCustomers Hook
 *
 * Provides customer data for the POS customer selector.
 *
 * Why a dedicated hook for customers?
 * Customer data is used in two contexts:
 * 1. The Customers tab (browsing/management)
 * 2. The POS customer selector (during checkout)
 * A shared hook ensures both get the same data and cache.
 */

import { useState, useMemo, useCallback } from "react";
import type { MobileCustomer } from "@/types";

// ---------------------------------------------------------------------------
// Mock data (replaced by WatermelonDB when connected)
// ---------------------------------------------------------------------------

const MOCK_CUSTOMERS: MobileCustomer[] = [
  { id: "c1", name: "John Smith", email: "john@example.com", phone: "+27 82 123 4567", address: null, notes: null, loyaltyPoints: 450, totalSpent: 12500.0, visitCount: 34, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "c1", syncedAt: Date.now(), isDirty: false },
  { id: "c2", name: "Jane Doe", email: "jane@example.com", phone: "+27 83 234 5678", address: null, notes: null, loyaltyPoints: 120, totalSpent: 3200.0, visitCount: 12, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "c2", syncedAt: Date.now(), isDirty: false },
  { id: "c3", name: "Alice Mokoena", email: null, phone: "+27 84 345 6789", address: null, notes: "VIP customer", loyaltyPoints: 800, totalSpent: 28000.0, visitCount: 67, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "c3", syncedAt: Date.now(), isDirty: false },
  { id: "c4", name: "Bob Nkosi", email: "bob@company.co.za", phone: null, address: null, notes: null, loyaltyPoints: 50, totalSpent: 890.0, visitCount: 3, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "c4", syncedAt: Date.now(), isDirty: false },
];

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseCustomersOptions {
  /** Search query (name, email, phone) */
  searchQuery?: string;
}

interface UseCustomersReturn {
  /** Filtered customers */
  customers: MobileCustomer[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Reload customers from database */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCustomers(
  options: UseCustomersOptions = {}
): UseCustomersReturn {
  const { searchQuery = "" } = options;
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const customers = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_CUSTOMERS;

    const q = searchQuery.toLowerCase().trim();
    return MOCK_CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  }, [searchQuery]);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 100);
  }, []);

  return { customers, loading, error, refresh };
}
