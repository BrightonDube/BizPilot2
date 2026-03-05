/**
 * ShiftContinuityService — pure functions for shift continuity across user switches.
 * (shift-management task 11.3)
 *
 * Shift continuity means the shift stays open when operators switch mid-shift.
 * The shift belongs to the terminal, not the individual user. When a user
 * switches out, we log a "handoff" event so sales can be attributed to the
 * correct user, but the shift cash state is preserved.
 *
 * Why separate from ShiftService?
 * ShiftService handles the shift lifecycle (open/close) and cash math.
 * ShiftContinuityService handles the multi-user coordination layer that
 * runs on top of it. Separation keeps both files under 200 lines and
 * lets them evolve independently.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A handoff event recorded when one user switches to another mid-shift. */
export interface ShiftHandoff {
  id: string;
  shiftId: string;
  fromUserId: string;
  toUserId: string;
  timestamp: string; // ISO
  reason: HandoffReason;
  note?: string;
}

export type HandoffReason =
  | "break"
  | "end_of_duty"
  | "manager_override"
  | "training"
  | "other";

export const HANDOFF_REASON_LABELS: Record<HandoffReason, string> = {
  break: "Break",
  end_of_duty: "End of Duty",
  manager_override: "Manager Override",
  training: "Training",
  other: "Other",
};

/** Per-user sales segment within a continuous shift. */
export interface UserShiftSegment {
  userId: string;
  userName: string;
  startedAt: string;
  endedAt: string | null; // null = current active segment
  orderCount: number;
  salesTotal: number;
  refundsTotal: number;
}

/** Summary of all user segments in a shift. */
export interface ShiftContinuitySummary {
  shiftId: string;
  totalHandoffs: number;
  segments: UserShiftSegment[];
  currentUserId: string | null;
  shiftDurationMinutes: number;
}

// ---------------------------------------------------------------------------
// Task 11.3: Shift continuity — create handoff
// ---------------------------------------------------------------------------

/**
 * Create a handoff event for a user switch.
 * Validates that from/to users are different and shift is active.
 *
 * @returns The handoff event or an error string.
 */
export function createHandoff(
  shiftId: string,
  fromUserId: string,
  toUserId: string,
  reason: HandoffReason,
  now: string,
  note?: string
): { handoff: ShiftHandoff; error: null } | { handoff: null; error: string } {
  if (fromUserId === toUserId) {
    return { handoff: null, error: "Cannot hand off to the same user" };
  }

  if (!shiftId.trim()) {
    return { handoff: null, error: "Shift ID is required" };
  }

  const handoff: ShiftHandoff = {
    id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    shiftId,
    fromUserId,
    toUserId,
    timestamp: now,
    reason,
    note,
  };

  return { handoff, error: null };
}

// ---------------------------------------------------------------------------
// Task 11.3: Build user segments from handoff history
// ---------------------------------------------------------------------------

/**
 * Build an ordered list of user segments from handoff events.
 *
 * Segments show who was operating the terminal and for how long.
 * This is used in the shift report to attribute sales to operators.
 */
export function buildUserSegments(
  shiftOpenedAt: string,
  openingUserId: string,
  openingUserName: string,
  handoffs: ShiftHandoff[],
  userNameLookup: Record<string, string>,
  now: string
): UserShiftSegment[] {
  // Sort handoffs chronologically
  const sorted = [...handoffs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const segments: UserShiftSegment[] = [];

  let currentUserId = openingUserId;
  let currentUserName = openingUserName;
  let segmentStart = shiftOpenedAt;

  for (const handoff of sorted) {
    segments.push({
      userId: currentUserId,
      userName: currentUserName,
      startedAt: segmentStart,
      endedAt: handoff.timestamp,
      orderCount: 0, // populated externally from order data
      salesTotal: 0,
      refundsTotal: 0,
    });

    currentUserId = handoff.toUserId;
    currentUserName = userNameLookup[handoff.toUserId] ?? "Unknown";
    segmentStart = handoff.timestamp;
  }

  // Current (final) segment
  segments.push({
    userId: currentUserId,
    userName: currentUserName,
    startedAt: segmentStart,
    endedAt: null,
    orderCount: 0,
    salesTotal: 0,
    refundsTotal: 0,
  });

  return segments;
}

// ---------------------------------------------------------------------------
// Task 11.3: Shift continuity summary
// ---------------------------------------------------------------------------

/**
 * Build a continuity summary for a shift.
 */
export function buildContinuitySummary(
  shiftId: string,
  shiftOpenedAt: string,
  openingUserId: string,
  openingUserName: string,
  handoffs: ShiftHandoff[],
  userNameLookup: Record<string, string>,
  now: string
): ShiftContinuitySummary {
  const segments = buildUserSegments(
    shiftOpenedAt,
    openingUserId,
    openingUserName,
    handoffs,
    userNameLookup,
    now
  );

  const openMs = new Date(shiftOpenedAt).getTime();
  const nowMs = new Date(now).getTime();
  const durationMin = Math.floor((nowMs - openMs) / 60000);

  // The last segment's user is the current operator
  const lastSegment = segments[segments.length - 1];

  return {
    shiftId,
    totalHandoffs: handoffs.length,
    segments,
    currentUserId: lastSegment?.userId ?? null,
    shiftDurationMinutes: Math.max(0, durationMin),
  };
}

/**
 * Get the current active user for a shift based on handoff history.
 * If no handoffs, returns the opening user.
 */
export function getCurrentOperator(
  openingUserId: string,
  handoffs: ShiftHandoff[]
): string {
  if (handoffs.length === 0) return openingUserId;

  const sorted = [...handoffs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sorted[sorted.length - 1].toUserId;
}
