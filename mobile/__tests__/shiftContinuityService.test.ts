/**
 * Tests for ShiftContinuityService — shift handoff and user segment logic.
 * (shift-management task 11.3)
 */

import {
  createHandoff,
  buildUserSegments,
  buildContinuitySummary,
  getCurrentOperator,
  ShiftHandoff,
  HANDOFF_REASON_LABELS,
} from "@/services/shift/ShiftContinuityService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandoff(overrides: Partial<ShiftHandoff> = {}): ShiftHandoff {
  return {
    id: "handoff-1",
    shiftId: "shift-1",
    fromUserId: "user-a",
    toUserId: "user-b",
    timestamp: "2025-01-15T10:00:00Z",
    reason: "break",
    ...overrides,
  };
}

const USER_NAMES: Record<string, string> = {
  "user-a": "Alice",
  "user-b": "Bob",
  "user-c": "Charlie",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("HANDOFF_REASON_LABELS covers all reasons", () => {
    expect(Object.keys(HANDOFF_REASON_LABELS)).toHaveLength(5);
    expect(HANDOFF_REASON_LABELS.break).toBe("Break");
    expect(HANDOFF_REASON_LABELS.manager_override).toBe("Manager Override");
  });
});

// ---------------------------------------------------------------------------
// createHandoff
// ---------------------------------------------------------------------------

describe("createHandoff", () => {
  it("creates a valid handoff", () => {
    const result = createHandoff(
      "shift-1",
      "user-a",
      "user-b",
      "break",
      "2025-01-15T10:00:00Z",
      "Lunch break"
    );
    expect(result.error).toBeNull();
    expect(result.handoff).not.toBeNull();
    expect(result.handoff!.shiftId).toBe("shift-1");
    expect(result.handoff!.fromUserId).toBe("user-a");
    expect(result.handoff!.toUserId).toBe("user-b");
    expect(result.handoff!.reason).toBe("break");
    expect(result.handoff!.note).toBe("Lunch break");
  });

  it("rejects handoff to same user", () => {
    const result = createHandoff(
      "shift-1",
      "user-a",
      "user-a",
      "break",
      "2025-01-15T10:00:00Z"
    );
    expect(result.handoff).toBeNull();
    expect(result.error).toContain("same user");
  });

  it("rejects empty shift ID", () => {
    const result = createHandoff(
      "",
      "user-a",
      "user-b",
      "break",
      "2025-01-15T10:00:00Z"
    );
    expect(result.handoff).toBeNull();
    expect(result.error).toContain("Shift ID");
  });

  it("generates unique IDs", () => {
    const r1 = createHandoff("s1", "a", "b", "break", "2025-01-15T10:00:00Z");
    const r2 = createHandoff("s1", "a", "b", "break", "2025-01-15T10:01:00Z");
    expect(r1.handoff!.id).not.toBe(r2.handoff!.id);
  });
});

// ---------------------------------------------------------------------------
// buildUserSegments
// ---------------------------------------------------------------------------

describe("buildUserSegments", () => {
  it("returns single segment with no handoffs", () => {
    const segments = buildUserSegments(
      "2025-01-15T08:00:00Z",
      "user-a",
      "Alice",
      [],
      USER_NAMES,
      "2025-01-15T16:00:00Z"
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].userId).toBe("user-a");
    expect(segments[0].userName).toBe("Alice");
    expect(segments[0].endedAt).toBeNull();
  });

  it("creates two segments from one handoff", () => {
    const handoffs = [
      makeHandoff({
        fromUserId: "user-a",
        toUserId: "user-b",
        timestamp: "2025-01-15T12:00:00Z",
      }),
    ];
    const segments = buildUserSegments(
      "2025-01-15T08:00:00Z",
      "user-a",
      "Alice",
      handoffs,
      USER_NAMES,
      "2025-01-15T16:00:00Z"
    );
    expect(segments).toHaveLength(2);
    expect(segments[0].userId).toBe("user-a");
    expect(segments[0].endedAt).toBe("2025-01-15T12:00:00Z");
    expect(segments[1].userId).toBe("user-b");
    expect(segments[1].userName).toBe("Bob");
    expect(segments[1].endedAt).toBeNull();
  });

  it("handles multiple handoffs in order", () => {
    const handoffs = [
      makeHandoff({
        id: "h2",
        fromUserId: "user-b",
        toUserId: "user-c",
        timestamp: "2025-01-15T14:00:00Z",
      }),
      makeHandoff({
        id: "h1",
        fromUserId: "user-a",
        toUserId: "user-b",
        timestamp: "2025-01-15T12:00:00Z",
      }),
    ];
    const segments = buildUserSegments(
      "2025-01-15T08:00:00Z",
      "user-a",
      "Alice",
      handoffs,
      USER_NAMES,
      "2025-01-15T16:00:00Z"
    );
    expect(segments).toHaveLength(3);
    expect(segments[0].userId).toBe("user-a");
    expect(segments[1].userId).toBe("user-b");
    expect(segments[2].userId).toBe("user-c");
    expect(segments[2].endedAt).toBeNull(); // current segment
  });
});

// ---------------------------------------------------------------------------
// buildContinuitySummary
// ---------------------------------------------------------------------------

describe("buildContinuitySummary", () => {
  it("calculates duration and handoff count", () => {
    const handoffs = [
      makeHandoff({
        fromUserId: "user-a",
        toUserId: "user-b",
        timestamp: "2025-01-15T12:00:00Z",
      }),
    ];
    const summary = buildContinuitySummary(
      "shift-1",
      "2025-01-15T08:00:00Z",
      "user-a",
      "Alice",
      handoffs,
      USER_NAMES,
      "2025-01-15T16:00:00Z"
    );
    expect(summary.shiftId).toBe("shift-1");
    expect(summary.totalHandoffs).toBe(1);
    expect(summary.segments).toHaveLength(2);
    expect(summary.currentUserId).toBe("user-b");
    expect(summary.shiftDurationMinutes).toBe(480); // 8 hours
  });

  it("handles no handoffs", () => {
    const summary = buildContinuitySummary(
      "shift-1",
      "2025-01-15T08:00:00Z",
      "user-a",
      "Alice",
      [],
      USER_NAMES,
      "2025-01-15T10:00:00Z"
    );
    expect(summary.totalHandoffs).toBe(0);
    expect(summary.segments).toHaveLength(1);
    expect(summary.currentUserId).toBe("user-a");
    expect(summary.shiftDurationMinutes).toBe(120); // 2 hours
  });
});

// ---------------------------------------------------------------------------
// getCurrentOperator
// ---------------------------------------------------------------------------

describe("getCurrentOperator", () => {
  it("returns opening user with no handoffs", () => {
    expect(getCurrentOperator("user-a", [])).toBe("user-a");
  });

  it("returns last handoff target", () => {
    const handoffs = [
      makeHandoff({ toUserId: "user-b", timestamp: "2025-01-15T10:00:00Z" }),
      makeHandoff({
        id: "h2",
        fromUserId: "user-b",
        toUserId: "user-c",
        timestamp: "2025-01-15T14:00:00Z",
      }),
    ];
    expect(getCurrentOperator("user-a", handoffs)).toBe("user-c");
  });

  it("handles out-of-order handoffs", () => {
    const handoffs = [
      makeHandoff({
        id: "h2",
        fromUserId: "user-b",
        toUserId: "user-c",
        timestamp: "2025-01-15T14:00:00Z",
      }),
      makeHandoff({ toUserId: "user-b", timestamp: "2025-01-15T10:00:00Z" }),
    ];
    expect(getCurrentOperator("user-a", handoffs)).toBe("user-c");
  });
});
