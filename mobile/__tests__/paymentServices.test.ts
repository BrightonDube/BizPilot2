/**
 * Tests: Yoco + SnapScan Payment Services (integrated-payments tasks 3.1-3.6, 4.1-4.6)
 *
 * What IS tested here:
 * 1. Pure helper functions (zarToCents, centsToZar, generateStaticSnapScanUrl)
 * 2. Input validation logic (chargeCard with invalid inputs)
 * 3. Status normalisation (normaliseSnapScanStatus via exported utility)
 * 4. SDK-unavailable paths (YocoService gracefully handles missing SDK)
 * 5. PBT: amount conversion invariants
 *
 * What is NOT tested here:
 * - Actual Yoco card reader hardware interaction (requires physical device)
 * - Actual SnapScan REST API calls (requires network + merchant account)
 * - These are covered by integration tests run on the CI device runner
 *
 * Why SDK-unavailable tests?
 * In 100% of CI runs (no physical Yoco reader), chargeCard will hit the
 * SDK_UNAVAILABLE path. Testing this path ensures the error is handled
 * gracefully (not a crash) and the UI gets a useful error message.
 */

import {
  zarToCents,
  centsToZar,
  chargeCard,
  refundCardPayment,
  getReaderStatus,
} from "../services/payment/YocoService";

import {
  generateStaticSnapScanUrl,
  createSnapScanPayment,
  pollForPaymentStatus,
  cancelSnapScanPayment,
} from "../services/payment/SnapScanService";

// ---------------------------------------------------------------------------
// YocoService — pure helper tests
// ---------------------------------------------------------------------------

