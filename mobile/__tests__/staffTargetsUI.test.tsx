/**
 * Integration tests for staff performance UI components.
 */

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import LeaderboardDisplay from "../components/staff/LeaderboardDisplay";
import StaffPersonalDashboard from "../components/staff/StaffPersonalDashboard";
import IncentiveProgressDisplay from "../components/staff/IncentiveProgressDisplay";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  value: number;
  target: number | null;
  progressPercent: number;
  trend: "up" | "down" | "stable";
  previousRank: number | null;
}

function makeLeaderboardEntry(
  overrides: Partial<LeaderboardEntry> = {},
): LeaderboardEntry {
  return {
    rank: 1,
    userId: "u-1",
    userName: "Alice",
    avatarUrl: null,
    value: 10000,
    target: 15000,
    progressPercent: 66,
    trend: "up",
    previousRank: 2,
    ...overrides,
  };
}

function makeLeaderboardProps(overrides: Record<string, unknown> = {}) {
  return {
    entries: [
      makeLeaderboardEntry({ rank: 1, userId: "u-1", userName: "Alice", value: 10000 }),
      makeLeaderboardEntry({ rank: 2, userId: "u-2", userName: "Bob", value: 8000 }),
      makeLeaderboardEntry({ rank: 3, userId: "u-3", userName: "Carol", value: 6000 }),
      makeLeaderboardEntry({ rank: 4, userId: "u-4", userName: "Dave", value: 4000 }),
    ],
    title: "Sales Leaderboard",
    metricLabel: "Sales",
    currentUserId: "u-2",
    onEntryPress: jest.fn(),
    isLoading: false,
    ...overrides,
  };
}

interface StaffTarget {
  id: string;
  targetType: string;
  periodType: string;
  targetValue: number;
  achievedValue: number;
  status: string;
}

interface IncentiveProgress {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  isAchieved: boolean;
  daysRemaining: number;
  rewardType: string;
  rewardValue: number;
}

function makeDashboardTarget(
  overrides: Partial<StaffTarget> = {},
): StaffTarget {
  return {
    id: "t-1",
    targetType: "sales",
    periodType: "monthly",
    targetValue: 10000,
    achievedValue: 5000,
    status: "active",
    ...overrides,
  };
}

function makeDashboardIncentive(
  overrides: Partial<IncentiveProgress> = {},
): IncentiveProgress {
  return {
    id: "inc-1",
    name: "Monthly Bonus",
    description: "Hit R 50 000",
    currentValue: 25000,
    targetValue: 50000,
    progressPercent: 50,
    isAchieved: false,
    daysRemaining: 15,
    rewardType: "cash",
    rewardValue: 2000,
    ...overrides,
  };
}

function makeDashboardProps(overrides: Record<string, unknown> = {}) {
  return {
    staffName: "Alice",
    todaySales: 3000,
    periodSales: 25000,
    rank: 2,
    totalStaff: 10,
    targets: [makeDashboardTarget()],
    incentives: [makeDashboardIncentive()],
    recentTransactionCount: 42,
    onViewLeaderboard: jest.fn(),
    onViewTargetDetails: jest.fn(),
    onBack: jest.fn(),
    isLoading: false,
    ...overrides,
  };
}

interface IncentiveItem {
  id: string;
  name: string;
  description: string;
  incentiveType: string;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  isAchieved: boolean;
  daysRemaining: number;
  rewardType: string;
  rewardValue: number;
  startDate: string;
  endDate: string;
  isTeam: boolean;
}

function makeIncentiveItem(
  overrides: Partial<IncentiveItem> = {},
): IncentiveItem {
  return {
    id: "inc-1",
    name: "Sales Sprint",
    description: "Sell R 100k this quarter",
    incentiveType: "bonus",
    targetValue: 100000,
    currentValue: 40000,
    progressPercent: 40,
    isAchieved: false,
    daysRemaining: 30,
    rewardType: "cash",
    rewardValue: 5000,
    startDate: "2025-01-01T00:00:00Z",
    endDate: "2025-03-31T23:59:59Z",
    isTeam: false,
    ...overrides,
  };
}

