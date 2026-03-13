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

import MediaUploader from "../components/signage/MediaUploader";
import MenuBoardEditor from "../components/signage/MenuBoardEditor";
import ScheduleCalendar from "../components/signage/ScheduleCalendar";
import CampaignTimeline from "../components/signage/CampaignTimeline";
import AnalyticsCharts from "../components/signage/AnalyticsCharts";

// ─── MediaUploader ───────────────────────────────────────────────────────────

describe("MediaUploader", () => {
  const baseMedia = [
    { id: "m1", name: "photo.jpg", type: "image" as const, url: "https://x.com/1.jpg", status: "ready" as const, size: 1024, uploadedAt: "2024-01-01" },
    { id: "m2", name: "video.mp4", type: "video" as const, url: "https://x.com/2.mp4", status: "ready" as const, size: 2048, uploadedAt: "2024-01-02" },
  ];

  it("renders media grid with items", () => {
    const { getByTestId } = render(
      <MediaUploader media={baseMedia} onUpload={jest.fn()} onDelete={jest.fn()} />
    );
    expect(getByTestId("media-uploader")).toBeTruthy();
    expect(getByTestId("media-item-m1")).toBeTruthy();
    expect(getByTestId("media-item-m2")).toBeTruthy();
  });

  it("calls onDelete when delete pressed", () => {
    const onDelete = jest.fn();
    const { getByTestId } = render(
      <MediaUploader media={baseMedia} onUpload={jest.fn()} onDelete={onDelete} />
    );
    fireEvent.press(getByTestId("media-delete-m1"));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("shows empty state when no media", () => {
    const { getByTestId } = render(
      <MediaUploader media={[]} onUpload={jest.fn()} onDelete={jest.fn()} />
    );
    expect(getByTestId("media-empty")).toBeTruthy();
  });
});

// ─── MenuBoardEditor ─────────────────────────────────────────────────────────

describe("MenuBoardEditor", () => {
  const baseSections = [
    { id: "s1", name: "Starters", items: [{ name: "Soup", price: 45.0, description: "", isHighlighted: false }] },
    { id: "s2", name: "Mains", items: [] },
  ];
  const baseProps = {
    sections: baseSections,
    boardName: "Lunch Menu",
    onUpdateBoardName: jest.fn(),
    onAddSection: jest.fn(),
    onRemoveSection: jest.fn(),
    onUpdateSection: jest.fn(),
    onAddItem: jest.fn(),
    onRemoveItem: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onPreview: jest.fn(),
  };

  it("renders board name and sections", () => {
    const { getByTestId } = render(<MenuBoardEditor {...baseProps} />);
    expect(getByTestId("menu-board-editor")).toBeTruthy();
    expect(getByTestId("menu-board-name").props.value).toBe("Lunch Menu");
    expect(getByTestId("menu-section-s1")).toBeTruthy();
    expect(getByTestId("menu-section-s2")).toBeTruthy();
  });

  it("calls onAddSection", () => {
    const onAddSection = jest.fn();
    const { getByTestId } = render(
      <MenuBoardEditor {...baseProps} onAddSection={onAddSection} />
    );
    fireEvent.press(getByTestId("menu-add-section"));
    expect(onAddSection).toHaveBeenCalled();
  });

  it("calls onSave", () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <MenuBoardEditor {...baseProps} onSave={onSave} />
    );
    fireEvent.press(getByTestId("menu-save-btn"));
    expect(onSave).toHaveBeenCalled();
  });
});

// ─── ScheduleCalendar ────────────────────────────────────────────────────────

