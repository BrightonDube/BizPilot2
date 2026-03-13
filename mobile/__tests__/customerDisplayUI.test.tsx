/**
 * UI tests for customer-display components:
 * OrderDisplay, PaymentDisplay, LoyaltyDisplay.
 */

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import OrderDisplay from "../components/customer-display/OrderDisplay";
import PaymentDisplay from "../components/customer-display/PaymentDisplay";
import LoyaltyDisplay from "../components/customer-display/LoyaltyDisplay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: string[];
}

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  isRedeemable: boolean;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createCartItem(overrides?: Partial<CartItem>): CartItem {
  return {
    id: "ci-1",
    name: "Chicken Burger",
    quantity: 2,
    unitPrice: 89.9,
    lineTotal: 179.8,
    ...overrides,
  };
}

const defaultItems: CartItem[] = [
  createCartItem({ id: "ci-1", name: "Chicken Burger", quantity: 2, unitPrice: 89.9, lineTotal: 179.8 }),
  createCartItem({ id: "ci-2", name: "Cola", quantity: 1, unitPrice: 25, lineTotal: 25 }),
];

function createReward(overrides?: Partial<Reward>): Reward {
  return {
    id: "rw-1",
    name: "Free Coffee",
    pointsCost: 500,
    isRedeemable: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// OrderDisplay
// ---------------------------------------------------------------------------

describe("OrderDisplay", () => {
  it("renders items list with quantities and totals", () => {
    const { getByTestId } = render(
      <OrderDisplay
        items={defaultItems}
        subtotal={204.8}
        tax={30.72}
        discount={0}
        total={235.52}
      />,
    );

    expect(getByTestId("order-display")).toBeTruthy();
    expect(getByTestId("order-item-ci-1")).toBeTruthy();
    expect(getByTestId("order-item-ci-2")).toBeTruthy();
    expect(getByTestId("order-subtotal")).toBeTruthy();
    expect(getByTestId("order-tax")).toBeTruthy();
    expect(getByTestId("order-total")).toBeTruthy();
  });

  it("shows discount when > 0", () => {
    const { getByTestId } = render(
      <OrderDisplay
        items={defaultItems}
        subtotal={204.8}
        tax={27.72}
        discount={20}
        total={212.52}
      />,
    );

    expect(getByTestId("order-discount")).toBeTruthy();
  });

  it("shows empty state when no items", () => {
    const { getByTestId, queryByTestId } = render(
      <OrderDisplay
        items={[]}
        subtotal={0}
        tax={0}
        discount={0}
        total={0}
      />,
    );

    expect(getByTestId("order-empty")).toBeTruthy();
    expect(queryByTestId("order-subtotal")).toBeNull();
  });

  it("shows customer name greeting", () => {
    const { getByTestId } = render(
      <OrderDisplay
        items={defaultItems}
        subtotal={204.8}
        tax={30.72}
        discount={0}
        total={235.52}
        customerName="John"
      />,
    );

    expect(getByTestId("order-customer-name")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PaymentDisplay
// ---------------------------------------------------------------------------

describe("PaymentDisplay", () => {
  it("shows pending state", () => {
    const { getByTestId } = render(
      <PaymentDisplay amount={235.52} method="cash" status="pending" />,
    );

    expect(getByTestId("payment-display")).toBeTruthy();
    expect(getByTestId("payment-amount")).toBeTruthy();
    expect(getByTestId("payment-status")).toBeTruthy();
  });

  it("shows complete state with change due", () => {
    const { getByTestId } = render(
      <PaymentDisplay
        amount={235.52}
        method="cash"
        status="complete"
        changeDue={14.48}
      />,
    );

    expect(getByTestId("payment-status")).toBeTruthy();
    expect(getByTestId("payment-change")).toBeTruthy();
  });

  it("shows failed state with retry button", () => {
    const onRetry = jest.fn();
    const { getByTestId } = render(
      <PaymentDisplay
        amount={235.52}
        method="card"
        status="failed"
        onRetry={onRetry}
      />,
    );

    expect(getByTestId("payment-status")).toBeTruthy();
    const retryBtn = getByTestId("payment-retry-btn");
    expect(retryBtn).toBeTruthy();
    fireEvent.press(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows QR code section when data provided", () => {
    const { getByTestId } = render(
      <PaymentDisplay
        amount={100}
        method="qr_code"
        status="pending"
        qrCodeData="https://pay.example.com/abc123"
      />,
    );

    expect(getByTestId("payment-qr")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// LoyaltyDisplay
// ---------------------------------------------------------------------------

describe("LoyaltyDisplay", () => {
  const rewards: Reward[] = [
    createReward({ id: "rw-1", name: "Free Coffee", pointsCost: 500, isRedeemable: true }),
    createReward({ id: "rw-2", name: "10% Discount", pointsCost: 1000, isRedeemable: false }),
  ];

  it("renders customer welcome with name", () => {
    const { getByTestId } = render(
      <LoyaltyDisplay
        customerName="Sarah"
        currentPoints={1250}
        pointsToEarn={50}
        tier="Gold"
        tierProgress={75}
        nextTierName="Platinum"
        availableRewards={rewards}
      />,
    );

    expect(getByTestId("loyalty-display")).toBeTruthy();
    expect(getByTestId("loyalty-name")).toBeTruthy();
  });

  it("shows points and tier info", () => {
    const { getByTestId } = render(
      <LoyaltyDisplay
        customerName="Sarah"
        currentPoints={1250}
        pointsToEarn={50}
        tier="Gold"
        tierProgress={75}
        nextTierName="Platinum"
        availableRewards={rewards}
      />,
    );

    expect(getByTestId("loyalty-points")).toBeTruthy();
    expect(getByTestId("loyalty-tier")).toBeTruthy();
    expect(getByTestId("loyalty-earn")).toBeTruthy();
    expect(getByTestId("loyalty-progress")).toBeTruthy();
  });

  it("shows reward cards", () => {
    const onRedeem = jest.fn();
    const { getByTestId } = render(
      <LoyaltyDisplay
        customerName="Sarah"
        currentPoints={1250}
        pointsToEarn={50}
        tier="Gold"
        tierProgress={75}
        nextTierName="Platinum"
        availableRewards={rewards}
        onRedeemReward={onRedeem}
      />,
    );

    expect(getByTestId("loyalty-reward-rw-1")).toBeTruthy();
    expect(getByTestId("loyalty-reward-rw-2")).toBeTruthy();

    // Redeem the redeemable one
    fireEvent.press(getByTestId("loyalty-redeem-rw-1"));
    expect(onRedeem).toHaveBeenCalledWith("rw-1");
  });

  it("shows empty rewards state", () => {
    const { getByTestId, queryByTestId } = render(
      <LoyaltyDisplay
        customerName="Sarah"
        currentPoints={100}
        pointsToEarn={10}
        tier="Bronze"
        tierProgress={20}
        nextTierName="Silver"
        availableRewards={[]}
      />,
    );

    expect(getByTestId("loyalty-no-rewards")).toBeTruthy();
    expect(queryByTestId("loyalty-reward-rw-1")).toBeNull();
  });
});
