/**
 * Tests for EODSummaryView and ShiftReportsView components.
 * (shift-management tasks 9.1, 9.4, 10.1-10.3)
 *
 * These tests verify rendering and user interactions at the component level.
 * Business logic is tested separately in shiftReportService.test.ts.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import EODSummaryView from "@/components/shift/EODSummaryView";
import ShiftReportsView from "@/components/shift/ShiftReportsView";
import type { ClosedShiftRecord } from "@/services/shift/ShiftReportService";

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

const makeShift = (overrides: Partial<ClosedShiftRecord> = {}): ClosedShiftRecord => ({
  id: `shift-${Math.random().toString(36).substring(7)}`,
  terminalId: "terminal-1",
  userId: "user-1",
  status: "closed",
  openedAt: "2025-06-15T08:00:00.000Z",
  closedAt: "2025-06-15T16:00:00.000Z",
  openingFloat: 500,
  closingCash: 750,
  cashEvents: [
    { type: "sale", amount: 300, timestamp: "2025-06-15T10:00:00.000Z" },
    { type: "refund", amount: 50, timestamp: "2025-06-15T14:00:00.000Z" },
  ],
  ...overrides,
});

const noop = jest.fn();

// ---------------------------------------------------------------------------
// EODSummaryView Tests
// ---------------------------------------------------------------------------

describe("EODSummaryView", () => {
  it("renders header with date and terminal", () => {
    const { getByText } = render(
      <EODSummaryView
        shifts={[]}
        date="2025-06-15"
        terminalId="terminal-1"
      />
    );
    expect(getByText("End of Day Summary")).toBeTruthy();
    expect(getByText(/2025-06-15/)).toBeTruthy();
    expect(getByText(/terminal-1/)).toBeTruthy();
  });

  it("shows empty state when no shifts match", () => {
    const { getByText } = render(
      <EODSummaryView
        shifts={[]}
        date="2025-06-15"
        terminalId="terminal-1"
      />
    );
    expect(getByText("No closed shifts for this date")).toBeTruthy();
  });

  it("renders shift cards when shifts exist", () => {
    const shifts = [makeShift()];
    const { getByText } = render(
      <EODSummaryView
        shifts={shifts}
        date="2025-06-15"
        terminalId="terminal-1"
      />
    );
    expect(getByText("Shift Breakdown")).toBeTruthy();
  });

  it("shows export button when onExportCsv is provided", () => {
    const { getByLabelText } = render(
      <EODSummaryView
        shifts={[]}
        date="2025-06-15"
        terminalId="terminal-1"
        onExportCsv={noop}
      />
    );
    expect(getByLabelText("Export EOD report as CSV")).toBeTruthy();
  });

  it("calls onExportCsv with csv string when export pressed", () => {
    const onExport = jest.fn();
    const { getByLabelText } = render(
      <EODSummaryView
        shifts={[makeShift()]}
        date="2025-06-15"
        terminalId="terminal-1"
        onExportCsv={onExport}
      />
    );
    fireEvent.press(getByLabelText("Export EOD report as CSV"));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(typeof onExport.mock.calls[0][0]).toBe("string"); // csv string
    expect(onExport.mock.calls[0][1]).toContain("eod-"); // filename
  });

  it("shows carry-over balance", () => {
    const shifts = [makeShift({ closingCash: 900 })];
    const { getByText } = render(
      <EODSummaryView
        shifts={shifts}
        date="2025-06-15"
        terminalId="terminal-1"
      />
    );
    expect(getByText(/Carry-over/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ShiftReportsView Tests
// ---------------------------------------------------------------------------

describe("ShiftReportsView", () => {
  const shifts = [
    makeShift({ userId: "alice", closingCash: 760 }),
    makeShift({ userId: "bob", closingCash: 700 }),
  ];

  it("renders Summary tab by default", () => {
    const { getByText } = render(<ShiftReportsView shifts={shifts} />);
    expect(getByText("Summary")).toBeTruthy();
  });

  it("switches to Operators tab", () => {
    const { getByLabelText, getByText } = render(
      <ShiftReportsView shifts={shifts} />
    );
    fireEvent.press(getByLabelText("Operators tab"));
    // Should show operator IDs
    expect(getByText(/alice/)).toBeTruthy();
    expect(getByText(/bob/)).toBeTruthy();
  });

  it("switches to Variances tab", () => {
    const { getByLabelText, getAllByText } = render(
      <ShiftReportsView shifts={shifts} varianceThreshold={5} />
    );
    fireEvent.press(getByLabelText("Variances tab"));
    // Both shifts have variance > 5 so both show "Flagged"
    const flaggedBadges = getAllByText("Flagged");
    expect(flaggedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows badge count on variances tab for flagged shifts", () => {
    // Both shifts have variance > 5
    const { getByText } = render(
      <ShiftReportsView shifts={shifts} varianceThreshold={5} />
    );
    // There should be a badge showing the count
    expect(getByText("2")).toBeTruthy();
  });

  it("calls onExport when export button pressed", () => {
    const onExport = jest.fn();
    const { getByLabelText } = render(
      <ShiftReportsView shifts={shifts} onExport={onExport} />
    );
    fireEvent.press(getByLabelText("Export report CSV"));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(typeof onExport.mock.calls[0][0]).toBe("string");
  });

  it("renders empty state with no shifts", () => {
    const { getByText } = render(<ShiftReportsView shifts={[]} />);
    expect(getByText("No shifts to summarize")).toBeTruthy();
  });
});