describe("ScheduleCalendar", () => {
  const baseSlots = [
    { id: "sl1", contentName: "Promo A", displayName: "Lobby", startTime: "2024-06-15T09:00:00Z", endTime: "2024-06-15T11:00:00Z", color: "#3b82f6", isRecurring: false },
  ];
  const baseProps = {
    slots: baseSlots,
    selectedDate: "2024-06-15",
    onDateChange: jest.fn(),
    onSlotPress: jest.fn(),
    onAddSlot: jest.fn(),
    viewMode: "day" as const,
    onViewModeChange: jest.fn(),
  };

  it("renders time slots", () => {
    const { getByTestId } = render(<ScheduleCalendar {...baseProps} />);
    expect(getByTestId("schedule-calendar")).toBeTruthy();
    expect(getByTestId("schedule-slot-sl1")).toBeTruthy();
    expect(getByTestId("schedule-hour-9")).toBeTruthy();
  });

  it("calls onDateChange with prev/next", () => {
    const onDateChange = jest.fn();
    const { getByTestId } = render(
      <ScheduleCalendar {...baseProps} onDateChange={onDateChange} />
    );
    fireEvent.press(getByTestId("schedule-date-prev"));
    expect(onDateChange).toHaveBeenCalled();
    fireEvent.press(getByTestId("schedule-date-next"));
    expect(onDateChange).toHaveBeenCalledTimes(2);
  });

  it("toggles view mode day/week", () => {
    const onViewModeChange = jest.fn();
    const { getByTestId } = render(
      <ScheduleCalendar {...baseProps} onViewModeChange={onViewModeChange} />
    );
    fireEvent.press(getByTestId("schedule-mode-week"));
    expect(onViewModeChange).toHaveBeenCalledWith("week");
  });
});

// ─── CampaignTimeline ────────────────────────────────────────────────────────

describe("CampaignTimeline", () => {
  const baseCampaigns = [
    {
      id: "c1",
      name: "Summer Sale",
      status: "active" as const,
      startDate: "2024-06-01",
      endDate: "2024-06-30",
      displayCount: 3,
      contentCount: 5,
      impressions: 12000,
    },
    {
      id: "c2",
      name: "Winter Special",
      status: "draft" as const,
      startDate: "2024-07-01",
      endDate: "2024-07-31",
      displayCount: 2,
      contentCount: 3,
      impressions: 0,
    },
  ];
  const baseProps = {
    campaigns: baseCampaigns,
    onCampaignPress: jest.fn(),
    onCreateCampaign: jest.fn(),
    onBack: jest.fn(),
  };

  it("renders campaign cards", () => {
    const { getByTestId } = render(<CampaignTimeline {...baseProps} />);
    expect(getByTestId("campaign-timeline")).toBeTruthy();
    expect(getByTestId("campaign-card-c1")).toBeTruthy();
    expect(getByTestId("campaign-card-c2")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <CampaignTimeline {...baseProps} isLoading />
    );
    expect(getByTestId("campaign-loading")).toBeTruthy();
  });

  it("calls onCampaignPress", () => {
    const onCampaignPress = jest.fn();
    const { getByTestId } = render(
      <CampaignTimeline {...baseProps} onCampaignPress={onCampaignPress} />
    );
    fireEvent.press(getByTestId("campaign-card-c1"));
    expect(onCampaignPress).toHaveBeenCalledWith("c1");
  });
});

// ─── AnalyticsCharts ─────────────────────────────────────────────────────────

describe("AnalyticsCharts", () => {
  const baseProps = {
    displayMetrics: [
      { displayId: "d1", displayName: "Lobby Display", impressions: 5000, uptimePercentage: 98.5, avgViewDuration: 12 },
    ],
    dailyMetrics: [
      { date: "2024-06-14", impressions: 1200 },
      { date: "2024-06-15", impressions: 1500 },
    ],
    totalImpressions: 15000,
    averageUptime: 97.2,
    activeDisplaysCount: 4,
    period: "7d",
    onPeriodChange: jest.fn(),
  };

  it("renders KPI cards with metrics", () => {
    const { getByTestId } = render(<AnalyticsCharts {...baseProps} />);
    expect(getByTestId("analytics-charts")).toBeTruthy();
    expect(getByTestId("analytics-impressions")).toBeTruthy();
    expect(getByTestId("analytics-uptime")).toBeTruthy();
  });

  it("shows period selector", () => {
    const onPeriodChange = jest.fn();
    const { getByTestId } = render(
      <AnalyticsCharts {...baseProps} onPeriodChange={onPeriodChange} />
    );
    fireEvent.press(getByTestId("analytics-period-30d"));
    expect(onPeriodChange).toHaveBeenCalledWith("30d");
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <AnalyticsCharts {...baseProps} isLoading />
    );
    expect(getByTestId("analytics-loading")).toBeTruthy();
  });
});
