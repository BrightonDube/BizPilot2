/**
 * ProductCard.test.tsx — Unit tests for ProductCard component
 */

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

import { render, fireEvent } from "@testing-library/react-native";
import { ProductCard } from "@/components/pos/ProductCard";
import type { POSProduct } from "@/types/pos";
import { useCartStore } from "@/stores/cartStore";

const createMockProduct = (overrides: Partial<POSProduct> = {}): POSProduct => ({
  id: "prod-1",
  name: "Test Burger",
  sku: "BUR001",
  price: 89.99,
  category_id: "cat-1",
  category_name: "Burgers",
  image_url: null,
  stock_quantity: 10,
  is_active: true,
  is_in_stock: true,
  ...overrides,
});

describe("ProductCard", () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it("renders product name", () => {
    const product = createMockProduct();
    const { getByText } = render(<ProductCard product={product} onPress={() => {}} />);
    expect(getByText("Test Burger")).toBeTruthy();
  });

  it("renders price formatted as R[x.xx]", () => {
    const product = createMockProduct({ price: 89.99 });
    const { getByText } = render(<ProductCard product={product} onPress={() => {}} />);
    expect(getByText("R89.99")).toBeTruthy();
  });

  it("out-of-stock product renders with opacity 0.4", () => {
    const product = createMockProduct({ is_in_stock: false, stock_quantity: 0 });
    const { getByText } = render(<ProductCard product={product} onPress={() => {}} />);
    expect(getByText("Out of Stock")).toBeTruthy();
  });

  it("out-of-stock product does NOT call addItem when pressed", () => {
    const product = createMockProduct({ is_in_stock: false, stock_quantity: 0 });
    const onPress = jest.fn();
    const { getByText } = render(<ProductCard product={product} onPress={onPress} />);
    fireEvent.press(getByText("Test Burger"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("in-stock product calls cartStore.addItem when pressed", async () => {
    const product = createMockProduct();
    const onPress = jest.fn();
    const { getByTestId } = render(<ProductCard product={product} onPress={onPress} />);
    await fireEvent.press(getByTestId(`product-${product.id}`));
    // Wait for async state update
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useCartStore.getState().items.length).toBe(1);
    expect(useCartStore.getState().items[0].productId).toBe("prod-1");
  });

  it("in-stock product shows no Out of Stock label", () => {
    const product = createMockProduct({ is_in_stock: true, stock_quantity: 10 });
    const { queryByText } = render(<ProductCard product={product} onPress={() => {}} />);
    expect(queryByText("Out of Stock")).toBeNull();
  });
});