function makeIncentiveDisplayProps(overrides: Record<string, unknown> = {}) {
  return {
    incentives: [
      makeIncentiveItem({ id: "inc-active", isAchieved: false }),
      makeIncentiveItem({
        id: "inc-done",
        name: "Early Bird",
        isAchieved: true,
        progressPercent: 100,
      }),
    ],
    onIncentivePress: jest.fn(),
    isLoading: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LeaderboardDisplay
// ---------------------------------------------------------------------------

describe("LeaderboardDisplay", () => {
  it("renders podium and entries", () => {
    const props = makeLeaderboardProps();
    const { getByTestId } = render(<LeaderboardDisplay {...props} />);
    expect(getByTestId("leaderboard-display")).toBeTruthy();
    expect(getByTestId("leaderboard-podium")).toBeTruthy();
  });

  it("highlights current user", () => {
    const props = makeLeaderboardProps({ currentUserId: "u-2" });
    const { getByTestId } = render(<LeaderboardDisplay {...props} />);
    const entry = getByTestId("leaderboard-entry-u-2");
    expect(entry).toBeTruthy();
  });

  it("calls onEntryPress when entry tapped", () => {
    const onEntryPress = jest.fn();
    const props = makeLeaderboardProps({ onEntryPress });
    const { getByTestId } = render(<LeaderboardDisplay {...props} />);
    // u-1 is in podium, tap it
    fireEvent.press(getByTestId("leaderboard-entry-u-1"));
    expect(onEntryPress).toHaveBeenCalledWith("u-1");
  });

  it("shows loading state", () => {
    const props = makeLeaderboardProps({ isLoading: true });
    const { getByTestId } = render(<LeaderboardDisplay {...props} />);
    expect(getByTestId("leaderboard-loading")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// StaffPersonalDashboard
// ---------------------------------------------------------------------------

describe("StaffPersonalDashboard", () => {
  it("renders stats row and targets", () => {
    const props = makeDashboardProps();
    const { getByTestId } = render(<StaffPersonalDashboard {...props} />);
    expect(getByTestId("staff-dashboard")).toBeTruthy();
    expect(getByTestId("staff-stats-row")).toBeTruthy();
    expect(getByTestId("staff-targets-section")).toBeTruthy();
  });

  it("shows incentive progress", () => {
    const props = makeDashboardProps();
    const { getByTestId } = render(<StaffPersonalDashboard {...props} />);
    expect(getByTestId("staff-incentives-section")).toBeTruthy();
  });

  it("calls onViewLeaderboard when button pressed", () => {
    const onViewLeaderboard = jest.fn();
    const props = makeDashboardProps({ onViewLeaderboard });
    const { getByTestId } = render(<StaffPersonalDashboard {...props} />);
    fireEvent.press(getByTestId("staff-leaderboard-btn"));
    expect(onViewLeaderboard).toHaveBeenCalled();
  });

  it("calls onBack when back pressed", () => {
    const onBack = jest.fn();
    const props = makeDashboardProps({ onBack });
    const { getByTestId } = render(<StaffPersonalDashboard {...props} />);
    fireEvent.press(getByTestId("staff-back-btn"));
    expect(onBack).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// IncentiveProgressDisplay
// ---------------------------------------------------------------------------

describe("IncentiveProgressDisplay", () => {
  it("renders active and completed incentives", () => {
    const props = makeIncentiveDisplayProps();
    const { getByTestId } = render(<IncentiveProgressDisplay {...props} />);
    expect(getByTestId("incentive-display")).toBeTruthy();
    expect(getByTestId("incentive-active-section")).toBeTruthy();
    expect(getByTestId("incentive-completed-section")).toBeTruthy();
  });

  it("shows achieved badge for completed", () => {
    const props = makeIncentiveDisplayProps();
    const { getByTestId } = render(<IncentiveProgressDisplay {...props} />);
    expect(getByTestId("incentive-card-inc-done")).toBeTruthy();
  });

  it("calls onIncentivePress when card tapped", () => {
    const onIncentivePress = jest.fn();
    const props = makeIncentiveDisplayProps({ onIncentivePress });
    const { getByTestId } = render(<IncentiveProgressDisplay {...props} />);
    fireEvent.press(getByTestId("incentive-card-inc-active"));
    expect(onIncentivePress).toHaveBeenCalledWith("inc-active");
  });

  it("shows empty state when no incentives", () => {
    const props = makeIncentiveDisplayProps({ incentives: [] });
    const { getByTestId } = render(<IncentiveProgressDisplay {...props} />);
    expect(getByTestId("incentive-empty")).toBeTruthy();
  });
});
