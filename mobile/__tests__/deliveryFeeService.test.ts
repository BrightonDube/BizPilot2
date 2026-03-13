/**
 * Tests for DeliveryFeeService — task 12.4.
 *
 * Coverage:
 * - Flat rate fee calculation
 * - Distance-based fee calculation
 * - Order value tiered fee calculation
 * - Zone-based fee calculation
 * - Free delivery threshold
 * - Error cases (distance exceeds max, negative distance)
 * - Delivery time estimation
 */

import {
  calculateDeliveryFee,
  estimateDeliveryTimeMinutes,
  FlatRateConfig,
  DistanceBasedConfig,
  OrderValueTieredConfig,
  ZoneBasedConfig,
} from "../services/orders/DeliveryFeeService";

// ---------------------------------------------------------------------------
// Flat rate
// ---------------------------------------------------------------------------

describe("calculateDeliveryFee — flat_rate", () => {
  const config: FlatRateConfig = { strategy: "flat_rate", fee: 45 };

  it("returns the flat fee", () => {
    const result = calculateDeliveryFee(config, 200);
    expect(result.fee).toBe(45);
    expect(result.wasFreeDelivery).toBe(false);
    expect(result.description).toContain("45.00");
  });

  it("applies free delivery rule when order exceeds threshold", () => {
    const result = calculateDeliveryFee(config, 500, undefined, undefined, {
      minOrderValue: 300,
    });
    expect(result.fee).toBe(0);
    expect(result.wasFreeDelivery).toBe(true);
  });

  it("charges fee when order below free delivery threshold", () => {
    const result = calculateDeliveryFee(config, 200, undefined, undefined, {
      minOrderValue: 300,
    });
    expect(result.fee).toBe(45);
    expect(result.wasFreeDelivery).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Distance-based
// ---------------------------------------------------------------------------

describe("calculateDeliveryFee — distance_based", () => {
  const config: DistanceBasedConfig = {
    strategy: "distance_based",
    baseFee: 20,
    perKmFee: 5,
    maxDistanceKm: 15,
  };

  it("calculates base + per-km fee", () => {
    // 20 + (5 * 8) = 60
    const result = calculateDeliveryFee(config, 200, 8);
    expect(result.fee).toBe(60);
  });

  it("charges only base fee for 0km distance", () => {
    const result = calculateDeliveryFee(config, 200, 0);
    expect(result.fee).toBe(20);
  });

  it("throws when distance exceeds maximum", () => {
    expect(() => calculateDeliveryFee(config, 200, 20)).toThrow(
      "exceeds maximum"
    );
  });

  it("throws for negative distance", () => {
    expect(() => calculateDeliveryFee(config, 200, -5)).toThrow(
      "cannot be negative"
    );
  });

  it("handles decimal distances", () => {
    // 20 + (5 * 3.5) = 37.5
    const result = calculateDeliveryFee(config, 200, 3.5);
    expect(result.fee).toBe(37.5);
  });
});

// ---------------------------------------------------------------------------
// Order value tiered
// ---------------------------------------------------------------------------

describe("calculateDeliveryFee — order_value_tiered", () => {
  const config: OrderValueTieredConfig = {
    strategy: "order_value_tiered",
    tiers: [
      { minOrderValue: 0, fee: 60 },
      { minOrderValue: 100, fee: 40 },
      { minOrderValue: 200, fee: 25 },
      { minOrderValue: 400, fee: 10 },
    ],
  };

  it("returns highest matching tier fee", () => {
    // Order value 250 matches tiers 0, 100, 200 → use 200 tier = R 25
    const result = calculateDeliveryFee(config, 250);
    expect(result.fee).toBe(25);
  });

  it("returns lowest tier for small orders", () => {
    const result = calculateDeliveryFee(config, 50);
    expect(result.fee).toBe(60); // 0 tier
  });

  it("returns highest tier for large orders", () => {
    const result = calculateDeliveryFee(config, 500);
    expect(result.fee).toBe(10); // 400 tier
  });

  it("matches exact tier boundary", () => {
    const result = calculateDeliveryFee(config, 200);
    expect(result.fee).toBe(25); // exactly 200 tier
  });
});

// ---------------------------------------------------------------------------
// Zone-based
// ---------------------------------------------------------------------------

describe("calculateDeliveryFee — zone_based", () => {
  const config: ZoneBasedConfig = {
    strategy: "zone_based",
    zones: [
      { zoneId: "zone-a", zoneName: "CBD", fee: 25 },
      { zoneId: "zone-b", zoneName: "Suburbs", fee: 45 },
      { zoneId: "zone-c", zoneName: "Outskirts", fee: 70 },
    ],
    defaultFee: 60,
  };

  it("returns zone fee for matching zone", () => {
    const result = calculateDeliveryFee(config, 200, undefined, "zone-a");
    expect(result.fee).toBe(25);
    expect(result.description).toContain("CBD");
  });

  it("returns default fee for unknown zone", () => {
    const result = calculateDeliveryFee(config, 200, undefined, "zone-unknown");
    expect(result.fee).toBe(60);
  });

  it("returns default fee when no zone specified", () => {
    const result = calculateDeliveryFee(config, 200);
    expect(result.fee).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Delivery time estimation
// ---------------------------------------------------------------------------

describe("estimateDeliveryTimeMinutes", () => {
  it("estimates time for short distance", () => {
    // 5km at 30km/h = 10 min + 15 min prep = 25 min
    expect(estimateDeliveryTimeMinutes(5)).toBe(25);
  });

  it("estimates time for longer distance", () => {
    // 15km at 30km/h = 30 min + 15 min prep = 45 min
    expect(estimateDeliveryTimeMinutes(15)).toBe(45);
  });

  it("uses custom prep time", () => {
    // 10km at 30km/h = 20 min + 30 min prep = 50 min
    expect(estimateDeliveryTimeMinutes(10, 30)).toBe(50);
  });

  it("returns prep time only for 0km", () => {
    expect(estimateDeliveryTimeMinutes(0)).toBe(15);
  });
});
