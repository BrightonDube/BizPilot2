/**
 * Unit tests for PMS Zustand store actions and selectors.
 *
 * Tests verify:
 * - Connection status management
 * - Guest selection lifecycle
 * - Charge queue operations (enqueue, dequeue, update)
 * - Duplicate charge prevention
 * - Store reset
 * - Computed getters (getQueueCount, canPostCharges)
 */

import { act } from "@testing-library/react-native";

// Mock AsyncStorage before importing store
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { usePMSStore } from "@/stores/pmsStore";
import type { PMSChargeQueueItem } from "@/types/pms";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueueItem(overrides?: Partial<PMSChargeQueueItem>): PMSChargeQueueItem {
  return {
    id: `q-${Math.random().toString(36).slice(2, 8)}`,
    charge: {
      guestId: "g-1",
      roomNumber: "101",
      guestName: "Test Guest",
      amount: 250,
      description: "POS Order #1234",
      terminalId: "T-01",
      operatorId: "op-1",
      authorizationType: null,
      orderId: "order-1",
      createdAt: new Date().toISOString(),
    },
    attempts: 0,
    lastError: null,
    queuedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Reset store between tests
beforeEach(() => {
  act(() => {
    usePMSStore.getState().reset();
  });
});

// ---------------------------------------------------------------------------
// Connection Status
// ---------------------------------------------------------------------------

describe("PMS Store — connection status", () => {
  it("starts with unknown connection status", () => {
    expect(usePMSStore.getState().connectionStatus).toBe("unknown");
  });

  it("updates connection status", () => {
    act(() => {
      usePMSStore.getState().setConnectionStatus("connected");
    });
    expect(usePMSStore.getState().connectionStatus).toBe("connected");
  });

  it("cycles through all status values", () => {
    const statuses = ["connected", "disconnected", "error", "unknown"] as const;
    for (const status of statuses) {
      act(() => {
        usePMSStore.getState().setConnectionStatus(status);
      });
      expect(usePMSStore.getState().connectionStatus).toBe(status);
    }
  });
});

// ---------------------------------------------------------------------------
// Guest Management
// ---------------------------------------------------------------------------

describe("PMS Store — guest management", () => {
  const mockGuest = {
    id: "g-1",
    name: "John Smith",
    roomNumber: "101",
    checkInDate: "2025-03-01",
    checkOutDate: "2025-03-05",
    folioNumber: "F-1001",
    vipLevel: 0,
    isActive: true,
    canCharge: true,
    dailyChargeLimit: 5000,
    transactionChargeLimit: 2000,
    confirmationNumber: "CONF-123",
    lastFetchedAt: new Date().toISOString(),
  };

  it("starts with no current guest", () => {
    expect(usePMSStore.getState().currentGuest).toBeNull();
  });

  it("sets and clears current guest", () => {
    act(() => {
      usePMSStore.getState().setCurrentGuest(mockGuest);
    });
    expect(usePMSStore.getState().currentGuest).toBe(mockGuest);

    act(() => {
      usePMSStore.getState().setCurrentGuest(null);
    });
    expect(usePMSStore.getState().currentGuest).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Charge Queue
// ---------------------------------------------------------------------------

describe("PMS Store — charge queue", () => {
  it("starts with empty queue", () => {
    expect(usePMSStore.getState().chargeQueue.length).toBe(0);
    expect(usePMSStore.getState().getQueueCount()).toBe(0);
  });

  it("enqueues a charge", () => {
    const item = makeQueueItem();
    act(() => {
      usePMSStore.getState().enqueueCharge(item);
    });
    expect(usePMSStore.getState().chargeQueue.length).toBe(1);
    expect(usePMSStore.getState().getQueueCount()).toBe(1);
  });

  it("prevents duplicate charges for the same order", () => {
    const item1 = makeQueueItem({ id: "q-1", charge: { ...makeQueueItem().charge, orderId: "order-dup" } });
    const item2 = makeQueueItem({ id: "q-2", charge: { ...makeQueueItem().charge, orderId: "order-dup" } });

    act(() => {
      usePMSStore.getState().enqueueCharge(item1);
      usePMSStore.getState().enqueueCharge(item2);
    });

    expect(usePMSStore.getState().chargeQueue.length).toBe(1);
  });

  it("allows charges with different orders", () => {
    const item1 = makeQueueItem({ id: "q-1", charge: { ...makeQueueItem().charge, orderId: "order-a" } });
    const item2 = makeQueueItem({ id: "q-2", charge: { ...makeQueueItem().charge, orderId: "order-b" } });

    act(() => {
      usePMSStore.getState().enqueueCharge(item1);
      usePMSStore.getState().enqueueCharge(item2);
    });

    expect(usePMSStore.getState().chargeQueue.length).toBe(2);
  });

  it("dequeues a charge by ID", () => {
    const item = makeQueueItem({ id: "q-remove" });
    act(() => {
      usePMSStore.getState().enqueueCharge(item);
    });
    expect(usePMSStore.getState().chargeQueue.length).toBe(1);

    act(() => {
      usePMSStore.getState().dequeueCharge("q-remove");
    });
    expect(usePMSStore.getState().chargeQueue.length).toBe(0);
  });

  it("updates a queue item by ID", () => {
    const item = makeQueueItem({ id: "q-update", attempts: 0 });
    act(() => {
      usePMSStore.getState().enqueueCharge(item);
      usePMSStore.getState().updateQueueItem("q-update", {
        attempts: 3,
        lastError: "Network timeout",
      });
    });

    const updated = usePMSStore.getState().chargeQueue[0];
    expect(updated.attempts).toBe(3);
    expect(updated.lastError).toBe("Network timeout");
  });
});

// ---------------------------------------------------------------------------
// Computed Getters
// ---------------------------------------------------------------------------

describe("PMS Store — computed getters", () => {
  it("canPostCharges returns true when connected and enabled", () => {
    act(() => {
      usePMSStore.getState().setEnabled(true);
      usePMSStore.getState().setConnectionStatus("connected");
    });
    expect(usePMSStore.getState().canPostCharges()).toBe(true);
  });

  it("canPostCharges returns false when disconnected", () => {
    act(() => {
      usePMSStore.getState().setEnabled(true);
      usePMSStore.getState().setConnectionStatus("disconnected");
    });
    expect(usePMSStore.getState().canPostCharges()).toBe(false);
  });

  it("canPostCharges returns false when not enabled", () => {
    act(() => {
      usePMSStore.getState().setEnabled(false);
      usePMSStore.getState().setConnectionStatus("connected");
    });
    expect(usePMSStore.getState().canPostCharges()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe("PMS Store — reset", () => {
  it("clears all state on reset", () => {
    act(() => {
      usePMSStore.getState().setConnectionStatus("connected");
      usePMSStore.getState().setEnabled(true);
      usePMSStore.getState().enqueueCharge(makeQueueItem());
      usePMSStore.getState().setLastError("some error");
    });

    act(() => {
      usePMSStore.getState().reset();
    });

    const state = usePMSStore.getState();
    expect(state.connectionStatus).toBe("unknown");
    expect(state.chargeQueue.length).toBe(0);
    expect(state.isEnabled).toBe(false);
    expect(state.lastError).toBeNull();
    expect(state.currentGuest).toBeNull();
    expect(state.currentFolio).toBeNull();
  });
});
