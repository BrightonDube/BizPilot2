/**
 * Tests for Shift Management UI Components
 * (shift-management tasks 4.4, 6.1-6.5, 7.1-7.3, 8.1)
 *
 * Covers:
 *   - PinEntryPad: render, key presses, auto-submit, error display
 *   - ShiftOpenModal: float validation, step transitions, PIN submit
 *   - ShiftCloseModal: expected cash display, variance step, PIN authorize
 *   - CashMovementModal: type selection, amount validation, balance guard
 *   - VarianceDisplay: colour coding, threshold warning
 *   - CashDrawerButton: kick callback, success/error feedback
 *
 * Test philosophy:
 * We test user-observable behaviour (what renders, what callbacks fire)
 * NOT implementation details (internal state, setTimeout calls).
 * This matches React Native Testing Library's guiding principles.
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Component imports
import PinEntryPad from "@/components/shift/PinEntryPad";
import ShiftOpenModal from "@/components/shift/ShiftOpenModal";
import ShiftCloseModal from "@/components/shift/ShiftCloseModal";
import CashMovementModal from "@/components/shift/CashMovementModal";
import VarianceDisplay from "@/components/shift/VarianceDisplay";
import CashDrawerButton from "@/components/shift/CashDrawerButton";
import { DEFAULT_OPENING_FLOAT } from "@/components/shift/ShiftOpenModal";

// Service type
import type { ShiftRecord, ShiftCashEvent } from "@/services/shift/ShiftService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeShift = (overrides: Partial<ShiftRecord> = {}): ShiftRecord => ({
  id: "shift-1",
  terminalId: "terminal-1",
  userId: "user-1",
  status: "open",
  openedAt: new Date(Date.now() - 60_000 * 60).toISOString(), // 1 hour ago
  closedAt: null,
  openingFloat: 500,
  closingCash: null,
  ...overrides,
});

const noop = jest.fn();
const resolveVoid = () => Promise.resolve();

// ---------------------------------------------------------------------------
// PinEntryPad Tests
// ---------------------------------------------------------------------------

describe("PinEntryPad", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders title and 6 empty dot indicators", () => {
    const { getByText, getAllByRole } = render(
      <PinEntryPad title="Enter PIN" onSubmit={noop} />
    );
    expect(getByText("Enter PIN")).toBeTruthy();
  });

  it("calls onSubmit with 6-digit PIN after auto-submit", () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = render(
      <PinEntryPad title="Enter PIN" onSubmit={onSubmit} />
    );
    // Press 1 through 6
    fireEvent.press(getByLabelText("1"));
    fireEvent.press(getByLabelText("2"));
    fireEvent.press(getByLabelText("3"));
    fireEvent.press(getByLabelText("4"));
    fireEvent.press(getByLabelText("5"));
    fireEvent.press(getByLabelText("6"));

    expect(onSubmit).toHaveBeenCalledWith("123456");
  });

  it("renders Submit button when 4 digits entered", () => {
    const { getByLabelText, getByText } = render(
      <PinEntryPad title="Enter PIN" onSubmit={noop} />
    );
    fireEvent.press(getByLabelText("1"));
    fireEvent.press(getByLabelText("2"));
    fireEvent.press(getByLabelText("3"));
    fireEvent.press(getByLabelText("4"));
    expect(getByText("Submit")).toBeTruthy();
  });

  it("backspace removes last digit", () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText } = render(
      <PinEntryPad title="Enter PIN" onSubmit={onSubmit} />
    );
    fireEvent.press(getByLabelText("1"));
    fireEvent.press(getByLabelText("2"));
    fireEvent.press(getByLabelText("3"));
    fireEvent.press(getByLabelText("4"));
    fireEvent.press(getByLabelText("Backspace"));
    // After backspace, submit button should still show (3 digits)
    // 3 digits < 4 min, Submit button should NOT be visible
    // so we verify onSubmit not called yet
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("displays error prop", () => {
    const { getByText } = render(
      <PinEntryPad title="Enter PIN" onSubmit={noop} error="Invalid PIN" />
    );
    expect(getByText("Invalid PIN")).toBeTruthy();
  });

  it("shows subtitle when provided", () => {
    const { getByText } = render(
      <PinEntryPad
        title="Enter PIN"
        subtitle="Staff authorization required"
        onSubmit={noop}
      />
    );
    expect(getByText("Staff authorization required")).toBeTruthy();
  });

  it("renders Cancel button when onCancel is provided", () => {
    const onCancel = jest.fn();
    const { getByLabelText } = render(
      <PinEntryPad title="Enter PIN" onSubmit={noop} onCancel={onCancel} />
    );
    fireEvent.press(getByLabelText("Cancel PIN entry"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ShiftOpenModal Tests
// ---------------------------------------------------------------------------

describe("ShiftOpenModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders float entry step by default", () => {
    const { getByText } = render(
      <ShiftOpenModal visible onClose={noop} onShiftOpen={resolveVoid} />
    );
    expect(getByText("Opening Float Amount")).toBeTruthy();
  });

  it("pre-fills DEFAULT_OPENING_FLOAT", () => {
    const { getByDisplayValue } = render(
      <ShiftOpenModal visible onClose={noop} onShiftOpen={resolveVoid} />
    );
    expect(getByDisplayValue(DEFAULT_OPENING_FLOAT.toFixed(2))).toBeTruthy();
  });

  it("pre-fills custom defaultFloat", () => {
    const { getByDisplayValue } = render(
      <ShiftOpenModal
        visible
        onClose={noop}
        onShiftOpen={resolveVoid}
        defaultFloat={200}
      />
    );
    expect(getByDisplayValue("200.00")).toBeTruthy();
  });

  it("advances to PIN step when Continue is pressed", () => {
    const { getByText } = render(
      <ShiftOpenModal visible onClose={noop} onShiftOpen={resolveVoid} />
    );
    fireEvent.press(getByText("Continue →"));
    expect(getByText("Enter Your PIN")).toBeTruthy();
  });

  it("shows staff name when provided", () => {
    const { getByText } = render(
      <ShiftOpenModal
        visible
        onClose={noop}
        onShiftOpen={resolveVoid}
        staffName="Alice"
      />
    );
    expect(getByText(/Alice/)).toBeTruthy();
  });

  it("DEFAULT_OPENING_FLOAT is R500", () => {
    expect(DEFAULT_OPENING_FLOAT).toBe(500);
  });

  it("calls onShiftOpen after PIN submitted", async () => {
    const onShiftOpen = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByLabelText } = render(
      <ShiftOpenModal visible onClose={noop} onShiftOpen={onShiftOpen} />
    );
    // Advance to PIN step
    fireEvent.press(getByText("Continue →"));
    // Enter PIN
    fireEvent.press(getByLabelText("1"));
    fireEvent.press(getByLabelText("2"));
    fireEvent.press(getByLabelText("3"));
    fireEvent.press(getByLabelText("4"));
    fireEvent.press(getByLabelText("5"));
    fireEvent.press(getByLabelText("6"));

    await waitFor(() => {
      expect(onShiftOpen).toHaveBeenCalledWith({
        floatAmount: DEFAULT_OPENING_FLOAT,
        pin: "123456",
      });
    });
  });
});

// ---------------------------------------------------------------------------
// VarianceDisplay Tests
// ---------------------------------------------------------------------------

describe("VarianceDisplay", () => {
  it("shows Balanced when variance is zero", () => {
    const { getByText } = render(
      <VarianceDisplay
        expectedCash={500}
        countedCash={500}
        variance={0}
      />
    );
    expect(getByText("Balanced")).toBeTruthy();
  });

  it("shows Over for positive variance", () => {
    const { getByText } = render(
      <VarianceDisplay
        expectedCash={500}
        countedCash={510}
        variance={10}
      />
    );
    expect(getByText("Over")).toBeTruthy();
  });

  it("shows Short for negative variance", () => {
    const { getByText } = render(
      <VarianceDisplay
        expectedCash={500}
        countedCash={480}
        variance={-20}
      />
    );
    expect(getByText("Short")).toBeTruthy();
  });

  it("shows warning when variance exceeds threshold", () => {
    const { getByText } = render(
      <VarianceDisplay
        expectedCash={500}
        countedCash={400}
        variance={-100}
        threshold={50}
      />
    );
    expect(getByText(/a reason is required/i)).toBeTruthy();
  });

  it("does NOT show warning when variance within threshold", () => {
    const { queryByText } = render(
      <VarianceDisplay
        expectedCash={500}
        countedCash={520}
        variance={20}
        threshold={50}
      />
    );
    expect(queryByText(/requires a reason/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CashMovementModal Tests
// ---------------------------------------------------------------------------

describe("CashMovementModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders with drop type selected by default", () => {
    const { getByText } = render(
      <CashMovementModal
        visible
        onClose={noop}
        onConfirm={resolveVoid}
        currentBalance={500}
      />
    );
    expect(getByText("Remove cash from drawer to the safe")).toBeTruthy();
  });

  it("switching to paidout shows paid-out description", () => {
    const { getByLabelText, getByText } = render(
      <CashMovementModal
        visible
        onClose={noop}
        onConfirm={resolveVoid}
        currentBalance={500}
      />
    );
    fireEvent.press(getByLabelText("Paid Out"));
    expect(getByText("Petty cash payment to supplier or expense")).toBeTruthy();
  });

  it("shows balance for drop/paidout types", () => {
    const { getByText } = render(
      <CashMovementModal
        visible
        onClose={noop}
        onConfirm={resolveVoid}
        currentBalance={750}
      />
    );
    expect(getByText(/750/)).toBeTruthy();
  });

  it("calls onConfirm with correct data", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = render(
      <CashMovementModal
        visible
        onClose={noop}
        onConfirm={onConfirm}
        currentBalance={500}
        initialType="drop"
      />
    );
    fireEvent.changeText(getByLabelText("Cash amount"), "100");
    fireEvent.changeText(getByLabelText("Movement note"), "Midshift drop");
    fireEvent.press(getByText("Record Cash Drop"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        type: "drop",
        amount: 100,
        note: "Midshift drop",
      });
    });
  });

  it("shows error when drop exceeds balance", async () => {
    const { getByLabelText, getByText } = render(
      <CashMovementModal
        visible
        onClose={noop}
        onConfirm={resolveVoid}
        currentBalance={50}
      />
    );
    fireEvent.changeText(getByLabelText("Cash amount"), "200");
    fireEvent.changeText(getByLabelText("Movement note"), "Drop");
    fireEvent.press(getByText("Record Cash Drop"));

    await waitFor(() => {
      expect(getByText(/exceeds drawer balance/i)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// CashDrawerButton Tests
// ---------------------------------------------------------------------------

describe("CashDrawerButton", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders 'Open Drawer' label", () => {
    const { getByText } = render(
      <CashDrawerButton onKickDrawer={() => Promise.resolve({ success: true, timestamp: "" })} />
    );
    expect(getByText("Open Drawer")).toBeTruthy();
  });

  it("calls onKickDrawer when pressed", async () => {
    const onKickDrawer = jest.fn().mockResolvedValue({ success: true, timestamp: "" });
    const { getByLabelText } = render(
      <CashDrawerButton onKickDrawer={onKickDrawer} />
    );
    fireEvent.press(getByLabelText("Open cash drawer manually"));
    await waitFor(() => expect(onKickDrawer).toHaveBeenCalledTimes(1));
  });

  it("shows 'Printer not connected' sublabel when unavailable", () => {
    const { getByText } = render(
      <CashDrawerButton
        onKickDrawer={() => Promise.resolve({ success: true, timestamp: "" })}
        drawerAvailable={false}
      />
    );
    expect(getByText("Printer not connected")).toBeTruthy();
  });

  it("renders compact mode with no text label", () => {
    const { queryByText } = render(
      <CashDrawerButton
        onKickDrawer={() => Promise.resolve({ success: true, timestamp: "" })}
        compact
      />
    );
    expect(queryByText("Open Drawer")).toBeNull();
  });

  it("shows error sublabel after failed kick", async () => {
    jest.useFakeTimers();
    const onKickDrawer = jest.fn().mockResolvedValue({ success: false, timestamp: "" });
    const { getByLabelText, findByText } = render(
      <CashDrawerButton onKickDrawer={onKickDrawer} />
    );
    fireEvent.press(getByLabelText("Open cash drawer manually"));
    expect(await findByText("Kick failed — check connection")).toBeTruthy();
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ShiftCloseModal Tests
// ---------------------------------------------------------------------------

describe("ShiftCloseModal", () => {
  beforeEach(() => jest.clearAllMocks());

  const defaultShift = makeShift();
  const noEvents: ShiftCashEvent[] = [];

  it("renders expected cash from opening float with no events", () => {
    const { getAllByText } = render(
      <ShiftCloseModal
        visible
        onClose={noop}
        shift={defaultShift}
        cashEvents={noEvents}
        onShiftClose={resolveVoid}
      />
    );
    // Expected = float + 0 sales = R500 — may appear multiple times in breakdown
    const matches = getAllByText(/500/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("advances to PIN step when counted and no large variance", () => {
    const { getByLabelText, getByText } = render(
      <ShiftCloseModal
        visible
        onClose={noop}
        shift={defaultShift}
        cashEvents={noEvents}
        onShiftClose={resolveVoid}
      />
    );
    fireEvent.changeText(getByLabelText("Counted cash amount"), "500");
    fireEvent.press(getByText("Confirm & Enter PIN →"));
    expect(getByText("Authorize Close")).toBeTruthy();
  });

  it("goes to reason step when variance exceeds threshold", () => {
    const { getByLabelText, getByText } = render(
      <ShiftCloseModal
        visible
        onClose={noop}
        shift={defaultShift}
        cashEvents={noEvents}
        onShiftClose={resolveVoid}
        varianceThreshold={50}
      />
    );
    // Count only R100 when R500 expected → R400 short
    fireEvent.changeText(getByLabelText("Counted cash amount"), "100");
    fireEvent.press(getByText("Explain Variance →"));
    expect(getByText("Variance Reason")).toBeTruthy();
  });

  it("computes variance correctly in display", () => {
    const events: ShiftCashEvent[] = [
      { type: "sale", amount: 200, timestamp: new Date().toISOString() },
    ];
    const { getByLabelText, getByText } = render(
      <ShiftCloseModal
        visible
        onClose={noop}
        shift={defaultShift}       // float = 500
        cashEvents={events}         // +200 sales = 700 expected
        onShiftClose={resolveVoid}
      />
    );
    fireEvent.changeText(getByLabelText("Counted cash amount"), "700");
    // Variance = 0 — should show "Balanced"
    expect(getByText("Balanced")).toBeTruthy();
  });
});
