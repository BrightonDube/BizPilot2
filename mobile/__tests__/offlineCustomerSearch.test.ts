/**
 * Offline customer search tests
 * (crm-core task 5.5)
 *
 * Tests all offline search functions:
 * - lookupCustomerByCard (Req 3.5)
 * - getRecentCustomers (Req 3.4)
 * - offlineCustomerSearch (Req 3.1-3.6, all offline)
 */

import {
  lookupCustomerByCard,
  getRecentCustomers,
  offlineCustomerSearch,
} from "@/services/CustomerService";
import type { MobileCustomer } from "@/types";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

let id = 0;
function makeCustomer(overrides: Partial<MobileCustomer> = {}): MobileCustomer {
  id++;
  return {
    id: `c-${id}`,
    name: `Customer ${id}`,
    email: `customer${id}@test.com`,
    phone: `080${String(id).padStart(7, "0")}`,
    address: null,
    notes: null,
    loyaltyPoints: 0,
    totalSpent: 0,
    visitCount: 1,
    createdAt: Date.now() - id * 1000,
    updatedAt: Date.now() - id * 1000,
    remoteId: null,
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// lookupCustomerByCard (Req 3.5)
// ---------------------------------------------------------------------------

describe("lookupCustomerByCard (task 5.5)", () => {
  const customers: MobileCustomer[] = [
    makeCustomer({ notes: "CARD:LOYABC123", phone: "0821234567" }),
    makeCustomer({ phone: "0831234567" }),
    makeCustomer({ notes: "VIP customer", phone: "0841111111" }),
  ];

  it("finds customer by exact card number", () => {
    const result = lookupCustomerByCard(customers, "LOYABC123");
    expect(result).not.toBeNull();
    expect(result!.notes).toContain("CARD:LOYABC123");
  });

  it("is case-insensitive for card number", () => {
    const result = lookupCustomerByCard(customers, "loyabc123");
    expect(result).not.toBeNull();
  });

  it("falls back to phone number match (digits only)", () => {
    const result = lookupCustomerByCard(customers, "0831234567");
    expect(result).not.toBeNull();
    expect(result!.phone).toBe("0831234567");
  });

  it("returns null when card not found", () => {
    expect(lookupCustomerByCard(customers, "NOTEXIST999")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(lookupCustomerByCard(customers, "")).toBeNull();
  });

  it("returns null for whitespace-only query", () => {
    expect(lookupCustomerByCard(customers, "   ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRecentCustomers (Req 3.4)
// ---------------------------------------------------------------------------

describe("getRecentCustomers (task 5.5)", () => {
  it("returns customers sorted by updatedAt descending", () => {
    const now = Date.now();
    const customers: MobileCustomer[] = [
      makeCustomer({ updatedAt: now - 3000, visitCount: 2 }),
      makeCustomer({ updatedAt: now - 1000, visitCount: 5 }),
      makeCustomer({ updatedAt: now - 2000, visitCount: 1 }),
    ];
    const recent = getRecentCustomers(customers);
    expect(recent[0].updatedAt).toBe(now - 1000);
    expect(recent[1].updatedAt).toBe(now - 2000);
    expect(recent[2].updatedAt).toBe(now - 3000);
  });

  it("respects the limit parameter", () => {
    const customers = Array.from({ length: 20 }, () =>
      makeCustomer({ visitCount: 1 })
    );
    expect(getRecentCustomers(customers, 5)).toHaveLength(5);
  });

  it("excludes customers with visitCount 0 (never visited)", () => {
    const customers: MobileCustomer[] = [
      makeCustomer({ visitCount: 0 }),
      makeCustomer({ visitCount: 3 }),
      makeCustomer({ visitCount: 0 }),
    ];
    const recent = getRecentCustomers(customers);
    expect(recent).toHaveLength(1);
    expect(recent[0].visitCount).toBe(3);
  });

  it("returns empty array when all customers have visitCount 0", () => {
    const customers = [makeCustomer({ visitCount: 0 })];
    expect(getRecentCustomers(customers)).toHaveLength(0);
  });

  it("default limit is 10", () => {
    const customers = Array.from({ length: 15 }, () =>
      makeCustomer({ visitCount: 1 })
    );
    expect(getRecentCustomers(customers)).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// offlineCustomerSearch (Req 3.1-3.6)
// ---------------------------------------------------------------------------

describe("offlineCustomerSearch (task 5.5)", () => {
  const now = Date.now();
  const customers: MobileCustomer[] = [
    makeCustomer({ name: "Alice Smith", email: "alice@shop.com", phone: "0821111111", visitCount: 5, updatedAt: now - 1000 }),
    makeCustomer({ name: "Bob Jones",   email: "bob@work.com",   phone: "0832222222", visitCount: 2, updatedAt: now - 2000 }),
    makeCustomer({ name: "Carol Lee",   email: "carol@home.com", phone: "0843333333", visitCount: 0, updatedAt: now - 500 }),
    makeCustomer({ name: "Dave",        email: null, phone: "0844444444", notes: "CARD:SCAN001", visitCount: 1, updatedAt: now - 3000 }),
  ];

  it("returns recent customers when query is empty", () => {
    const results = offlineCustomerSearch(customers, "");
    // Only visitCount > 0 customers, sorted by updatedAt desc
    expect(results.every((c) => c.visitCount > 0)).toBe(true);
  });

  it("searches by name", () => {
    const results = offlineCustomerSearch(customers, "alice");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alice Smith");
  });

  it("searches by email", () => {
    const results = offlineCustomerSearch(customers, "work.com");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Bob Jones");
  });

  it("searches by phone", () => {
    const results = offlineCustomerSearch(customers, "0843333333");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("resolves card lookup for card-number-like queries", () => {
    const results = offlineCustomerSearch(customers, "SCAN001");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dave");
  });

  it("respects limit", () => {
    const big = Array.from({ length: 50 }, () =>
      makeCustomer({ name: "test user", visitCount: 1 })
    );
    expect(offlineCustomerSearch(big, "test", 5)).toHaveLength(5);
  });

  it("returns empty for no matches", () => {
    expect(offlineCustomerSearch(customers, "zzznomatch")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PBT: offline search is deterministic and non-negative — 300 runs
// ---------------------------------------------------------------------------

describe("PBT: offlineCustomerSearch invariants (task 5.5)", () => {
  it("result count never exceeds total customers — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 20) + 1;
      const pool = Array.from({ length: n }, () =>
        makeCustomer({ visitCount: Math.floor(Math.random() * 5) })
      );
      const queries = ["", "customer", "0800", "CARD001", `Customer ${Math.ceil(Math.random() * n)}`];
      const q = queries[Math.floor(Math.random() * queries.length)];
      const results = offlineCustomerSearch(pool, q);
      expect(results.length).toBeLessThanOrEqual(pool.length);
    }
  });

  it("same query + same input always produces same result — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const pool = Array.from({ length: 10 }, (_, j) =>
        makeCustomer({ name: `Staff ${j}`, visitCount: 1 })
      );
      const q = `Staff ${Math.floor(Math.random() * 10)}`;
      const r1 = offlineCustomerSearch(pool, q);
      const r2 = offlineCustomerSearch(pool, q);
      expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
    }
  });
});
