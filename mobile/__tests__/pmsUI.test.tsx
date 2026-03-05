/**
 * UI tests for PMS components: GuestSearchModal & RoomChargeModal.
 */

import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks (must be before component imports)
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

import GuestSearchModal from "@/components/pms/GuestSearchModal";
import RoomChargeModal from "@/components/pms/RoomChargeModal";
import type { GuestProfile } from "@/services/pms/PMSService";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const guestA: GuestProfile = {
  id: "g-1",
  roomNumber: "101",
  guestName: "John Smith",
  checkInDate: "2025-01-10",
  checkOutDate: "2025-12-31",
  folioNumber: "F-1001",
  vipStatus: false,
  creditLimit: 5000,
  currentBalance: 1000,
  allowCharges: true,
};

const guestB: GuestProfile = {
  id: "g-2",
  roomNumber: "202",
  guestName: "Jane Doe",
  checkInDate: "2025-01-10",
  checkOutDate: "2025-12-31",
  folioNumber: "F-1002",
  vipStatus: true,
  creditLimit: 10000,
  currentBalance: 500,
  allowCharges: true,
};

const orderItems = [
  { name: "Cappuccino", quantity: 2, price: 55 },
  { name: "Club Sandwich", quantity: 1, price: 120 },
];

// =========================================================================
// GuestSearchModal
// =========================================================================

describe("GuestSearchModal", () => {
  const defaultProps = {
    visible: true,
    guests: [guestA, guestB],
    onSelectGuest: jest.fn(),
    onClose: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => jest.clearAllMocks());

  // 1
  it("renders when visible=true", () => {
    const { getByTestId } = render(<GuestSearchModal {...defaultProps} />);
    expect(getByTestId("guest-search-modal")).toBeTruthy();
  });

  // 2
  it("shows guest cards with room numbers", () => {
    const { getByTestId } = render(<GuestSearchModal {...defaultProps} />);
    expect(getByTestId("guest-card-g-1")).toBeTruthy();
    expect(getByTestId("guest-card-g-2")).toBeTruthy();
  });

  // 3
  it("filters guests when search query is entered", () => {
    const { getByTestId, queryByTestId } = render(
      <GuestSearchModal {...defaultProps} />
    );

    const input = getByTestId("guest-search-input");
    act(() => {
      fireEvent.changeText(input, "Jane");
    });

    expect(queryByTestId("guest-card-g-1")).toBeNull();
    expect(getByTestId("guest-card-g-2")).toBeTruthy();
  });

  // 4
  it("calls onSelectGuest when a guest card is pressed", () => {
    const { getByTestId } = render(<GuestSearchModal {...defaultProps} />);

    fireEvent.press(getByTestId("guest-card-g-1"));
    expect(defaultProps.onSelectGuest).toHaveBeenCalledWith(guestA);
  });

  // 5
  it("shows loading state when isLoading=true", () => {
    const { getByTestId, queryByTestId } = render(
      <GuestSearchModal {...defaultProps} guests={[]} isLoading={true} />
    );

    expect(getByTestId("guest-loading")).toBeTruthy();
    expect(queryByTestId("guest-empty")).toBeNull();
  });
});

// =========================================================================
// RoomChargeModal
// =========================================================================

describe("RoomChargeModal", () => {
  const defaultProps = {
    visible: true,
    guest: guestA,
    orderTotal: 230,
    orderItems,
    connectionStatus: "connected" as const,
    onConfirmCharge: jest.fn(),
    onClose: jest.fn(),
    isPosting: false,
  };

  beforeEach(() => jest.clearAllMocks());

  // 1
  it("renders with guest info and order total", () => {
    const { getByTestId } = render(<RoomChargeModal {...defaultProps} />);

    expect(getByTestId("room-charge-guest-info")).toBeTruthy();
    expect(getByTestId("room-charge-total")).toBeTruthy();
  });

  // 2
  it("shows order items in the summary", () => {
    const { getByText } = render(<RoomChargeModal {...defaultProps} />);

    expect(getByText(/Cappuccino/)).toBeTruthy();
    expect(getByText(/Club Sandwich/)).toBeTruthy();
  });

  // 3
  it("shows offline warning when disconnected", () => {
    const { getByTestId } = render(
      <RoomChargeModal {...defaultProps} connectionStatus="disconnected" />
    );

    expect(getByTestId("room-charge-offline-warning")).toBeTruthy();
  });

  // 4
  it("calls onConfirmCharge when confirm button is pressed", () => {
    const { getByTestId } = render(<RoomChargeModal {...defaultProps} />);

    fireEvent.press(getByTestId("room-charge-confirm-btn"));
    expect(defaultProps.onConfirmCharge).toHaveBeenCalledTimes(1);

    const request = defaultProps.onConfirmCharge.mock.calls[0][0];
    expect(request.amount).toBe(230);
    expect(request.roomNumber).toBe("101");
  });

  // 5
  it("shows posting state when isPosting=true", () => {
    const { getByTestId, queryByTestId } = render(
      <RoomChargeModal {...defaultProps} isPosting={true} />
    );

    expect(getByTestId("room-charge-posting")).toBeTruthy();
    expect(queryByTestId("room-charge-confirm-btn")).toBeNull();
  });
});
