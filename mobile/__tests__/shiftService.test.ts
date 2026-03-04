/**
 * ShiftService unit tests + PBTs
 * (shift-management tasks 1.6, 3.5, 5.2, 5.3, 5.4)
 *
 * PBT Properties tested:
 *   Property 1 (task 5.4): expectedCash = openingFloat + sales - refunds - drops - paidouts + payins
 *   Property 2 (task 3.5): at most one open shift per terminal
 *   Property 3 (task 1.6): PINs are never stored in plain text
 */

import {
  calculateExpectedCash,
  calculateVariance,
  hasOpenShift,
  getOpenShift,
  countOpenShiftsPerTerminal,
  hashPin,
  verifyPin,
  validatePinFormat,
  isPinLocked,
  recordFailedPinAttempt,
  resetPinAttempts,
  MAX_PIN_ATTEMPTS,
  type ShiftRecord,
  type ShiftCashEvent,
  type ShiftCashEventType,
} from "@/services/shift/ShiftService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShift(
  id: string,
  terminalId: string,
  status: "open" | "closed" = "open"
): ShiftRecord {
  return {
    id,
    terminalId,
    userId: "user-1",
    status,
    openedAt: new Date().toISOString(),
    closedAt: status === "closed" ? new Date().toISOString() : null,
    openingFloat: 500,
    closingCash: null,
  };
}

