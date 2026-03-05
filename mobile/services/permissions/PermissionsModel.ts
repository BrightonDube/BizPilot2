/**
 * BizPilot Mobile POS — Permissions WatermelonDB Model (Task 15.1)
 *
 * Stores the business's granted features, subscription tier, and device
 * limits locally so the POS can enforce feature gates offline.
 *
 * Why WatermelonDB instead of AsyncStorage?
 * WatermelonDB provides observable queries — UI components re-render
 * automatically when permissions change after a sync. AsyncStorage
 * requires manual cache invalidation and polling, which is error-prone
 * in a POS that must reflect permission changes within seconds.
 *
 * Why a single record per business?
 * Each mobile device belongs to one business at a time. We store one
 * Permissions row keyed by businessId. On business switch (multi-business),
 * the sync handler upserts the correct record.
 *
 * Schema fields:
 * - businessId: UUID of the business this record belongs to
 * - grantedFeatures: JSON-stringified array of feature keys (e.g., ["payroll","ai_assistant"])
 * - tier: Subscription tier name ("basic" | "professional" | "enterprise")
 * - status: Subscription status ("active" | "trial" | "demo" | "suspended" | "cancelled" | "expired")
 * - demoExpiresAt: ISO timestamp when demo expires, or null
 * - deviceLimit: Maximum concurrent devices allowed
 * - syncedAt: ISO timestamp of the last successful permission sync
 */

// ---------------------------------------------------------------------------
// Types — exported for use by sync handler, hook, and tests
// ---------------------------------------------------------------------------

/**
 * Subscription tier levels supported by the platform.
 * "basic" is the free tier with limited features.
 */
export type SubscriptionTier = "basic" | "professional" | "enterprise";

/**
 * Subscription lifecycle status.
 * Only "active", "trial", and "demo" grant feature access.
 */
export type SubscriptionStatus =
  | "active"
  | "trial"
  | "demo"
  | "suspended"
  | "cancelled"
  | "expired";

/** Statuses that allow feature access */
const ACTIVE_STATUSES: readonly SubscriptionStatus[] = [
  "active",
  "trial",
  "demo",
] as const;

/**
 * The shape of a permissions record as stored locally.
 * This mirrors the WatermelonDB model schema but as a plain object
 * for use in pure-function services and tests.
 *
 * Why a plain type instead of coupling to WatermelonDB Model class?
 * Pure-function services and tests should not depend on WatermelonDB
 * runtime. Keeping the type plain allows service logic to be tested
 * without mocking the database layer.
 */
export interface PermissionsRecord {
  /** Unique record ID (WatermelonDB auto-generated) */
  id: string;
  /** UUID of the business this record belongs to */
  businessId: string;
  /** JSON-stringified array of granted feature keys */
  grantedFeatures: string;
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Current subscription status */
  status: SubscriptionStatus;
  /** ISO timestamp when demo expires, or empty string if not a demo */
  demoExpiresAt: string;
  /** Maximum concurrent devices allowed for this business */
  deviceLimit: number;
  /** ISO timestamp of the last successful permission sync */
  syncedAt: string;
}

/**
 * Payload received from the backend sync endpoint.
 * This is what the server sends; we transform it into a PermissionsRecord.
 */
export interface PermissionsSyncPayload {
  businessId: string;
  grantedFeatures: string[];
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  demoExpiresAt: string | null;
  deviceLimit: number;
}

// ---------------------------------------------------------------------------
// Schema definition — used by WatermelonDB schema builder
// ---------------------------------------------------------------------------

/**
 * WatermelonDB table name for permissions.
 * Convention: lowercase plural noun matching the backend table.
 */
export const PERMISSIONS_TABLE = "permissions";

/**
 * Column definitions for the permissions table.
 * Used in the WatermelonDB schema builder (appSchema / tableSchema).
 *
 * Why explicit column names instead of deriving from interface?
 * WatermelonDB requires column definitions at schema creation time
 * (before any TypeScript types exist at runtime). Explicit names
 * ensure the schema and types stay in sync via review, not magic.
 */
export const PERMISSIONS_COLUMNS = {
  businessId: "business_id",
  grantedFeatures: "granted_features",
  tier: "tier",
  status: "status",
  demoExpiresAt: "demo_expires_at",
  deviceLimit: "device_limit",
  syncedAt: "synced_at",
} as const;

// ---------------------------------------------------------------------------
// Helper functions — pure, testable logic
// ---------------------------------------------------------------------------

/**
 * Parse the JSON-stringified granted features into a string array.
 * Returns an empty array on parse failure for resilience.
 */
export function parseGrantedFeatures(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/**
 * Check whether a specific feature is granted for this permissions record.
 *
 * Rules (in order):
 * 1. If status is not in ACTIVE_STATUSES → no features granted
 * 2. If status is "demo" and demo has expired → no features granted
 * 3. Feature must be in the grantedFeatures array
 *
 * @param record - The local permissions record
 * @param feature - Feature key to check (e.g., "payroll", "ai_assistant")
 * @param now - Current timestamp for demo expiry check (ISO string or epoch ms)
 */
export function hasFeature(
  record: PermissionsRecord | null,
  feature: string,
  now?: string | number
): boolean {
  if (!record) return false;

  // Rule 1: status must be active
  if (!ACTIVE_STATUSES.includes(record.status)) return false;

  // Rule 2: demo expiry check
  if (record.status === "demo" && record.demoExpiresAt) {
    const expiresAt = new Date(record.demoExpiresAt).getTime();
    const currentTime =
      now !== undefined
        ? typeof now === "string"
          ? new Date(now).getTime()
          : now
        : Date.now();
    if (currentTime >= expiresAt) return false;
  }

  // Rule 3: feature must be in granted list
  const features = parseGrantedFeatures(record.grantedFeatures);
  return features.includes(feature);
}

/**
 * Check if the subscription is in demo mode (regardless of expiry).
 */
export function isDemo(record: PermissionsRecord | null): boolean {
  return record?.status === "demo";
}

/**
 * Check if the subscription status allows any feature access.
 */
export function isActive(record: PermissionsRecord | null): boolean {
  if (!record) return false;
  return ACTIVE_STATUSES.includes(record.status);
}

/**
 * Check if the permissions data is stale (older than maxAge).
 *
 * @param record - The local permissions record
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @param now - Current time for testing
 */
export function isPermissionsStale(
  record: PermissionsRecord | null,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
  now?: number
): boolean {
  if (!record || !record.syncedAt) return true;

  const syncedAt = new Date(record.syncedAt).getTime();
  const currentTime = now ?? Date.now();
  return currentTime - syncedAt > maxAgeMs;
}
