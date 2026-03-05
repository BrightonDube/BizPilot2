/**
 * BizPilot Mobile POS — PMS (Property Management System) Service
 *
 * Pure TypeScript service for hotel/hospitality room-charge integration.
 * Handles guest lookup, room-charge validation, folio calculations,
 * offline queueing, and PMS connection status helpers.
 *
 * Why pure functions instead of a class?
 * Same rationale as every other BizPilot service — pure functions are
 * trivially testable, tree-shakable, and never hide mutable state.
 * WatermelonDB owns persistence; this module owns business logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PMSConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "syncing";

export type ChargeStatus =
  | "pending"
  | "posted"
  | "failed"
  | "reversed"
  | "queued_offline";

export type RoomStatus = "occupied" | "vacant" | "checkout" | "maintenance";

export interface GuestProfile {
  id: string;
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  folioNumber: string;
  vipStatus: boolean;
  creditLimit: number;
  currentBalance: number;
  allowCharges: boolean;
}

export interface RoomChargeRequest {
  orderId: string;
  roomNumber: string;
  guestId: string;
  amount: number;
  description: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  authorizationType: "none" | "signature" | "pin";
}

export interface RoomChargeResult {
  success: boolean;
  chargeId: string | null;
  status: ChargeStatus;
  error: string | null;
  postedAt: string | null;
}

export interface FolioEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "charge" | "payment" | "adjustment";
  source: string;
}

export interface PMSConnectionInfo {
  pmsType: string;
  status: PMSConnectionStatus;
  lastSyncAt: string | null;
  offlineQueueCount: number;
  healthCheckResult: string | null;
}

export interface RoomValidation {
  isValid: boolean;
  isOccupied: boolean;
  roomStatus: RoomStatus;
  guest: GuestProfile | null;
  canCharge: boolean;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// 1. validateRoomCharge
// ---------------------------------------------------------------------------

/**
 * Validates a room-charge request against the guest's profile.
 *
 * Checks:
 * - Guest allows room charges
 * - Charge amount is positive
 * - Charge amount fits within available credit
 * - Room number on the request matches the guest's room
 * - At least one line-item is present
 */
