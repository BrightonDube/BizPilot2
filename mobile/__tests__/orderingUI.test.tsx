/**
 * UI tests for ProductCard, CartView, and TagPicker components.
 */

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ProductCard, {
  type ProductCardProduct,
} from "../components/ordering/ProductCard";
import CartView, { type CartItem } from "../components/ordering/CartView";
import TagPicker, { type Tag } from "../components/tags/TagPicker";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const makeProduct = (overrides?: Partial<ProductCardProduct>): ProductCardProduct => ({
  id: "p1",
  name: "Chicken Burger",
  description: "Juicy grilled chicken patty",
  price: 89.99,
  imageUrl: null,
  category: "Burgers",
  isAvailable: true,
  isPopular: false,
  preparationTime: 12,
  allergens: [],
  ...overrides,
});

const makeCartItem = (overrides?: Partial<CartItem>): CartItem => ({
  id: "ci1",
  productId: "p1",
  productName: "Chicken Burger",
  quantity: 2,
  unitPrice: 89.99,
  lineTotal: 179.98,
  ...overrides,
});

const defaultCartProps = {
  subtotal: 179.98,
  tax: 27.0,
  deliveryFee: 15.0,
  total: 221.98,
  onUpdateQuantity: jest.fn(),
  onRemoveItem: jest.fn(),
  onCheckout: jest.fn(),
  onClearCart: jest.fn(),
  onBack: jest.fn(),
};

const makeTags = (): Tag[] => [
  { id: "t1", name: "Spicy", color: "#ef4444", category: "Flavour" },
  { id: "t2", name: "Vegan", color: "#22c55e", category: "Diet" },
  { id: "t3", name: "Gluten-Free", color: "#3b82f6", category: "Diet" },
];

// ===========================================================================
// ProductCard
// ===========================================================================

describe("ProductCard", () => {
  it("renders product name, price, and category", () => {
    const product = makeProduct();
    const { getByTestId, getByText } = render(
      <ProductCard product={product} onPress={jest.fn()} />,
    );

    expect(getByTestId("product-name-p1").props.children).toBe("Chicken Burger");
    expect(getByTestId("product-price-p1").props.children).toBe("R 89.99");
    expect(getByText("Burgers")).toBeTruthy();
  });

  it("shows Popular badge for popular products", () => {
    const product = makeProduct({ isPopular: true });
    const { getByTestId, getByText } = render(
      <ProductCard product={product} onPress={jest.fn()} />,
    );

    expect(getByTestId("product-popular-p1")).toBeTruthy();
    expect(getByText("Popular")).toBeTruthy();
  });

  it("shows unavailable overlay when product is not available", () => {
    const product = makeProduct({ isAvailable: false });
    const { getByTestId, getByText } = render(
      <ProductCard product={product} onPress={jest.fn()} />,
    );

    expect(getByTestId("product-unavailable-p1")).toBeTruthy();
    expect(getByText("Unavailable")).toBeTruthy();
  });

  it("calls onAddToCart when add button is pressed", () => {
    const onAddToCart = jest.fn();
    const product = makeProduct();
    const { getByTestId } = render(
      <ProductCard product={product} onPress={jest.fn()} onAddToCart={onAddToCart} />,
    );

    fireEvent.press(getByTestId("product-add-p1"));
    expect(onAddToCart).toHaveBeenCalledWith("p1");
  });
});

// ===========================================================================
// CartView
// ===========================================================================

describe("CartView", () => {
  it("renders cart items with quantities and totals", () => {
    const items = [
      makeCartItem(),
      makeCartItem({ id: "ci2", productName: "Fries", quantity: 1, lineTotal: 35.0 }),
    ];
    const { getByTestId, getByText } = render(
      <CartView {...defaultCartProps} items={items} />,
    );

    expect(getByTestId("cart-item-ci1")).toBeTruthy();
    expect(getByTestId("cart-item-ci2")).toBeTruthy();
    expect(getByText("Chicken Burger")).toBeTruthy();
    expect(getByText("Fries")).toBeTruthy();
    expect(getByTestId("cart-total").props.children).toBe("R 221.98");
  });

  it("calls onUpdateQuantity when stepper buttons are pressed", () => {
    const onUpdateQuantity = jest.fn();
    const items = [makeCartItem({ quantity: 3 })];
    const { getByTestId } = render(
      <CartView {...defaultCartProps} items={items} onUpdateQuantity={onUpdateQuantity} />,
    );

    fireEvent.press(getByTestId("cart-qty-increase-ci1"));
    expect(onUpdateQuantity).toHaveBeenCalledWith("ci1", 4);

    fireEvent.press(getByTestId("cart-qty-decrease-ci1"));
    expect(onUpdateQuantity).toHaveBeenCalledWith("ci1", 2);
  });

  it("calls onCheckout when checkout button is pressed", () => {
    const onCheckout = jest.fn();
    const items = [makeCartItem()];
    const { getByTestId } = render(
      <CartView {...defaultCartProps} items={items} onCheckout={onCheckout} />,
    );

    fireEvent.press(getByTestId("cart-checkout-btn"));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when cart has no items", () => {
    const { getByTestId, getByText } = render(
      <CartView {...defaultCartProps} items={[]} />,
    );

    expect(getByTestId("cart-empty")).toBeTruthy();
    expect(getByText("Your cart is empty")).toBeTruthy();
  });
});

// ===========================================================================
// TagPicker
// ===========================================================================

describe("TagPicker", () => {
  it("renders tags as pills", () => {
    const tags = makeTags();
    const { getByTestId, getByText } = render(
      <TagPicker tags={tags} selectedTagIds={[]} onToggleTag={jest.fn()} />,
    );

    expect(getByTestId("tag-picker")).toBeTruthy();
    expect(getByText("Spicy")).toBeTruthy();
    expect(getByText("Vegan")).toBeTruthy();
    expect(getByText("Gluten-Free")).toBeTruthy();
  });

  it("toggles tag selection on press", () => {
    const onToggleTag = jest.fn();
    const tags = makeTags();
    const { getByTestId } = render(
      <TagPicker tags={tags} selectedTagIds={[]} onToggleTag={onToggleTag} />,
    );

    fireEvent.press(getByTestId("tag-picker-tag-t1"));
    expect(onToggleTag).toHaveBeenCalledWith("t1");
  });

  it("shows search bar when searchable prop is true", () => {
    const tags = makeTags();
    const { getByTestId } = render(
      <TagPicker tags={tags} selectedTagIds={[]} onToggleTag={jest.fn()} searchable />,
    );

    expect(getByTestId("tag-picker-search")).toBeTruthy();
  });

  it("shows selected count", () => {
    const tags = makeTags();
    const { getByTestId } = render(
      <TagPicker tags={tags} selectedTagIds={["t1", "t2"]} onToggleTag={jest.fn()} />,
    );

    expect(getByTestId("tag-picker-count").props.children).toEqual([
      2,
      "/3",
      " ",
      "selected",
    ]);
  });
});
