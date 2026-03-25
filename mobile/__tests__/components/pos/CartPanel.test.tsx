/**
 * CartPanel.test.tsx — Unit tests for CartPanel component
 */

import { render } from "@testing-library/react-native";
import { CartPanel } from "@/components/pos/CartPanel";
import { useCartStore } from "@/stores/cartStore";
import { createTestCartItem } from "@/__tests__/testUtils";

describe("CartPanel", () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it("Charge button is disabled when cart is empty", () => {
    const { getByText } = render(<CartPanel onCharge={() => {}} />);
    const button = getByText("Charge R0.00");
    expect(button).toBeTruthy();
  });

  it("Charge button shows Charge R0.00 when cart is empty", () => {
    const { getByText } = render(<CartPanel onCharge={() => {}} />);
    expect(getByText("Charge R0.00")).toBeTruthy();
  });

  it("Charge button shows correct grand total from cartStore", () => {
    useCartStore.getState().addItem({
      productId: "prod-1",
      productName: "Test Product",
      unitPrice: 100,
      quantity: 2,
    });
    const { getByText } = render(<CartPanel onCharge={() => {}} />);
    expect(getByText("Charge R230.00")).toBeTruthy();
  });

  it("empty state message shown when cart has no items", () => {
    const { getByText } = render(<CartPanel onCharge={() => {}} />);
    expect(getByText("Cart is empty — tap a product to add it")).toBeTruthy();
  });

  it("CartItemRow rendered for each item in cart", () => {
    useCartStore.getState().addItem({
      productId: "prod-1",
      productName: "Burger",
      unitPrice: 89.99,
    });
    useCartStore.getState().addItem({
      productId: "prod-2",
      productName: "Fries",
      unitPrice: 29.99,
    });
    const { getByText } = render(<CartPanel onCharge={() => {}} />);
    expect(getByText("Burger")).toBeTruthy();
    expect(getByText("Fries")).toBeTruthy();
  });
});