export function validateRoomCharge(
  request: RoomChargeRequest,
  guest: GuestProfile
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!guest.allowCharges) {
    errors.push("Room charges are not permitted for this guest");
  }

  if (request.amount <= 0) {
    errors.push("Charge amount must be greater than zero");
  }

  const available = guest.creditLimit - guest.currentBalance;
  if (request.amount > available) {
    errors.push(
      `Charge amount (${request.amount.toFixed(2)}) exceeds available credit (${available.toFixed(2)})`
    );
  }

  if (request.roomNumber !== guest.roomNumber) {
    errors.push(
      `Room number mismatch: request is for ${request.roomNumber} but guest is in ${guest.roomNumber}`
    );
  }

  if (!request.items || request.items.length === 0) {
    errors.push("At least one line-item is required");
  }

  return { isValid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 2. requiresAuthorization
// ---------------------------------------------------------------------------

/**
 * Determines the authorization level required based on the charge amount.
 *
 * - Below threshold → no auth
 * - At or above threshold but below 2× → signature
 * - At or above 2× threshold → PIN
 */
export function requiresAuthorization(
  amount: number,
  threshold: number
): "none" | "signature" | "pin" {
  if (amount < threshold) return "none";
  if (amount < threshold * 2) return "signature";
  return "pin";
}

// ---------------------------------------------------------------------------
// 3. validateRoomNumber
// ---------------------------------------------------------------------------

/**
 * Light-weight room-number format check.
 * Accepts 1-10 alphanumeric characters (e.g. "101", "A12", "PH01").
 */
export function validateRoomNumber(roomNumber: string): boolean {
  if (!roomNumber || roomNumber.trim().length === 0) return false;
  return /^[A-Za-z0-9]{1,10}$/.test(roomNumber.trim());
}

// ---------------------------------------------------------------------------
// 4. searchGuests
// ---------------------------------------------------------------------------

/**
 * Searches the guest list by room number or guest name (case-insensitive).
 */
export function searchGuests(
  guests: GuestProfile[],
  query: string
): GuestProfile[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return guests;

  return guests.filter(
    (g) =>
      g.roomNumber.toLowerCase().includes(q) ||
      g.guestName.toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// 5. filterActiveGuests
// ---------------------------------------------------------------------------

/**
 * Returns only guests whose stay spans the current date
 * (checked in on or before `now`, checking out on or after `now`).
 */
export function filterActiveGuests(
  guests: GuestProfile[],
  now: Date
): GuestProfile[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return guests.filter((g) => {
    const checkIn = new Date(g.checkInDate);
    const checkOut = new Date(g.checkOutDate);
    const checkInDay = new Date(
      checkIn.getFullYear(),
      checkIn.getMonth(),
      checkIn.getDate()
    );
    const checkOutDay = new Date(
      checkOut.getFullYear(),
      checkOut.getMonth(),
      checkOut.getDate()
    );
    return checkInDay <= today && checkOutDay >= today;
  });
}

// ---------------------------------------------------------------------------
// 6. calculateGuestAvailableCredit
// ---------------------------------------------------------------------------

/** Returns the remaining credit a guest may use for room charges. */
export function calculateGuestAvailableCredit(guest: GuestProfile): number {
  return Math.max(0, guest.creditLimit - guest.currentBalance);
}

// ---------------------------------------------------------------------------
// 7. formatChargeDescription
// ---------------------------------------------------------------------------

/**
 * Builds a human-readable itemised summary string.
 * Example: "2× Cappuccino, 1× Club Sandwich"
 */
export function formatChargeDescription(
  items: Array<{ name: string; quantity: number; price: number }>
): string {
  if (!items || items.length === 0) return "No items";

  return items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

// ---------------------------------------------------------------------------
// 8. buildOfflineCharge
// ---------------------------------------------------------------------------

/**
 * Creates a charge result pre-populated for the offline queue.
 * The charge will be posted to the PMS once the connection is restored.
 */
export function buildOfflineCharge(
  request: RoomChargeRequest,
  now: Date
): RoomChargeResult & { queuedAt: string } {
  return {
    success: false,
    chargeId: `offline-${request.orderId}-${now.getTime()}`,
    status: "queued_offline",
    error: null,
    postedAt: null,
    queuedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 9. sortFolioEntries
// ---------------------------------------------------------------------------

/** Sorts folio entries chronologically (ascending) or reverse-chronologically. */
export function sortFolioEntries(
  entries: FolioEntry[],
  direction: "asc" | "desc"
): FolioEntry[] {
  return [...entries].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

// ---------------------------------------------------------------------------
// 10. calculateFolioTotals
// ---------------------------------------------------------------------------

/** Aggregates folio entries into total charges, payments, and net balance. */
export function calculateFolioTotals(entries: FolioEntry[]): {
  totalCharges: number;
  totalPayments: number;
  balance: number;
} {
  let totalCharges = 0;
  let totalPayments = 0;

  for (const entry of entries) {
    if (entry.type === "charge") {
      totalCharges += entry.amount;
    } else if (entry.type === "payment") {
      totalPayments += entry.amount;
    }
    // adjustments can be positive or negative — treat as charges
    if (entry.type === "adjustment") {
      totalCharges += entry.amount;
    }
  }

  return {
    totalCharges: Math.round(totalCharges * 100) / 100,
    totalPayments: Math.round(totalPayments * 100) / 100,
    balance: Math.round((totalCharges - totalPayments) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// 11. isGuestCheckingOutToday
// ---------------------------------------------------------------------------

/** Returns true when the guest's check-out date is today. */
export function isGuestCheckingOutToday(
  guest: GuestProfile,
  now: Date
): boolean {
  const checkout = new Date(guest.checkOutDate);
  return (
    checkout.getFullYear() === now.getFullYear() &&
    checkout.getMonth() === now.getMonth() &&
    checkout.getDate() === now.getDate()
  );
}

// ---------------------------------------------------------------------------
// 12. getConnectionStatusColor
// ---------------------------------------------------------------------------

/** Maps PMS connection status to a UI colour hex value. */
export function getConnectionStatusColor(status: PMSConnectionStatus): string {
  switch (status) {
    case "connected":
      return "#22c55e"; // green
    case "disconnected":
      return "#ef4444"; // red
    case "error":
      return "#f59e0b"; // amber
    case "syncing":
      return "#3b82f6"; // blue
  }
}
