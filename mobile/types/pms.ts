/**
 * BizPilot Mobile POS — PMS (Property Management System) Types
 *
 * Types for hotel PMS integration: guest profiles, room charges,
 * folios, and charge queue items.
 *
 * Why a separate types file?
 * PMS is a self-contained feature domain. Keeping its types separate
 * from the core POS types prevents the main types/index.ts from
 * becoming unwieldy and makes it clear which types belong to which feature.
 */

// ---------------------------------------------------------------------------
// Guest Profile
// ---------------------------------------------------------------------------

/** A hotel guest profile retrieved from the PMS. */
export interface PMSGuest {
  /** Unique guest ID from the PMS system */
  id: string;
  /** Guest full name */
  name: string;
  /** Assigned room number */
  roomNumber: string;
  /** Check-in date (ISO 8601) */
  checkInDate: string;
  /** Check-out date (ISO 8601) */
  checkOutDate: string;
  /** Folio number from PMS */
  folioNumber: string;
  /** VIP status level (0 = none) */
  vipLevel: number;
  /** Whether the stay is currently active */
  isActive: boolean;
  /** Whether the guest's folio accepts new charges */
  canCharge: boolean;
  /** Daily charge limit (null = no limit) */
  dailyChargeLimit: number | null;
  /** Per-transaction charge limit (null = no limit) */
  transactionChargeLimit: number | null;
  /** Reservation confirmation number */
  confirmationNumber: string | null;
  /** When this profile was last fetched from PMS (ISO 8601) */
  lastFetchedAt: string;
}

// ---------------------------------------------------------------------------
// Room Charge
// ---------------------------------------------------------------------------

/** Status of a room charge posting */
export type PMSChargeStatus =
  | "pending"
  | "posted"
  | "failed"
  | "reversed"
  | "queued";

/** A charge posted (or pending posting) to a guest's room folio. */
export interface PMSCharge {
  /** Local unique ID */
  id: string;
  /** Guest ID this charge is for */
  guestId: string;
  /** Room number */
  roomNumber: string;
  /** Guest name (denormalized for display) */
  guestName: string;
  /** Charge amount in ZAR */
  amount: number;
  /** Description of the charge */
  description: string;
  /** POS terminal identifier */
  terminalId: string;
  /** Operator/user who created the charge */
  operatorId: string;
  /** Current status */
  status: PMSChargeStatus;
  /** PMS transaction reference (set after successful posting) */
  pmsReference: string | null;
  /** Authorization type used */
  authorizationType: "signature" | "pin" | "bypass" | null;
  /** Related POS order ID */
  orderId: string | null;
  /** Number of posting attempts */
  attempts: number;
  /** Last error message if failed */
  lastError: string | null;
  /** When the charge was created (ISO 8601) */
  createdAt: string;
  /** When the charge was posted to PMS (ISO 8601, null if not posted) */
  postedAt: string | null;
}

// ---------------------------------------------------------------------------
// Folio
// ---------------------------------------------------------------------------

/** A guest's folio (accumulated bill) from the PMS. */
export interface PMSFolio {
  /** Guest ID */
  guestId: string;
  /** Folio number */
  folioNumber: string;
  /** Current balance */
  balance: number;
  /** Credit limit */
  creditLimit: number | null;
  /** Recent charges on the folio */
  recentCharges: PMSFolioCharge[];
  /** When this folio was last fetched (ISO 8601) */
  lastFetchedAt: string;
}

/** A single charge line on a folio. */
export interface PMSFolioCharge {
  /** Charge reference */
  reference: string;
  /** Description */
  description: string;
  /** Amount */
  amount: number;
  /** Date of charge (ISO 8601) */
  date: string;
  /** Whether this charge originated from our POS */
  isFromThisPOS: boolean;
}

// ---------------------------------------------------------------------------
// PMS Connection
// ---------------------------------------------------------------------------

export type PMSProvider = "opera" | "protel" | "mews" | "cloudbeds";

export type PMSConnectionStatus = "connected" | "disconnected" | "error" | "unknown";

/** PMS connection configuration (no secrets — those stay on the server). */
export interface PMSConnection {
  /** Connection ID */
  id: string;
  /** PMS provider type */
  provider: PMSProvider;
  /** Human-readable name */
  name: string;
  /** Property this connection belongs to */
  propertyId: string;
  /** Current connection status */
  status: PMSConnectionStatus;
  /** Last health check timestamp */
  lastHealthCheckAt: string | null;
}

// ---------------------------------------------------------------------------
// Charge Queue Item (for offline queuing)
// ---------------------------------------------------------------------------

/** An item in the offline charge queue, waiting to be posted. */
export interface PMSChargeQueueItem {
  /** Local unique ID */
  id: string;
  /** The charge data to be posted */
  charge: Omit<PMSCharge, "id" | "status" | "pmsReference" | "attempts" | "lastError" | "postedAt">;
  /** Number of posting attempts */
  attempts: number;
  /** Last error if posting failed */
  lastError: string | null;
  /** When the item was queued (ISO 8601) */
  queuedAt: string;
}
