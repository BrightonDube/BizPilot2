/**
 * BizPilot Mobile POS — Test Utilities
 *
 * Shared helpers for unit and integration tests. Provides:
 * - Factory functions for creating test data (products, cart items, orders)
 * - Render wrapper with providers (navigation, database, stores)
 * - Common assertions for POS-specific patterns
 *
 * Why a shared test utility module?
 * Test files were duplicating mock data and setup boilerplate.
 * Centralizing factories and wrappers means:
 * 1. Less code per test file
 * 2. Consistent test data across the suite
 * 3. Single place to update when types change
 */

import React, { type ReactNode } from "react";
import type {
  MobileProduct,
  MobileOrder,
  MobileOrderItem,
  CartItem,
  MobileCategory,
} from "@/types";
import { DEFAULT_VAT_RATE } from "@/utils/constants";

// ---------------------------------------------------------------------------
// ID generation for tests
// ---------------------------------------------------------------------------

let testIdCounter = 0;

/** Generate a unique test ID. Resets between test files via resetTestIds(). */
export function testId(prefix = "test"): string {
  testIdCounter += 1;
  return `${prefix}-${testIdCounter}`;
}

/** Reset the ID counter (call in beforeEach if needed). */
export function resetTestIds(): void {
  testIdCounter = 0;
}

// ---------------------------------------------------------------------------
// Factory: Products
// ---------------------------------------------------------------------------

type ProductOverrides = Partial<MobileProduct>;

/**
 * Create a test product with sensible POS defaults.
 * Override any field by passing it in the overrides object.
 */
export function createTestProduct(overrides: ProductOverrides = {}): MobileProduct {
  const id = overrides.id ?? testId("prod");
  const now = Date.now();

  return {
    id,
    remoteId: id,
    name: `Test Product ${id}`,
    sku: `SKU-${id}`,
    barcode: null,
    description: null,
    price: 100,
    costPrice: 40,
    categoryId: "test-category",
    imageUrl: null,
    isActive: true,
    trackInventory: true,
    stockQuantity: 50,
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
    isDirty: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Categories
// ---------------------------------------------------------------------------

type CategoryOverrides = Partial<MobileCategory>;

export function createTestCategory(overrides: CategoryOverrides = {}): MobileCategory {
  const id = overrides.id ?? testId("cat");
  const now = Date.now();

  return {
    id,
    remoteId: id,
    name: `Test Category ${id}`,
    description: null,
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
    isDirty: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Cart Items
// ---------------------------------------------------------------------------

type CartItemOverrides = Partial<CartItem>;

export function createTestCartItem(overrides: CartItemOverrides = {}): CartItem {
  const productId = overrides.productId ?? testId("prod");

  return {
    productId,
    productName: `Product ${productId}`,
    quantity: 1,
    unitPrice: 100,
    discount: 0,
    notes: null,
    ...overrides,
  };
}

/**
 * Create multiple cart items at once.
 * Useful for testing cart totals with various item counts.
 */
export function createTestCart(count: number, basePrice = 100): CartItem[] {
  return Array.from({ length: count }, (_, i) =>
    createTestCartItem({
      productId: `prod-${i}`,
      productName: `Product ${i}`,
      unitPrice: basePrice + i * 10,
      quantity: 1,
    })
  );
}

// ---------------------------------------------------------------------------
// Factory: Orders
// ---------------------------------------------------------------------------

type OrderOverrides = Partial<MobileOrder>;

export function createTestOrder(overrides: OrderOverrides = {}): MobileOrder {
  const id = overrides.id ?? testId("order");
  const now = Date.now();

  return {
    id,
    remoteId: null,
    orderNumber: `POS-TEST-${id}`,
    customerId: null,
    status: "completed",
    subtotal: 100,
    taxAmount: 13.04,
    discountAmount: 0,
    total: 100,
    paymentMethod: "cash",
    paymentStatus: "paid",
    notes: null,
    createdBy: "test-user",
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    isDirty: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Order Items
// ---------------------------------------------------------------------------

type OrderItemOverrides = Partial<MobileOrderItem>;

export function createTestOrderItem(overrides: OrderItemOverrides = {}): MobileOrderItem {
  const id = overrides.id ?? testId("item");
  const now = Date.now();

  return {
    id,
    remoteId: null,
    orderId: "test-order",
    productId: "test-product",
    productName: "Test Product",
    quantity: 1,
    unitPrice: 100,
    discount: 0,
    total: 100,
    notes: null,
    createdAt: now,
    syncedAt: null,
    isDirty: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a monetary value is correctly rounded to 2 decimal places.
 */
export function expectRoundedTo2(value: number): void {
  const rounded = Math.round(value * 100) / 100;
  expect(value).toBe(rounded);
}

/**
 * Assert that two monetary values are equal within 1 cent tolerance.
 * Accounts for floating-point arithmetic drift.
 */
export function expectWithinCent(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.01);
}

/**
 * Assert that a value is a valid ZAR amount (non-negative, 2 decimal places max).
 */
export function expectValidZAR(value: number): void {
  expect(value).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(value)).toBe(true);
  expectRoundedTo2(value);
}

// ---------------------------------------------------------------------------
// Mock API responses
// ---------------------------------------------------------------------------

/**
 * Create a mock API success response matching the backend's list format.
 */
export function mockListResponse<T>(items: T[], total?: number) {
  return {
    items,
    total: total ?? items.length,
    page: 1,
    per_page: 20,
    pages: 1,
  };
}

/**
 * Create a mock API error response.
 */
export function mockErrorResponse(message: string, status = 400) {
  return {
    status,
    data: { detail: message },
  };
}

// ---------------------------------------------------------------------------
// Timing utilities
// ---------------------------------------------------------------------------

/**
 * Wait for a specified number of milliseconds.
 * Use sparingly — prefer waitFor/act from testing-library.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending promises (microtask queue).
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