function randAmount(max = 1000): number {
  return Math.round((Math.random() * max + 0.01) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Unit tests: calculateExpectedCash
// ---------------------------------------------------------------------------

describe("calculateExpectedCash", () => {
  it("returns openingFloat for an empty event list", () => {
    const { expectedCash } = calculateExpectedCash(500, []);
    expect(expectedCash).toBe(500);
  });

  it("adds sales and payins to float", () => {
    const events: ShiftCashEvent[] = [
      { type: "sale", amount: 200, timestamp: new Date().toISOString() },
      { type: "payin", amount: 50, timestamp: new Date().toISOString() },
    ];
    const { expectedCash } = calculateExpectedCash(500, events);
    expect(expectedCash).toBe(750);
  });

  it("subtracts refunds, drops, and paidouts", () => {
    const events: ShiftCashEvent[] = [
      { type: "sale",    amount: 300, timestamp: new Date().toISOString() },
      { type: "refund",  amount: 50,  timestamp: new Date().toISOString() },
      { type: "drop",    amount: 100, timestamp: new Date().toISOString() },
      { type: "paidout", amount: 20,  timestamp: new Date().toISOString() },
    ];
    const { expectedCash } = calculateExpectedCash(500, events);
    // 500 + 300 - 50 - 100 - 20 = 630
    expect(expectedCash).toBe(630);
  });

  it("expectedCash is never negative", () => {
    const events: ShiftCashEvent[] = [
      { type: "refund", amount: 9999, timestamp: new Date().toISOString() },
    ];
    const { expectedCash } = calculateExpectedCash(100, events);
    expect(expectedCash).toBeGreaterThanOrEqual(0);
  });

  it("returns correct per-category totals", () => {
    const events: ShiftCashEvent[] = [
      { type: "sale",    amount: 100, timestamp: new Date().toISOString() },
      { type: "sale",    amount: 200, timestamp: new Date().toISOString() },
      { type: "refund",  amount: 30,  timestamp: new Date().toISOString() },
      { type: "drop",    amount: 50,  timestamp: new Date().toISOString() },
      { type: "paidout", amount: 10,  timestamp: new Date().toISOString() },
      { type: "payin",   amount: 25,  timestamp: new Date().toISOString() },
    ];
    const summary = calculateExpectedCash(500, events);
    expect(summary.cashSales).toBe(300);
    expect(summary.cashRefunds).toBe(30);
    expect(summary.cashDrops).toBe(50);
    expect(summary.paidOuts).toBe(10);
    expect(summary.payIns).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateVariance
// ---------------------------------------------------------------------------

describe("calculateVariance", () => {
  it("returns 0 when actual matches expected", () => {
    expect(calculateVariance(500, 500)).toBe(0);
  });

  it("positive when over", () => {
    expect(calculateVariance(500, 550)).toBe(50);
  });

  it("negative when short", () => {
    expect(calculateVariance(500, 450)).toBe(-50);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasOpenShift / getOpenShift
// ---------------------------------------------------------------------------

describe("hasOpenShift and getOpenShift", () => {
  const shifts: ShiftRecord[] = [
    makeShift("s1", "terminal-1", "open"),
    makeShift("s2", "terminal-2", "open"),
    makeShift("s3", "terminal-1", "closed"),
  ];

  it("detects existing open shift on terminal", () => {
    expect(hasOpenShift("terminal-1", shifts)).toBe(true);
  });

  it("returns false for terminal with no open shift", () => {
    expect(hasOpenShift("terminal-3", shifts)).toBe(false);
  });

  it("gets the open shift record for a terminal", () => {
    const shift = getOpenShift("terminal-1", shifts);
    expect(shift?.id).toBe("s1");
  });

  it("returns null when no open shift found", () => {
    expect(getOpenShift("terminal-3", shifts)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unit tests: PIN functions
// ---------------------------------------------------------------------------

describe("validatePinFormat", () => {
  it("accepts 4-digit PIN", () => expect(validatePinFormat("1234").valid).toBe(true));
  it("accepts 6-digit PIN", () => expect(validatePinFormat("123456").valid).toBe(true));
  it("rejects 3-digit PIN", () => expect(validatePinFormat("123").valid).toBe(false));
  it("rejects 7-digit PIN", () => expect(validatePinFormat("1234567").valid).toBe(false));
  it("rejects PIN with letters", () => expect(validatePinFormat("12ab").valid).toBe(false));
});

describe("hashPin and verifyPin", () => {
  it("hashing the same PIN+salt produces the same hash", () => {
    expect(hashPin("1234", "user-abc")).toBe(hashPin("1234", "user-abc"));
  });

  it("different PINs produce different hashes", () => {
    expect(hashPin("1234", "user-abc")).not.toBe(hashPin("5678", "user-abc"));
  });

  it("different salts produce different hashes for the same PIN", () => {
    expect(hashPin("1234", "user-abc")).not.toBe(hashPin("1234", "user-xyz"));
  });

  it("verifyPin returns true for correct PIN", () => {
    const stored = hashPin("4321", "user-abc");
    expect(verifyPin("4321", "user-abc", stored)).toBe(true);
  });

  it("verifyPin returns false for wrong PIN", () => {
    const stored = hashPin("4321", "user-abc");
    expect(verifyPin("9999", "user-abc", stored)).toBe(false);
  });

  it("stored hash is not the plain text PIN (Property 3 basic check)", () => {
    const stored = hashPin("1234", "user-abc");
    expect(stored).not.toBe("1234");
    expect(stored).not.toContain("1234");
  });
});

describe("lockout management", () => {
  it("starts unlocked", () => {
    expect(isPinLocked({ attempts: 0, lockedAt: null })).toBe(false);
  });

  it("locked after MAX_PIN_ATTEMPTS failures", () => {
    let state = { attempts: 0, lockedAt: null };
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
      state = recordFailedPinAttempt(state);
    }
    expect(isPinLocked(state)).toBe(true);
    expect(state.lockedAt).not.toBeNull();
  });

  it("resetPinAttempts clears lockout", () => {
    const locked = { attempts: MAX_PIN_ATTEMPTS, lockedAt: new Date().toISOString() };
    const reset = resetPinAttempts();
    expect(isPinLocked(reset)).toBe(false);
    expect(reset.attempts).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 1 — Expected cash formula holds for any event mix (task 5.4)
// ---------------------------------------------------------------------------

describe("PBT Property 1: expectedCash = float + sales - refunds - drops - paidouts + payins (task 5.4)", () => {
  const EVENT_TYPES: ShiftCashEventType[] = ["sale", "refund", "drop", "paidout", "payin"];

  it("Property 1 holds for any combination of events — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const openingFloat = randAmount(2000);
      const n = Math.floor(Math.random() * 20);
      const events: ShiftCashEvent[] = Array.from({ length: n }, () => ({
        type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
        amount: randAmount(500),
        timestamp: new Date().toISOString(),
      }));

      const summary = calculateExpectedCash(openingFloat, events);

      // Property 1: expectedCash = openingFloat + sales - refunds - drops - paidouts + payins
      const expected = Math.max(
        0,
        Math.round(
          (openingFloat + summary.cashSales - summary.cashRefunds
            - summary.cashDrops - summary.paidOuts + summary.payIns) * 100
        ) / 100
      );
      expect(summary.expectedCash).toBeCloseTo(expected, 2);
    }
  });

  it("expectedCash is always non-negative — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const openingFloat = randAmount(500);
      const n = Math.floor(Math.random() * 15);
      const events: ShiftCashEvent[] = Array.from({ length: n }, () => ({
        type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
        amount: randAmount(1000),
        timestamp: new Date().toISOString(),
      }));
      const { expectedCash } = calculateExpectedCash(openingFloat, events);
      expect(expectedCash).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 2 — Single active shift per terminal (task 3.5)
// ---------------------------------------------------------------------------

describe("PBT Property 2: at most one open shift per terminal (task 3.5)", () => {
  it("countOpenShiftsPerTerminal never exceeds 1 for valid states — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const numTerminals = Math.floor(Math.random() * 5) + 1;
      const terminals = Array.from({ length: numTerminals }, (_, idx) => `term-${idx}`);

      // Simulate valid state: at most one open shift per terminal
      const shifts: ShiftRecord[] = [];
      for (const term of terminals) {
        const isOpen = Math.random() > 0.4;
        if (isOpen) {
          shifts.push(makeShift(`s-${term}`, term, "open"));
        }
        // Add some closed shifts for history
        const closedCount = Math.floor(Math.random() * 3);
        for (let c = 0; c < closedCount; c++) {
          shifts.push(makeShift(`s-${term}-${c}`, term, "closed"));
        }
      }

      const counts = countOpenShiftsPerTerminal(shifts);
      for (const [_termId, count] of counts) {
        expect(count).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 3 — PIN hashes are not plain text (task 1.6)
// ---------------------------------------------------------------------------

describe("PBT Property 3: PIN hash is never plain text (task 1.6)", () => {
  const PINS = ["0000", "1234", "9999", "123456", "000000"];

  it("hash output is a hex string, never the PIN itself — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const pin = String(Math.floor(Math.random() * 9000 + 1000)); // 4-digit
      const salt = `user-${Math.random().toString(36).slice(2)}`;
      const hash = hashPin(pin, salt);

      // Property 3: hash is NOT the plain text PIN
      expect(hash).not.toBe(pin);
      expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex = 64 chars
    }
  });

  it("same PIN + same salt always produces same hash (deterministic) — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const pin = PINS[Math.floor(Math.random() * PINS.length)];
      const salt = `u-${Math.random().toString(36).slice(2)}`;
      expect(hashPin(pin, salt)).toBe(hashPin(pin, salt));
    }
  });

  it("different salts always produce different hashes for the same PIN — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const pin = "1234";
      const saltA = `user-${Math.random().toString(36).slice(2)}`;
      const saltB = `user-${Math.random().toString(36).slice(2)}`;
      if (saltA !== saltB) {
        expect(hashPin(pin, saltA)).not.toBe(hashPin(pin, saltB));
      }
    }
  });
});
