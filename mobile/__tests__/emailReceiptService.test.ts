/**
 * BizPilot Mobile POS — EmailReceiptService Tests
 *
 * Tests for email receipt validation, creation, and sending.
 */

import {
  validateEmail,
  createEmailReceiptRequest,
  createEmailSyncEntry,
  sendEmailReceipt,
} from "@/services/EmailReceiptService";
import type { MobileOrder, MobileOrderItem } from "@/types";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_ORDER: MobileOrder = {
  id: "order-001",
  orderNumber: "abc123",
  customerId: "cust-001",
  status: "completed",
  subtotal: 100.0,
  taxAmount: 15.0,
  discountAmount: 0,
  total: 115.0,
  paymentMethod: "cash",
  paymentStatus: "paid",
  notes: null,
  createdBy: "user-001",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  remoteId: "order-001",
  syncedAt: Date.now(),
  isDirty: false,
};

const TEST_ITEMS: MobileOrderItem[] = [
  {
    id: "item-001",
    remoteId: "item-001",
    orderId: "order-001",
    productId: "prod-001",
    productName: "Burger",
    quantity: 2,
    unitPrice: 50.0,
    discount: 0,
    total: 100.0,
    notes: null,
    createdAt: Date.now(),
    syncedAt: Date.now(),
    isDirty: false,
  },
];

const TEST_CONFIG = {
  businessName: "Test Restaurant",
  addressLine1: "123 Main St",
  phone: "012-345-6789",
  vatNumber: "VAT123456",
};

// ---------------------------------------------------------------------------
// Tests: validateEmail
// ---------------------------------------------------------------------------

describe("validateEmail", () => {
  it("accepts valid email addresses", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("user.name@example.co.za")).toBe(true);
    expect(validateEmail("user+tag@example.com")).toBe(true);
    expect(validateEmail("user123@test.org")).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(validateEmail("")).toBe(false);
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("user@.com")).toBe(false);
    expect(validateEmail("user@example")).toBe(false);
  });

  it("trims whitespace", () => {
    expect(validateEmail("  user@example.com  ")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(validateEmail("USER@EXAMPLE.COM")).toBe(true);
  });

  it("rejects overly long addresses", () => {
    const longEmail = "a".repeat(250) + "@example.com";
    expect(validateEmail(longEmail)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: createEmailReceiptRequest
// ---------------------------------------------------------------------------

describe("createEmailReceiptRequest", () => {
  it("creates a complete email receipt request", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "guest@hotel.com",
      TEST_CONFIG
    );

    expect(request.to).toBe("guest@hotel.com");
    expect(request.orderId).toBe("order-001");
    expect(request.orderNumber).toBe("abc123");
    expect(request.textReceipt).toBeTruthy();
    expect(request.receiptData).toBeTruthy();
    expect(request.requestedAt).toBeGreaterThan(0);
  });

  it("normalizes email to lowercase", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "  GUEST@HOTEL.COM  ",
      TEST_CONFIG
    );

    expect(request.to).toBe("guest@hotel.com");
  });

  it("includes formatted receipt data", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "guest@hotel.com",
      TEST_CONFIG
    );

    expect(request.receiptData.header.businessName).toBe("Test Restaurant");
    expect(request.receiptData.items).toHaveLength(1);
    expect(request.receiptData.total).toBe(115.0);
  });

  it("includes text receipt for plain text email", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "guest@hotel.com",
      TEST_CONFIG
    );

    expect(request.textReceipt).toContain("Test Restaurant");
    expect(request.textReceipt).toContain("Burger");
  });
});

// ---------------------------------------------------------------------------
// Tests: createEmailSyncEntry
// ---------------------------------------------------------------------------

describe("createEmailSyncEntry", () => {
  it("creates a valid sync queue entry", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "guest@hotel.com",
      TEST_CONFIG
    );
    const entry = createEmailSyncEntry(request);

    expect(entry.entityType).toBe("email_receipt");
    expect(entry.entityId).toBe("order-001");
    expect(entry.action).toBe("create");
    expect(entry.attempts).toBe(0);
    expect(entry.lastError).toBeNull();
    expect(entry.processedAt).toBeNull();
  });

  it("has a unique ID", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "guest@hotel.com",
      TEST_CONFIG
    );
    const entry1 = createEmailSyncEntry(request);
    const entry2 = createEmailSyncEntry(request);

    expect(entry1.id).not.toBe(entry2.id);
  });

  it("serializes the request as payload JSON", () => {
    const request = createEmailReceiptRequest(
      TEST_ORDER,
      TEST_ITEMS,
      "guest@hotel.com",
      TEST_CONFIG
    );
    const entry = createEmailSyncEntry(request);

    const parsed = JSON.parse(entry.payload);
    expect(parsed.to).toBe("guest@hotel.com");
    expect(parsed.orderId).toBe("order-001");
  });
});

// ---------------------------------------------------------------------------
// Tests: sendEmailReceipt
// ---------------------------------------------------------------------------

describe("sendEmailReceipt", () => {
  const request = createEmailReceiptRequest(
    TEST_ORDER,
    TEST_ITEMS,
    "guest@hotel.com",
    TEST_CONFIG
  );

  it("queues when offline", async () => {
    const mockApi = { post: jest.fn() };
    const result = await sendEmailReceipt(request, mockApi, false);

    expect(result.status).toBe("queued");
    expect(result.queueEntryId).toBeTruthy();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("sends immediately when online and API succeeds", async () => {
    const mockApi = { post: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await sendEmailReceipt(request, mockApi, true);

    expect(result.status).toBe("sent");
    expect(mockApi.post).toHaveBeenCalledWith("/api/receipts/email", expect.any(Object));
  });

  it("queues on API error", async () => {
    const mockApi = { post: jest.fn().mockResolvedValue({ status: 500 }) };
    const result = await sendEmailReceipt(request, mockApi, true);

    expect(result.status).toBe("queued");
    expect(result.error).toContain("500");
  });

  it("queues on network error", async () => {
    const mockApi = {
      post: jest.fn().mockRejectedValue(new Error("Network Error")),
    };
    const result = await sendEmailReceipt(request, mockApi, true);

    expect(result.status).toBe("queued");
    expect(result.error).toContain("Network Error");
  });
});
