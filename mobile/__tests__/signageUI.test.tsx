/**
 * BizPilot Mobile — Signage UI Tests
 *
 * Tests the DisplayCard, ContentEditor, and PlaylistBuilder components.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import DisplayCard, {
  type DisplayInfo,
  type DisplayCardProps,
} from "@/components/signage/DisplayCard";

import ContentEditor, {
  type ContentBlock,
  type ContentEditorProps,
} from "@/components/signage/ContentEditor";

import PlaylistBuilder, {
  type PlaylistItem,
  type PlaylistBuilderProps,
} from "@/components/signage/PlaylistBuilder";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockDisplay: DisplayInfo = {
  id: "d1",
  name: "Lobby Screen",
  location: "Front Entrance",
  status: "online",
  resolution: "1920x1080",
  orientation: "landscape",
  currentContent: "Welcome Promo",
  lastPingAt: new Date(Date.now() - 30000).toISOString(),
  uptime: 98.5,
};

const mockBlocks: ContentBlock[] = [
  {
    id: "b1",
    type: "text",
    title: "Welcome",
    content: "Welcome to our store!",
    duration: 10,
  },
  {
    id: "b2",
    type: "image",
    title: "Banner",
    content: "https://example.com/banner.jpg",
    duration: 15,
  },
];

const mockPlaylistItems: PlaylistItem[] = [
  {
    id: "pl1",
    contentName: "Morning Promo",
    contentType: "promotion",
    duration: 20,
  },
  {
    id: "pl2",
    contentName: "Menu Board",
    contentType: "menu_board",
    duration: 30,
  },
  {
    id: "pl3",
    contentName: "Welcome Video",
    contentType: "video",
    duration: 60,
  },
];

const mockAvailableContent = [
  { id: "c1", name: "Daily Special", type: "text" as const },
  { id: "c2", name: "Logo Image", type: "image" as const },
];

// ─── DisplayCard Tests ───────────────────────────────────────────────────────

describe("DisplayCard", () => {
  const baseProps: DisplayCardProps = {
    display: mockDisplay,
    onPress: jest.fn(),
  };

  it("renders display info (name, location, status)", () => {
    const { getByText, getByTestId } = render(
      <DisplayCard {...baseProps} />,
    );

    expect(getByText("Lobby Screen")).toBeTruthy();
    expect(getByText("Front Entrance")).toBeTruthy();
    expect(getByText("Online")).toBeTruthy();
    expect(getByTestId("display-card-d1")).toBeTruthy();
  });

  it("shows online/offline status color", () => {
    const { getByTestId, rerender } = render(
      <DisplayCard {...baseProps} />,
    );
    expect(getByTestId("display-status-d1")).toBeTruthy();

    const offlineDisplay: DisplayInfo = {
      ...mockDisplay,
      id: "d2",
      status: "offline",
    };
    rerender(
      <DisplayCard
        display={offlineDisplay}
        onPress={jest.fn()}
      />,
    );
    expect(getByTestId("display-status-d2")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <DisplayCard display={mockDisplay} onPress={onPress} />,
    );

    fireEvent.press(getByTestId("display-card-d1"));
    expect(onPress).toHaveBeenCalledWith("d1");
  });
});

// ─── ContentEditor Tests ─────────────────────────────────────────────────────

describe("ContentEditor", () => {
  const baseProps: ContentEditorProps = {
    blocks: mockBlocks,
    onAddBlock: jest.fn(),
    onUpdateBlock: jest.fn(),
    onRemoveBlock: jest.fn(),
    onReorderBlocks: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  it("renders block list", () => {
    const { getByTestId, getByText } = render(
      <ContentEditor {...baseProps} />,
    );

    expect(getByTestId("content-editor")).toBeTruthy();
    expect(getByTestId("content-block-b1")).toBeTruthy();
    expect(getByTestId("content-block-b2")).toBeTruthy();
    expect(getByText("Blocks (2)")).toBeTruthy();
  });

  it("add block buttons work", () => {
    const onAddBlock = jest.fn();
    const { getByTestId } = render(
      <ContentEditor {...baseProps} onAddBlock={onAddBlock} />,
    );

    fireEvent.press(getByTestId("content-add-text"));
    expect(onAddBlock).toHaveBeenCalledWith("text");

    fireEvent.press(getByTestId("content-add-image"));
    expect(onAddBlock).toHaveBeenCalledWith("image");
  });

  it("remove block works", () => {
    const onRemoveBlock = jest.fn();
    const { getByTestId } = render(
      <ContentEditor {...baseProps} onRemoveBlock={onRemoveBlock} />,
    );

    fireEvent.press(getByTestId("content-remove-b1"));
    expect(onRemoveBlock).toHaveBeenCalledWith("b1");
  });

  it("shows empty state", () => {
    const { getByTestId } = render(
      <ContentEditor {...baseProps} blocks={[]} />,
    );

    expect(getByTestId("content-empty")).toBeTruthy();
  });
});

// ─── PlaylistBuilder Tests ───────────────────────────────────────────────────

describe("PlaylistBuilder", () => {
  const baseProps: PlaylistBuilderProps = {
    items: mockPlaylistItems,
    availableContent: mockAvailableContent,
    onAddItem: jest.fn(),
    onRemoveItem: jest.fn(),
    onUpdateDuration: jest.fn(),
    onReorder: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    totalDuration: 110,
  };

  it("renders playlist items", () => {
    const { getByTestId, getByText } = render(
      <PlaylistBuilder {...baseProps} />,
    );

    expect(getByTestId("playlist-builder")).toBeTruthy();
    expect(getByTestId("playlist-item-pl1")).toBeTruthy();
    expect(getByTestId("playlist-item-pl2")).toBeTruthy();
    expect(getByTestId("playlist-item-pl3")).toBeTruthy();
    expect(getByText("Morning Promo")).toBeTruthy();
  });

  it("shows total duration", () => {
    const { getByTestId } = render(
      <PlaylistBuilder {...baseProps} />,
    );

    expect(getByTestId("playlist-total-duration")).toBeTruthy();
  });

  it("shows empty state", () => {
    const { getByTestId } = render(
      <PlaylistBuilder {...baseProps} items={[]} totalDuration={0} />,
    );

    expect(getByTestId("playlist-empty")).toBeTruthy();
  });
});
