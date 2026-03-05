/**
 * Unit tests for PMSService pure functions.
 */

import {
  validateRoomCharge,
  requiresAuthorization,
  validateRoomNumber,
  searchGuests,
  filterActiveGuests,
  calculateGuestAvailableCredit,
  formatChargeDescription,
  buildOfflineCharge,
  sortFolioEntries,
  calculateFolioTotals,
  isGuestCheckingOutToday,
  getConnectionStatusColor,
  type GuestProfile,
  type RoomChargeRequest,
  type FolioEntry,
} from "@/services/pms/PMSService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuest(overrides: Partial<GuestProfile> = {}): GuestProfile {
  return {
    id: "g-1",
    roomNumber: "101",
    guestName: "John Smith",
    checkInDate: "2025-01-10",
    checkOutDate: "2025-01-20",
    folioNumber: "F-1001",
    vipStatus: false,
    creditLimit: 5000,
    currentBalance: 1000,
    allowCharges: true,
    ...overrides,
  };
}

function makeChargeRequest(
  overrides: Partial<RoomChargeRequest> = {}
): RoomChargeRequest {
  return {
    orderId: "ord-1",
    roomNumber: "101",
    guestId: "g-1",
    amount: 250,
    description: "2× Cappuccino",
    items: [{ name: "Cappuccino", quantity: 2, price: 125 }],
    authorizationType: "none",
    ...overrides,
  };
}

