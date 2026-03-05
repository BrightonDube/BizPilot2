/**
 * DeliveryFeeService — calculate delivery fees based on configurable rules.
 *
 * Task: 12.4 (Calculate delivery fee)
 *
 * Requirement 9.5: "THE System SHALL calculate delivery fee."
 *
 * Why a separate service?
 * Delivery fee logic varies wildly between businesses: flat rate, distance-
 * based, order-value tiers, or free-above-threshold. Keeping this in its
 * own module makes it easy to add new fee strategies without touching
 * the order creation flow.
 *
 * Why pure functions?
 * Fee calculation runs on the POS during order creation to show the
 * customer the fee before they confirm. Must work offline.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeeStrategy =
  | "flat_rate"
  | "distance_based"
  | "order_value_tiered"
  | "zone_based";

export interface FlatRateConfig {
  strategy: "flat_rate";
  /** Fixed fee in ZAR */
  fee: number;
}

export interface DistanceBasedConfig {
  strategy: "distance_based";
  /** Base fee charged for any delivery (ZAR) */
  baseFee: number;
  /** Fee per kilometre (ZAR) */
  perKmFee: number;
  /** Maximum distance in km (beyond this, delivery is refused) */
  maxDistanceKm: number;
}

export interface OrderValueTieredConfig {
  strategy: "order_value_tiered";
  /** Tiers sorted by minOrderValue ascending */
  tiers: Array<{
    /** Minimum order value for this tier (ZAR) */
    minOrderValue: number;
    /** Delivery fee for this tier (ZAR) */
    fee: number;
  }>;
}

export interface ZoneBasedConfig {
  strategy: "zone_based";
  /** Zones with assigned fees */
  zones: Array<{
    zoneId: string;
    zoneName: string;
    fee: number;
  }>;
  /** Fee for unknown/unmatched zones */
  defaultFee: number;
}

export type DeliveryFeeConfig =
  | FlatRateConfig
  | DistanceBasedConfig
  | OrderValueTieredConfig
  | ZoneBasedConfig;

export interface DeliveryFeeResult {
  fee: number;
  /** Description of how the fee was calculated */
  description: string;
  /** Whether free delivery threshold was applied */
  wasFreeDelivery: boolean;
}

export interface FreeDeliveryRule {
  /** Order value above which delivery is free (ZAR) */
  minOrderValue: number;
}

// ---------------------------------------------------------------------------
// Fee calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the delivery fee based on the configured strategy.
 *
 * @param config          - Fee strategy configuration
 * @param orderValue      - Total order value before delivery fee (ZAR)
 * @param distanceKm      - Distance to delivery address (km), required for distance_based
 * @param zoneId          - Delivery zone ID, required for zone_based
 * @param freeDeliveryRule - Optional rule for free delivery above threshold
 */
export function calculateDeliveryFee(
  config: DeliveryFeeConfig,
  orderValue: number,
  distanceKm?: number,
  zoneId?: string,
  freeDeliveryRule?: FreeDeliveryRule
): DeliveryFeeResult {
  // Check free delivery threshold first
  if (freeDeliveryRule && orderValue >= freeDeliveryRule.minOrderValue) {
    return {
      fee: 0,
      description: `Free delivery on orders over R ${freeDeliveryRule.minOrderValue.toFixed(2)}`,
      wasFreeDelivery: true,
    };
  }

  switch (config.strategy) {
    case "flat_rate":
      return calculateFlatRate(config);

    case "distance_based":
      return calculateDistanceBased(config, distanceKm ?? 0);

    case "order_value_tiered":
      return calculateOrderValueTiered(config, orderValue);

    case "zone_based":
      return calculateZoneBased(config, zoneId);

    default: {
      // Exhaustive check — TypeScript will error if a strategy is missing
      const _exhaustive: never = config;
      throw new Error(`Unknown delivery fee strategy: ${(_exhaustive as DeliveryFeeConfig).strategy}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

function calculateFlatRate(config: FlatRateConfig): DeliveryFeeResult {
  return {
    fee: round2(config.fee),
    description: `Flat delivery fee: R ${config.fee.toFixed(2)}`,
    wasFreeDelivery: false,
  };
}

function calculateDistanceBased(
  config: DistanceBasedConfig,
  distanceKm: number
): DeliveryFeeResult {
  if (distanceKm > config.maxDistanceKm) {
    throw new Error(
      `Delivery distance ${distanceKm}km exceeds maximum of ${config.maxDistanceKm}km`
    );
  }

  if (distanceKm < 0) {
    throw new Error(`Distance cannot be negative (got ${distanceKm}km)`);
  }

  const fee = round2(config.baseFee + distanceKm * config.perKmFee);

  return {
    fee,
    description: `R ${config.baseFee.toFixed(2)} base + R ${config.perKmFee.toFixed(2)}/km × ${distanceKm.toFixed(1)}km = R ${fee.toFixed(2)}`,
    wasFreeDelivery: false,
  };
}

function calculateOrderValueTiered(
  config: OrderValueTieredConfig,
  orderValue: number
): DeliveryFeeResult {
  // Tiers are expected sorted ascending by minOrderValue
  // Find the highest tier the order qualifies for
  let matchedTier = config.tiers[0]; // fallback to first tier

  for (const tier of config.tiers) {
    if (orderValue >= tier.minOrderValue) {
      matchedTier = tier;
    }
  }

  if (!matchedTier) {
    return {
      fee: 0,
      description: "No delivery fee tier matched",
      wasFreeDelivery: false,
    };
  }

  return {
    fee: round2(matchedTier.fee),
    description: `Delivery fee for orders over R ${matchedTier.minOrderValue.toFixed(2)}: R ${matchedTier.fee.toFixed(2)}`,
    wasFreeDelivery: false,
  };
}

function calculateZoneBased(
  config: ZoneBasedConfig,
  zoneId?: string
): DeliveryFeeResult {
  if (!zoneId) {
    return {
      fee: round2(config.defaultFee),
      description: `Default delivery fee (no zone specified): R ${config.defaultFee.toFixed(2)}`,
      wasFreeDelivery: false,
    };
  }

  const zone = config.zones.find((z) => z.zoneId === zoneId);

  if (!zone) {
    return {
      fee: round2(config.defaultFee),
      description: `Default delivery fee (zone not found): R ${config.defaultFee.toFixed(2)}`,
      wasFreeDelivery: false,
    };
  }

  return {
    fee: round2(zone.fee),
    description: `Delivery to ${zone.zoneName}: R ${zone.fee.toFixed(2)}`,
    wasFreeDelivery: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimate delivery time based on distance (rough heuristic).
 *
 * Why a simple formula instead of a routing API?
 * The POS must work offline. This gives a reasonable estimate for
 * South African urban delivery (avg 30km/h including traffic + prep).
 */
export function estimateDeliveryTimeMinutes(
  distanceKm: number,
  prepTimeMinutes: number = 15
): number {
  const travelMinutes = Math.ceil((distanceKm / 30) * 60); // 30 km/h average
  return prepTimeMinutes + travelMinutes;
}
