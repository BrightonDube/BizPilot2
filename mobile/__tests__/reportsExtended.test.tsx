import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

import UserActivityTab from "../components/reports/UserActivityTab";
import LoginHistoryTab from "../components/reports/LoginHistoryTab";
import DateRangePicker from "../components/reports/DateRangePicker";
import UserFilter from "../components/reports/UserFilter";
import ExportButton from "../components/reports/ExportButton";

// ─── UserActivityTab ─────────────────────────────────────────────────────────

describe("UserActivityTab", () => {
  const baseActivities = [
    {
      userId: "u1",
      userName: "Alice",
      role: "Cashier",
      loginCount: 20,
      totalSessionHours: 40,
      transactionsProcessed: 150,
      salesTotal: 25000,
      isCurrentlyActive: true,
      lastActiveAt: "2024-06-15T10:00:00Z",
    },
    {
      userId: "u2",
      userName: "Bob",
      role: "Manager",
      loginCount: 15,
      totalSessionHours: 35,
      transactionsProcessed: 80,
      salesTotal: 18000,
      isCurrentlyActive: false,
      lastActiveAt: "2024-06-14T17:00:00Z",
    },
  ];
  const baseProps = {
    activities: baseActivities,
    dateRange: { startDate: "2024-06-01", endDate: "2024-06-30" },
  };

  it("renders user rows with activity data", () => {
    const { getByTestId } = render(<UserActivityTab {...baseProps} />);
    expect(getByTestId("user-activity-tab")).toBeTruthy();
    expect(getByTestId("user-activity-row-u1")).toBeTruthy();
    expect(getByTestId("user-activity-row-u2")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <UserActivityTab {...baseProps} isLoading />
    );
    expect(getByTestId("user-activity-loading")).toBeTruthy();
  });

  it("shows summary cards", () => {
    const { getByTestId } = render(<UserActivityTab {...baseProps} />);
    expect(getByTestId("user-activity-summary")).toBeTruthy();
    expect(getByTestId("user-activity-total-logins")).toBeTruthy();
    expect(getByTestId("user-activity-total-txns")).toBeTruthy();
  });
});

// ─── LoginHistoryTab ─────────────────────────────────────────────────────────

describe("LoginHistoryTab", () => {
  const baseEvents = [
    { id: "e1", userId: "u1", userName: "Alice", action: "login" as const, timestamp: "2024-06-15T08:00:00Z", deviceInfo: "iPhone 14", ipAddress: "192.168.1.1", success: true },
    { id: "e2", userId: "u1", userName: "Alice", action: "logout" as const, timestamp: "2024-06-15T17:00:00Z", deviceInfo: "iPhone 14", ipAddress: "192.168.1.1", success: true },
    { id: "e3", userId: "u2", userName: "Bob", action: "failed_login" as const, timestamp: "2024-06-15T09:30:00Z", deviceInfo: "Samsung S23", ipAddress: "192.168.1.2", success: false },
  ];

  it("renders login events", () => {
    const { getByTestId } = render(
      <LoginHistoryTab events={baseEvents} />
    );
    expect(getByTestId("login-history-tab")).toBeTruthy();
    expect(getByTestId("login-event-e1")).toBeTruthy();
    expect(getByTestId("login-event-e2")).toBeTruthy();
    expect(getByTestId("login-event-e3")).toBeTruthy();
  });

  it("filters by action type", () => {
    const { getByTestId, queryByTestId } = render(
      <LoginHistoryTab events={baseEvents} />
    );
    fireEvent.press(getByTestId("login-filter-failed"));
    expect(getByTestId("login-event-e3")).toBeTruthy();
    expect(queryByTestId("login-event-e1")).toBeNull();
  });

  it("shows load more button when hasMore", () => {
    const onLoadMore = jest.fn();
    const { getByTestId } = render(
      <LoginHistoryTab events={baseEvents} hasMore onLoadMore={onLoadMore} />
    );
    const loadMoreBtn = getByTestId("login-load-more");
    expect(loadMoreBtn).toBeTruthy();
    fireEvent.press(loadMoreBtn);
    expect(onLoadMore).toHaveBeenCalled();
  });
});