function makeFolioEntry(overrides: Partial<FolioEntry> = {}): FolioEntry {
  return {
    id: "fe-1",
    date: "2025-01-15T10:00:00Z",
    description: "Room charge",
    amount: 100,
    type: "charge",
    source: "POS",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. validateRoomCharge
// ---------------------------------------------------------------------------

describe("validateRoomCharge", () => {
  it("validates a correct charge request", () => {
    const result = validateRoomCharge(makeChargeRequest(), makeGuest());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects when guest disallows charges", () => {
    const result = validateRoomCharge(
      makeChargeRequest(),
      makeGuest({ allowCharges: false })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Room charges are not permitted for this guest"
    );
  });

  it("rejects zero/negative amount", () => {
    const result = validateRoomCharge(
      makeChargeRequest({ amount: 0 }),
      makeGuest()
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Charge amount must be greater than zero"
    );
  });

  it("rejects amount exceeding available credit", () => {
    const guest = makeGuest({ creditLimit: 1000, currentBalance: 900 });
    const result = validateRoomCharge(
      makeChargeRequest({ amount: 200 }),
      guest
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/exceeds available credit/);
  });

  it("rejects room number mismatch", () => {
    const result = validateRoomCharge(
      makeChargeRequest({ roomNumber: "999" }),
      makeGuest({ roomNumber: "101" })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/Room number mismatch/);
  });
});

// ---------------------------------------------------------------------------
// 2. requiresAuthorization
// ---------------------------------------------------------------------------

describe("requiresAuthorization", () => {
  it('returns "none" below threshold', () => {
    expect(requiresAuthorization(499, 500)).toBe("none");
  });

  it('returns "signature" at threshold', () => {
    expect(requiresAuthorization(500, 500)).toBe("signature");
  });

  it('returns "pin" at 2× threshold', () => {
    expect(requiresAuthorization(1000, 500)).toBe("pin");
  });
});

// ---------------------------------------------------------------------------
// 3. validateRoomNumber
// ---------------------------------------------------------------------------

describe("validateRoomNumber", () => {
  it("accepts valid alphanumeric room numbers", () => {
    expect(validateRoomNumber("101")).toBe(true);
    expect(validateRoomNumber("PH01")).toBe(true);
  });

  it("rejects empty or special-character strings", () => {
    expect(validateRoomNumber("")).toBe(false);
    expect(validateRoomNumber("10-1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. searchGuests
// ---------------------------------------------------------------------------

describe("searchGuests", () => {
  const guests = [
    makeGuest({ id: "g-1", roomNumber: "101", guestName: "John Smith" }),
    makeGuest({ id: "g-2", roomNumber: "202", guestName: "Jane Doe" }),
  ];

  it("filters by guest name (case-insensitive)", () => {
    expect(searchGuests(guests, "jane").map((g) => g.id)).toEqual(["g-2"]);
  });

  it("filters by room number", () => {
    expect(searchGuests(guests, "202").map((g) => g.id)).toEqual(["g-2"]);
  });
});

// ---------------------------------------------------------------------------
// 5. filterActiveGuests
// ---------------------------------------------------------------------------

describe("filterActiveGuests", () => {
  it("returns only guests whose stay spans the current date", () => {
    const guests = [
      makeGuest({ id: "active", checkInDate: "2025-01-10", checkOutDate: "2025-01-20" }),
      makeGuest({ id: "past", checkInDate: "2025-01-01", checkOutDate: "2025-01-05" }),
    ];

    const active = filterActiveGuests(guests, new Date("2025-01-15"));
    expect(active.map((g) => g.id)).toEqual(["active"]);
  });
});

// ---------------------------------------------------------------------------
// 6. calculateGuestAvailableCredit
// ---------------------------------------------------------------------------

describe("calculateGuestAvailableCredit", () => {
  it("returns remaining credit", () => {
    expect(
      calculateGuestAvailableCredit(
        makeGuest({ creditLimit: 5000, currentBalance: 1000 })
      )
    ).toBe(4000);
  });

  it("returns 0 when balance exceeds limit", () => {
    expect(
      calculateGuestAvailableCredit(
        makeGuest({ creditLimit: 500, currentBalance: 800 })
      )
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. formatChargeDescription
// ---------------------------------------------------------------------------

describe("formatChargeDescription", () => {
  it("formats items as quantity× name joined by comma", () => {
    const desc = formatChargeDescription([
      { name: "Cappuccino", quantity: 2, price: 55 },
      { name: "Club Sandwich", quantity: 1, price: 120 },
    ]);
    expect(desc).toBe("2× Cappuccino, 1× Club Sandwich");
  });

  it('returns "No items" for empty array', () => {
    expect(formatChargeDescription([])).toBe("No items");
  });
});

// ---------------------------------------------------------------------------
// 8. buildOfflineCharge
// ---------------------------------------------------------------------------

describe("buildOfflineCharge", () => {
  it("creates a queued_offline result with chargeId and queuedAt", () => {
    const now = new Date("2025-02-01T12:00:00Z");
    const result = buildOfflineCharge(makeChargeRequest(), now);

    expect(result.status).toBe("queued_offline");
    expect(result.success).toBe(false);
    expect(result.chargeId).toContain("offline-ord-1-");
    expect(result.queuedAt).toBe(now.toISOString());
  });
});

// ---------------------------------------------------------------------------
// 9. sortFolioEntries
// ---------------------------------------------------------------------------

describe("sortFolioEntries", () => {
  it("sorts ascending by date", () => {
    const entries = [
      makeFolioEntry({ id: "late", date: "2025-01-20T00:00:00Z" }),
      makeFolioEntry({ id: "early", date: "2025-01-10T00:00:00Z" }),
    ];

    const sorted = sortFolioEntries(entries, "asc");
    expect(sorted.map((e) => e.id)).toEqual(["early", "late"]);
  });
});

// ---------------------------------------------------------------------------
// 10. calculateFolioTotals
// ---------------------------------------------------------------------------

describe("calculateFolioTotals", () => {
  it("aggregates charges, payments, and adjustments", () => {
    const entries: FolioEntry[] = [
      makeFolioEntry({ amount: 500, type: "charge" }),
      makeFolioEntry({ amount: 200, type: "payment" }),
      makeFolioEntry({ amount: -50, type: "adjustment" }),
    ];

    const totals = calculateFolioTotals(entries);

    expect(totals.totalCharges).toBe(450); // 500 + (-50)
    expect(totals.totalPayments).toBe(200);
    expect(totals.balance).toBe(250); // 450 - 200
  });
});

// ---------------------------------------------------------------------------
// 11. isGuestCheckingOutToday
// ---------------------------------------------------------------------------

describe("isGuestCheckingOutToday", () => {
  it("returns true when checkOutDate matches today", () => {
    const guest = makeGuest({ checkOutDate: "2025-01-15" });
    expect(isGuestCheckingOutToday(guest, new Date("2025-01-15T14:00:00Z"))).toBe(true);
  });

  it("returns false when checkOutDate is another day", () => {
    const guest = makeGuest({ checkOutDate: "2025-01-20" });
    expect(isGuestCheckingOutToday(guest, new Date("2025-01-15T14:00:00Z"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12. getConnectionStatusColor
// ---------------------------------------------------------------------------

describe("getConnectionStatusColor", () => {
  it("returns correct hex colours for each status", () => {
    expect(getConnectionStatusColor("connected")).toBe("#22c55e");
    expect(getConnectionStatusColor("disconnected")).toBe("#ef4444");
    expect(getConnectionStatusColor("error")).toBe("#f59e0b");
    expect(getConnectionStatusColor("syncing")).toBe("#3b82f6");
  });
});
