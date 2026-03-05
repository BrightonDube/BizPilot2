/**
 * BizPilot Mobile POS — StockLevelService & OnlineOrderPOSService Tests
 *
 * Unit tests for pure stock-level management functions and online-order
 * integration with the POS system.
 */

import {
  getStockDisplayInfo,
  getStockStatus,
  checkStockAlerts,
  applyStockSale,
  applyStockRefund,
  canFulfillOrder,
  getOutOfStockProducts,
  getLowStockProducts,
  sortByStockUrgency,
  type StockLevel,
  type SaleItem,
} from "../services/stock/StockLevelService";

import {
  convertOnlineOrderToPOS,
  validateOnlineOrder,
  pushOrderToPOS,
  mapPOSStatusToOnlineStatus,
  mapOnlineStatusToPOSStatus,
  syncStatusFromPOS,
  calculateOnlineOrderTotal,
  getEstimatedPrepTime,
  filterOrdersByChannel,
  sortOrdersByPriority,
  type OnlineOrder,
  type OnlineOrderItem,
  type POSOrderStatus,
} from "../services/ordering/OnlineOrderPOSService";

// ---------------------------------------------------------------------------
// Factory: StockLevel
// ---------------------------------------------------------------------------

function createStockLevel(overrides: Partial<StockLevel> = {}): StockLevel {
  return {
    productId: "prod-1",
    productName: "Test Product",
    currentQuantity: 50,
    minimumQuantity: 10,
    maximumQuantity: 200,
    unit: "each",
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: OnlineOrder
// ---------------------------------------------------------------------------

function createOnlineOrderItem(
  overrides: Partial<OnlineOrderItem> = {},
): OnlineOrderItem {
  return {
    id: "item-1",
    productId: "prod-1",
    productName: "Burger",
    quantity: 2,
    unitPrice: 89.99,
    modifiers: [],
    specialInstructions: null,
    ...overrides,
  };
}

function createOnlineOrder(overrides: Partial<OnlineOrder> = {}): OnlineOrder {
  const items = overrides.items ?? [createOnlineOrderItem()];
  return {
    id: "order-1",
    externalId: "ext-1",
    channel: "online_web",
    customerName: "Jane Doe",
    customerPhone: "+27821234567",
    customerEmail: "jane@example.com",
    items,
    subtotal: 179.98,
    deliveryFee: 25,
    serviceFee: 10,
    discount: 0,
    total: 214.98,
    paymentStatus: "paid",
    orderStatus: "pending",
    deliveryAddress: null,
    isDelivery: false,
    estimatedPrepTime: null,
    placedAt: "2024-06-01T10:00:00Z",
    acceptedAt: null,
    completedAt: null,
    notes: null,
    ...overrides,
  };
}

// ===========================================================================
// StockLevelService
// ===========================================================================

describe("StockLevelService", () => {
  // -------------------------------------------------------------------------
  // getStockDisplayInfo
  // -------------------------------------------------------------------------

  describe("getStockDisplayInfo", () => {
    it("returns correct info for in-stock item", () => {
      const level = createStockLevel({ currentQuantity: 50, minimumQuantity: 10, unit: "each" });
      const info = getStockDisplayInfo(level);

      expect(info.status).toBe("in_stock");
      expect(info.quantity).toBe(50);
      expect(info.unit).toBe("each");
      expect(info.statusColor).toBe("#22c55e");
      expect(info.displayText).toBe("50 each in stock");
      expect(info.showWarning).toBe(false);
    });

    it("returns correct info for low-stock item", () => {
      const level = createStockLevel({ currentQuantity: 5, minimumQuantity: 10, unit: "kg" });
      const info = getStockDisplayInfo(level);

      expect(info.status).toBe("low_stock");
      expect(info.statusColor).toBe("#f59e0b");
      expect(info.displayText).toBe("Low: 5 kg left");
      expect(info.showWarning).toBe(true);
    });

    it("returns correct info for out-of-stock item", () => {
      const level = createStockLevel({ currentQuantity: 0 });
      const info = getStockDisplayInfo(level);

      expect(info.status).toBe("out_of_stock");
      expect(info.statusColor).toBe("#ef4444");
      expect(info.displayText).toBe("Out of Stock");
      expect(info.showWarning).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getStockStatus
  // -------------------------------------------------------------------------

  describe("getStockStatus", () => {
    it("returns 'in_stock' when above minimum", () => {
      expect(getStockStatus(50, 10)).toBe("in_stock");
    });

    it("returns 'low_stock' when at or below minimum but > 0", () => {
      expect(getStockStatus(10, 10)).toBe("low_stock");
      expect(getStockStatus(5, 10)).toBe("low_stock");
    });

    it("returns 'out_of_stock' when 0", () => {
      expect(getStockStatus(0, 10)).toBe("out_of_stock");
      expect(getStockStatus(-1, 10)).toBe("out_of_stock");
    });
  });

  // -------------------------------------------------------------------------
  // checkStockAlerts
  // -------------------------------------------------------------------------

  describe("checkStockAlerts", () => {
    it("returns alerts for low and out-of-stock items", () => {
      const levels = [
        createStockLevel({ productId: "a", currentQuantity: 50 }),
        createStockLevel({ productId: "b", productName: "Low Item", currentQuantity: 3, minimumQuantity: 10 }),
        createStockLevel({ productId: "c", productName: "Empty Item", currentQuantity: 0 }),
      ];

      const alerts = checkStockAlerts(levels);
      expect(alerts).toHaveLength(2);
      expect(alerts.find((a) => a.alertType === "low_stock")).toBeDefined();
      expect(alerts.find((a) => a.alertType === "out_of_stock")).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // applyStockSale / applyStockRefund
  // -------------------------------------------------------------------------

  describe("applyStockSale", () => {
    it("reduces quantity correctly", () => {
      const level = createStockLevel({ productId: "p1", currentQuantity: 50 });
      const saleItems: SaleItem[] = [{ productId: "p1", quantity: 5 }];

      const result = applyStockSale(level, saleItems);
      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(45);
      expect(result.adjustment.reason).toBe("sale");
    });

    it("generates alerts when reaching low stock", () => {
      const level = createStockLevel({ productId: "p1", currentQuantity: 12, minimumQuantity: 10 });
      const saleItems: SaleItem[] = [{ productId: "p1", quantity: 5 }];

      const result = applyStockSale(level, saleItems);
      expect(result.newQuantity).toBe(7);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].alertType).toBe("low_stock");
    });
  });

  describe("applyStockRefund", () => {
    it("increases quantity correctly", () => {
      const level = createStockLevel({ productId: "p1", currentQuantity: 40 });
      const refundItems: SaleItem[] = [{ productId: "p1", quantity: 5 }];

      const result = applyStockRefund(level, refundItems);
      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(45);
      expect(result.adjustment.reason).toBe("refund");
    });
  });

  // -------------------------------------------------------------------------
  // canFulfillOrder
  // -------------------------------------------------------------------------

  describe("canFulfillOrder", () => {
    it("returns true when sufficient stock", () => {
      const levels = [
        createStockLevel({ productId: "p1", currentQuantity: 50 }),
        createStockLevel({ productId: "p2", currentQuantity: 30 }),
      ];
      const items: SaleItem[] = [
        { productId: "p1", quantity: 5 },
        { productId: "p2", quantity: 10 },
      ];

      const { canFulfill, insufficientItems } = canFulfillOrder(levels, items);
      expect(canFulfill).toBe(true);
      expect(insufficientItems).toHaveLength(0);
    });

    it("returns false with insufficient items listed", () => {
      const levels = [
        createStockLevel({ productId: "p1", currentQuantity: 3 }),
      ];
      const items: SaleItem[] = [{ productId: "p1", quantity: 10 }];

      const { canFulfill, insufficientItems } = canFulfillOrder(levels, items);
      expect(canFulfill).toBe(false);
      expect(insufficientItems).toHaveLength(1);
      expect(insufficientItems[0].requested).toBe(10);
      expect(insufficientItems[0].available).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // getOutOfStockProducts / getLowStockProducts
  // -------------------------------------------------------------------------

  describe("getOutOfStockProducts", () => {
    it("filters correctly", () => {
      const levels = [
        createStockLevel({ productId: "a", currentQuantity: 50 }),
        createStockLevel({ productId: "b", currentQuantity: 0 }),
        createStockLevel({ productId: "c", currentQuantity: -1 }),
      ];

      const outOfStock = getOutOfStockProducts(levels);
      expect(outOfStock).toHaveLength(2);
      expect(outOfStock.map((l) => l.productId)).toEqual(["b", "c"]);
    });
  });

  describe("getLowStockProducts", () => {
    it("filters correctly", () => {
      const levels = [
        createStockLevel({ productId: "a", currentQuantity: 50, minimumQuantity: 10 }),
        createStockLevel({ productId: "b", currentQuantity: 5, minimumQuantity: 10 }),
        createStockLevel({ productId: "c", currentQuantity: 0, minimumQuantity: 10 }),
      ];

      const lowStock = getLowStockProducts(levels);
      expect(lowStock).toHaveLength(1);
      expect(lowStock[0].productId).toBe("b");
    });
  });

  // -------------------------------------------------------------------------
  // sortByStockUrgency
  // -------------------------------------------------------------------------

  describe("sortByStockUrgency", () => {
    it("puts out-of-stock first, then low-stock, then normal", () => {
      const levels = [
        createStockLevel({ productId: "normal", currentQuantity: 50, minimumQuantity: 10 }),
        createStockLevel({ productId: "low", currentQuantity: 5, minimumQuantity: 10 }),
        createStockLevel({ productId: "out", currentQuantity: 0, minimumQuantity: 10 }),
      ];

      const sorted = sortByStockUrgency(levels);
      expect(sorted[0].productId).toBe("out");
      expect(sorted[1].productId).toBe("low");
      expect(sorted[2].productId).toBe("normal");
    });
  });
});

// ===========================================================================
// OnlineOrderPOSService
// ===========================================================================

describe("OnlineOrderPOSService", () => {
  // -------------------------------------------------------------------------
  // convertOnlineOrderToPOS
  // -------------------------------------------------------------------------

  describe("convertOnlineOrderToPOS", () => {
    it("maps fields correctly", () => {
      const order = createOnlineOrder({
        items: [
          createOnlineOrderItem({
            productId: "prod-1",
            productName: "Burger",
            quantity: 2,
            unitPrice: 89.99,
            modifiers: [{ name: "Extra Cheese", price: 15 }],
            specialInstructions: "No onions",
          }),
        ],
        deliveryFee: 25,
        serviceFee: 10,
        discount: 5,
      });

      const pos = convertOnlineOrderToPOS(order, "POS-001");

      expect(pos.orderNumber).toBe("POS-001");
      expect(pos.channel).toBe("online_web");
      expect(pos.externalOrderId).toBe("ext-1");
      expect(pos.status).toBe("new");
      expect(pos.items).toHaveLength(1);

      const item = pos.items[0];
      expect(item.productId).toBe("prod-1");
      // unitPrice = 89.99 + 15 (modifier) = 104.99
      expect(item.unitPrice).toBe(104.99);
      // total = 104.99 * 2 = 209.98
      expect(item.total).toBe(209.98);
      expect(item.notes).toContain("Extra Cheese");
      expect(item.notes).toContain("No onions");
    });
  });

  // -------------------------------------------------------------------------
  // validateOnlineOrder
  // -------------------------------------------------------------------------

  describe("validateOnlineOrder", () => {
    it("returns valid for good order", () => {
      const order = createOnlineOrder();
      const { isValid, errors } = validateOnlineOrder(order);
      expect(isValid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it("returns errors for empty items", () => {
      const order = createOnlineOrder({ items: [], total: 0 });
      const { isValid, errors } = validateOnlineOrder(order);
      expect(isValid).toBe(false);
      expect(errors).toContain("Order must contain at least one item");
    });
  });

  // -------------------------------------------------------------------------
  // pushOrderToPOS
  // -------------------------------------------------------------------------

  describe("pushOrderToPOS", () => {
    it("succeeds for valid order", () => {
      const order = createOnlineOrder();
      const result = pushOrderToPOS(order, "POS-100");
      expect(result.success).toBe(true);
      expect(result.posOrder).not.toBeNull();
      expect(result.posOrder!.orderNumber).toBe("POS-100");
      expect(result.validationErrors).toHaveLength(0);
    });

    it("fails for invalid order", () => {
      const order = createOnlineOrder({ items: [], total: 0 });
      const result = pushOrderToPOS(order, "POS-101");
      expect(result.success).toBe(false);
      expect(result.posOrder).toBeNull();
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Status mapping
  // -------------------------------------------------------------------------

  describe("mapPOSStatusToOnlineStatus", () => {
    it("maps correctly", () => {
      expect(mapPOSStatusToOnlineStatus("new")).toBe("accepted");
      expect(mapPOSStatusToOnlineStatus("in_progress")).toBe("preparing");
      expect(mapPOSStatusToOnlineStatus("completed")).toBe("ready");
      expect(mapPOSStatusToOnlineStatus("voided")).toBe("cancelled");
    });
  });

  describe("mapOnlineStatusToPOSStatus", () => {
    it("maps correctly", () => {
      expect(mapOnlineStatusToPOSStatus("pending")).toBe("new");
      expect(mapOnlineStatusToPOSStatus("accepted")).toBe("new");
      expect(mapOnlineStatusToPOSStatus("preparing")).toBe("in_progress");
      expect(mapOnlineStatusToPOSStatus("ready")).toBe("completed");
      expect(mapOnlineStatusToPOSStatus("dispatched")).toBe("completed");
      expect(mapOnlineStatusToPOSStatus("delivered")).toBe("completed");
      expect(mapOnlineStatusToPOSStatus("cancelled")).toBe("voided");
      expect(mapOnlineStatusToPOSStatus("rejected")).toBe("voided");
    });
  });

  // -------------------------------------------------------------------------
  // syncStatusFromPOS
  // -------------------------------------------------------------------------

  describe("syncStatusFromPOS", () => {
    it("creates correct sync result", () => {
      const order = createOnlineOrder({ orderStatus: "pending" });
      const now = new Date("2024-06-01T12:00:00Z");
      const result = syncStatusFromPOS(order, "in_progress" as POSOrderStatus, now);

      expect(result.onlineOrderId).toBe("order-1");
      expect(result.previousStatus).toBe("pending");
      expect(result.newStatus).toBe("preparing");
      expect(result.syncedAt).toBe("2024-06-01T12:00:00.000Z");
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // calculateOnlineOrderTotal
  // -------------------------------------------------------------------------

  describe("calculateOnlineOrderTotal", () => {
    it("computes correctly", () => {
      const items: OnlineOrderItem[] = [
        createOnlineOrderItem({ quantity: 2, unitPrice: 50, modifiers: [{ name: "Extra", price: 10 }] }),
        createOnlineOrderItem({ id: "item-2", quantity: 1, unitPrice: 30, modifiers: [] }),
      ];

      // (50+10)*2 + 30*1 = 120 + 30 = 150, + 25 delivery + 10 service - 5 discount = 180
      const total = calculateOnlineOrderTotal(items, 25, 10, 5);
      expect(total).toBe(180);
    });
  });

  // -------------------------------------------------------------------------
  // getEstimatedPrepTime
  // -------------------------------------------------------------------------

  describe("getEstimatedPrepTime", () => {
    it("returns reasonable time (base 5 + 2 per item)", () => {
      const items = [
        createOnlineOrderItem({ quantity: 3 }),
        createOnlineOrderItem({ id: "item-2", quantity: 2 }),
      ];
      // Total items = 5, time = 5 + 5*2 = 15
      expect(getEstimatedPrepTime(items)).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // filterOrdersByChannel
  // -------------------------------------------------------------------------

  describe("filterOrdersByChannel", () => {
    it("filters correctly", () => {
      const orders = [
        createOnlineOrder({ id: "o1", channel: "online_web" }),
        createOnlineOrder({ id: "o2", channel: "online_app" }),
        createOnlineOrder({ id: "o3", channel: "online_web" }),
      ];

      const filtered = filterOrdersByChannel(orders, "online_web");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((o) => o.channel === "online_web")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // sortOrdersByPriority
  // -------------------------------------------------------------------------

  describe("sortOrdersByPriority", () => {
    it("puts pending first, oldest first within same status", () => {
      const orders = [
        createOnlineOrder({ id: "o1", orderStatus: "accepted", placedAt: "2024-06-01T10:00:00Z" }),
        createOnlineOrder({ id: "o2", orderStatus: "pending", placedAt: "2024-06-01T11:00:00Z" }),
        createOnlineOrder({ id: "o3", orderStatus: "pending", placedAt: "2024-06-01T09:00:00Z" }),
      ];

      const sorted = sortOrdersByPriority(orders);
      expect(sorted[0].id).toBe("o3"); // pending, oldest
      expect(sorted[1].id).toBe("o2"); // pending, newer
      expect(sorted[2].id).toBe("o1"); // non-pending
    });
  });
});