// ─── DateRangePicker ─────────────────────────────────────────────────────────

describe("DateRangePicker", () => {
  const baseProps = {
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    onRangeChange: jest.fn(),
  };

  it("renders date range display", () => {
    const { getByTestId } = render(<DateRangePicker {...baseProps} />);
    expect(getByTestId("date-range-picker")).toBeTruthy();
  });

  it("calls onRangeChange when preset tapped", () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <DateRangePicker {...baseProps} onRangeChange={onRangeChange} />
    );
    fireEvent.press(getByTestId("date-preset-7 Days"));
    expect(onRangeChange).toHaveBeenCalled();
  });

  it("shows custom inputs", () => {
    const { getByTestId } = render(<DateRangePicker {...baseProps} />);
    fireEvent.press(getByTestId("date-preset-Custom"));
    expect(getByTestId("date-start")).toBeTruthy();
    expect(getByTestId("date-end")).toBeTruthy();
    expect(getByTestId("date-apply-btn")).toBeTruthy();
  });
});

// ─── UserFilter ──────────────────────────────────────────────────────────────

describe("UserFilter", () => {
  const baseUsers = [
    { id: "u1", name: "Alice", role: "Cashier", avatarInitials: "AL" },
    { id: "u2", name: "Bob", role: "Manager", avatarInitials: "BO" },
    { id: "u3", name: "Charlie", role: "Admin", avatarInitials: "CH" },
  ];
  const baseProps = {
    users: baseUsers,
    selectedUserIds: ["u1"],
    onToggleUser: jest.fn(),
    onSelectAll: jest.fn(),
    onClearAll: jest.fn(),
  };

  it("renders user chips", () => {
    const { getByTestId } = render(<UserFilter {...baseProps} />);
    expect(getByTestId("user-filter")).toBeTruthy();
    expect(getByTestId("user-filter-chip-u1")).toBeTruthy();
    expect(getByTestId("user-filter-chip-u2")).toBeTruthy();
    expect(getByTestId("user-filter-chip-u3")).toBeTruthy();
  });

  it("toggles user selection", () => {
    const onToggleUser = jest.fn();
    const { getByTestId } = render(
      <UserFilter {...baseProps} onToggleUser={onToggleUser} />
    );
    fireEvent.press(getByTestId("user-filter-chip-u2"));
    expect(onToggleUser).toHaveBeenCalledWith("u2");
  });

  it("select all / clear all", () => {
    const onSelectAll = jest.fn();
    const onClearAll = jest.fn();
    const { getByTestId } = render(
      <UserFilter {...baseProps} onSelectAll={onSelectAll} onClearAll={onClearAll} />
    );
    fireEvent.press(getByTestId("user-filter-select-all"));
    expect(onSelectAll).toHaveBeenCalled();
    fireEvent.press(getByTestId("user-filter-clear"));
    expect(onClearAll).toHaveBeenCalled();
  });
});

// ─── ExportButton ────────────────────────────────────────────────────────────

describe("ExportButton", () => {
  const baseProps = {
    onExportPDF: jest.fn(),
    onExportExcel: jest.fn(),
  };

  it("renders export button", () => {
    const { getByTestId } = render(<ExportButton {...baseProps} />);
    expect(getByTestId("export-button")).toBeTruthy();
  });

  it("shows dropdown on press", () => {
    const { getByTestId } = render(<ExportButton {...baseProps} />);
    fireEvent.press(getByTestId("export-button"));
    expect(getByTestId("export-dropdown")).toBeTruthy();
    expect(getByTestId("export-pdf")).toBeTruthy();
    expect(getByTestId("export-excel")).toBeTruthy();
  });

  it("calls onExportPDF", () => {
    const onExportPDF = jest.fn();
    const { getByTestId } = render(
      <ExportButton {...baseProps} onExportPDF={onExportPDF} />
    );
    fireEvent.press(getByTestId("export-button"));
    fireEvent.press(getByTestId("export-pdf"));
    expect(onExportPDF).toHaveBeenCalled();
  });
});