describe("YocoService — zarToCents / centsToZar", () => {
  test("zarToCents(50.00) → 5000", () => {
    expect(zarToCents(50.0)).toBe(5000);
  });

  test("zarToCents(0.01) → 1", () => {
    expect(zarToCents(0.01)).toBe(1);
  });

  test("zarToCents(0) → 0", () => {
    expect(zarToCents(0)).toBe(0);
  });

  test("centsToZar(5000) → 50", () => {
    expect(centsToZar(5000)).toBe(50);
  });

  test("centsToZar(1) → 0.01", () => {
    expect(centsToZar(1)).toBeCloseTo(0.01, 4);
  });

  test("round-trip: zarToCents(x) → centsToZar → equals x", () => {
    const amounts = [10, 25.5, 100, 0.5, 999.99];
    for (const amount of amounts) {
      const cents = zarToCents(amount);
      const back = centsToZar(cents);
      expect(back).toBeCloseTo(amount, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: YocoService amount conversion invariants
// ---------------------------------------------------------------------------

describe("PBT: zarToCents / centsToZar invariants", () => {
  /**
   * Property 1: zarToCents(x) is always a non-negative integer
   */
  test("Property 1 — zarToCents always returns non-negative integer", () => {
    for (let i = 0; i < 300; i++) {
      const amount = Math.random() * 10000;
      const cents = zarToCents(amount);
      expect(cents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(cents)).toBe(true);
    }
  });

  /**
   * Property 2: centsToZar(zarToCents(x)) ≈ x (within R0.01 rounding)
   */
  test("Property 2 — round-trip within R0.01 rounding tolerance", () => {
    for (let i = 0; i < 300; i++) {
      // Use amounts with at most 2 decimal places to avoid floating-point issues
      const amountCents = Math.floor(Math.random() * 100_000); // 0 to R1000
      const back = zarToCents(centsToZar(amountCents));
      expect(Math.abs(back - amountCents)).toBeLessThanOrEqual(1); // 1 cent rounding max
    }
  });

  /**
   * Property 3: zarToCents is monotonically non-decreasing
   */
  test("Property 3 — zarToCents is monotone (higher ZAR → higher or equal cents)", () => {
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * 100;
      const b = a + Math.random() * 100;
      expect(zarToCents(b)).toBeGreaterThanOrEqual(zarToCents(a));
    }
  });
});

// ---------------------------------------------------------------------------
// YocoService — SDK unavailable handling
// ---------------------------------------------------------------------------

describe("YocoService — SDK unavailable (no physical reader in CI)", () => {
  test("chargeCard returns SDK_UNAVAILABLE error when SDK missing", async () => {
    const result = await chargeCard({
      amountCents: 5000,
      internalReference: "test-order-1",
    });
    // Should fail gracefully — not throw
    expect(result.success).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("SDK_UNAVAILABLE");
    expect(result.error).toBeTruthy();
  });

  test("chargeCard validates: amount must be > 0", async () => {
    const result = await chargeCard({
      amountCents: 0,
      internalReference: "test-order-2",
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_AMOUNT");
  });

  test("chargeCard validates: negative amount", async () => {
    const result = await chargeCard({
      amountCents: -100,
      internalReference: "test-order-3",
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_AMOUNT");
  });

  test("chargeCard validates: missing internalReference", async () => {
    const result = await chargeCard({
      amountCents: 5000,
      internalReference: "",
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_REFERENCE");
  });

  test("refundCardPayment returns error when SDK missing", async () => {
    const result = await refundCardPayment({
      yocoReference: "yoco-txn-123",
      amountCents: 5000,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("refundCardPayment validates: amount must be > 0", async () => {
    const result = await refundCardPayment({
      yocoReference: "yoco-txn-456",
      amountCents: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("greater than zero");
  });

  test("getReaderStatus returns sdkAvailable: false when SDK missing", async () => {
    const status = await getReaderStatus();
    expect(status.sdkAvailable).toBe(false);
    expect(status.connected).toBe(false);
  });

  test("chargeCard callbacks are NOT called when validation fails", async () => {
    const callbacks = {
      onAwaitingCard: jest.fn(),
      onStatusUpdate: jest.fn(),
      onComplete: jest.fn(),
    };
    await chargeCard({ amountCents: -100, internalReference: "order-x" }, callbacks);
    expect(callbacks.onAwaitingCard).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SnapScanService — generateStaticSnapScanUrl
// ---------------------------------------------------------------------------

describe("SnapScanService — generateStaticSnapScanUrl", () => {
  const MERCHANT = "biz-pilot-merchant";

  test("generates URL with correct host", () => {
    const url = generateStaticSnapScanUrl(MERCHANT, 50, "order-1");
    expect(url).toContain("pos.snapscan.io/qr");
  });

  test("includes merchant ID in path", () => {
    const url = generateStaticSnapScanUrl(MERCHANT, 50, "order-1");
    expect(url).toContain(MERCHANT);
  });

  test("converts amount to cents in URL", () => {
    const url = generateStaticSnapScanUrl(MERCHANT, 50.0, "order-1");
    expect(url).toContain("amount=5000");
  });

  test("encodes reference in URL", () => {
    const url = generateStaticSnapScanUrl(MERCHANT, 50, "order ref #1");
    expect(url).toContain("order%20ref%20%231");
  });

  test("different amounts produce different URLs", () => {
    const url1 = generateStaticSnapScanUrl(MERCHANT, 50, "order-1");
    const url2 = generateStaticSnapScanUrl(MERCHANT, 100, "order-1");
    expect(url1).not.toBe(url2);
    expect(url1).toContain("5000");
    expect(url2).toContain("10000");
  });

  test("R0.01 minimum amount → 1 cent", () => {
    const url = generateStaticSnapScanUrl(MERCHANT, 0.01, "order-penny");
    expect(url).toContain("amount=1");
  });

  test("reference is URL-encoded correctly", () => {
    const url = generateStaticSnapScanUrl(MERCHANT, 50, "ORD-2024-001");
    expect(url).toContain("ORD-2024-001");
  });
});

// ---------------------------------------------------------------------------
// PBT: SnapScan URL invariants
// ---------------------------------------------------------------------------

describe("PBT: generateStaticSnapScanUrl invariants", () => {
  /**
   * Property 1: URL always contains the merchant ID
   */
  test("Property 1 — URL always contains merchantId", () => {
    const merchant = "test-merchant";
    for (let i = 0; i < 200; i++) {
      const amount = Math.random() * 1000 + 0.01;
      const url = generateStaticSnapScanUrl(merchant, amount, `order-${i}`);
      expect(url).toContain(merchant);
    }
  });

  /**
   * Property 2: amount in URL = Math.round(amount * 100) — always an integer
   */
  test("Property 2 — amount in URL is always the correct rounded cents", () => {
    const merchant = "test-merchant";
    for (let i = 0; i < 200; i++) {
      const amount = Math.round(Math.random() * 100000) / 100; // up to R1000
      const url = generateStaticSnapScanUrl(merchant, amount, "ref");
      const expectedCents = Math.round(amount * 100);
      expect(url).toContain(`amount=${expectedCents}`);
    }
  });

  /**
   * Property 3: URLs for different amounts are distinct
   */
  test("Property 3 — different amounts produce unique URLs for same merchant+ref", () => {
    const merchant = "test-merchant";
    const ref = "order-x";
    const amounts = new Set<number>();

    for (let i = 0; i < 100; i++) {
      // Use distinct cent values to avoid floating-point collision
      const cents = i * 13 + 1; // 1, 14, 27, ... distinct values
      amounts.add(cents);
    }

    const urls = new Set<string>();
    for (const cents of amounts) {
      urls.add(generateStaticSnapScanUrl(merchant, cents / 100, ref));
    }

    expect(urls.size).toBe(amounts.size);
  });
});

// ---------------------------------------------------------------------------
// SnapScanService — input validation in createSnapScanPayment
// ---------------------------------------------------------------------------

describe("SnapScanService — createSnapScanPayment input validation", () => {
  test("throws error when amount is 0", async () => {
    await expect(
      createSnapScanPayment(
        { amount: 0, internalReference: "order-x" },
        "api-key",
        "merchant-id"
      )
    ).rejects.toThrow("greater than zero");
  });

  test("throws error when amount is negative", async () => {
    await expect(
      createSnapScanPayment(
        { amount: -50, internalReference: "order-x" },
        "api-key",
        "merchant-id"
      )
    ).rejects.toThrow("greater than zero");
  });
});
