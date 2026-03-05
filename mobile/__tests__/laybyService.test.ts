import {
  calculateDeposit,
  generatePaymentSchedule,
  calculateCancellationFees,
  validateLaybyCreation,
  getLaybyProgress,
  isPaymentOverdue,
  getNextPayment,
  filterLaybysByStatus,
  searchLaybys,
  sortLaybysByDate,
  calculateOverdueAmount,
  getStatusColor,
  Layby,
  LaybyItem,
  PaymentScheduleEntry,
} from "../services/laybys/LaybyService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<LaybyItem> = {}): LaybyItem {
  return {
    id: "item-1",
    productId: "prod-1",
    productName: "Widget",
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
    ...overrides,
  };
}

function makeLayby(overrides: Partial<Layby> = {}): Layby {
  return {
    id: "layby-1",
    referenceNumber: "LB-001",
    status: "active",
    customerName: "Jane Doe",
    customerId: "cust-1",
    items: [makeItem()],
    totalAmount: 1000,
    depositAmount: 200,
    amountPaid: 400,
    balanceDue: 600,
    paymentFrequency: "monthly",
    schedule: [],
    startDate: "2025-01-01T00:00:00.000Z",
    endDate: "2025-06-01T00:00:00.000Z",
    nextPaymentDate: "2025-03-01T00:00:00.000Z",
    nextPaymentAmount: 200,
    extensionCount: 0,
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<PaymentScheduleEntry> = {}): PaymentScheduleEntry {
  return {
    dueDate: "2025-03-01T00:00:00.000Z",
    amount: 200,
    status: "pending",
    paidAmount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateDeposit", () => {
  it("returns percentage-based deposit when above minimum", () => {
    // 10% of 1000 = 100, minimum = 50
    expect(calculateDeposit(1000, 10, 50)).toBe(100);
  });

  it("enforces minimum deposit when percentage is below it", () => {
    // 1% of 1000 = 10, minimum = 50 → 50
    expect(calculateDeposit(1000, 1, 50)).toBe(50);
  });
});

describe("generatePaymentSchedule", () => {
  it("generates weekly instalments between start and end", () => {
    const schedule = generatePaymentSchedule(
      700,
      "weekly",
      "2025-01-01",
      "2025-01-29"
    );
    // 4 weekly periods fit: Jan 8, 15, 22, 29
    expect(schedule.length).toBe(4);
    expect(schedule.every((e) => e.status === "pending")).toBe(true);
    const total = schedule.reduce((s, e) => s + e.amount, 0);
    expect(total).toBeCloseTo(700, 2);
  });

  it("generates monthly instalments between start and end", () => {
    const schedule = generatePaymentSchedule(
      600,
      "monthly",
      "2025-01-01",
      "2025-04-01"
    );
    // 3 monthly periods: Feb 1, Mar 1, Apr 1
    expect(schedule.length).toBe(3);
    const total = schedule.reduce((s, e) => s + e.amount, 0);
    expect(total).toBeCloseTo(600, 2);
  });
});

describe("calculateCancellationFees", () => {
  it("returns positive refund when paid exceeds fees", () => {
    const result = calculateCancellationFees(500, 1000, 10, 50, 10, 2);
    // cancellation = max(100, 50) = 100, restocking = 20, refund = 500 - 120 = 380
    expect(result.cancellationFee).toBe(100);
    expect(result.restockingFee).toBe(20);
    expect(result.refundAmount).toBe(380);
  });

  it("returns zero refund when fees exceed amount paid", () => {
    const result = calculateCancellationFees(50, 1000, 10, 50, 10, 2);
    // cancellation = 100, restocking = 20, 50 - 120 → 0
    expect(result.refundAmount).toBe(0);
  });
});

describe("validateLaybyCreation", () => {
  it("passes for valid layby data", () => {
    const result = validateLaybyCreation([makeItem()], 100, 1000, 50);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when items list is empty", () => {
    const result = validateLaybyCreation([], 100, 1000, 50);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("At least one item is required.");
  });

  it("fails when deposit is below minimum", () => {
    const result = validateLaybyCreation([makeItem()], 10, 1000, 50);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Deposit must be at least")])
    );
  });
});

describe("getLaybyProgress", () => {
  it("returns on_track for partial payment", () => {
    const result = getLaybyProgress(300, 1000);
    expect(result.percentage).toBe(30);
    expect(result.status).toBe("on_track");
  });

  it("returns ahead when fully paid", () => {
    const result = getLaybyProgress(1000, 1000);
    expect(result.percentage).toBe(100);
    expect(result.status).toBe("ahead");
  });
});

describe("isPaymentOverdue", () => {
  const now = new Date("2025-04-01T00:00:00.000Z");

  it("returns true when unpaid entry is past due", () => {
    const schedule = [makeEntry({ dueDate: "2025-03-01T00:00:00.000Z", status: "pending" })];
    expect(isPaymentOverdue(schedule, now)).toBe(true);
  });

  it("returns false when all past entries are paid", () => {
    const schedule = [makeEntry({ dueDate: "2025-03-01T00:00:00.000Z", status: "paid" })];
    expect(isPaymentOverdue(schedule, now)).toBe(false);
  });
});

describe("getNextPayment", () => {
  it("returns the first pending entry", () => {
    const schedule = [
      makeEntry({ dueDate: "2025-02-01T00:00:00.000Z", status: "paid" }),
      makeEntry({ dueDate: "2025-03-01T00:00:00.000Z", status: "pending", amount: 150 }),
    ];
    const next = getNextPayment(schedule);
    expect(next).not.toBeNull();
    expect(next!.amount).toBe(150);
  });

  it("returns null when all entries are paid", () => {
    const schedule = [
      makeEntry({ status: "paid" }),
      makeEntry({ status: "paid" }),
    ];
    expect(getNextPayment(schedule)).toBeNull();
  });
});

describe("filterLaybysByStatus", () => {
  const laybys = [
    makeLayby({ id: "1", status: "active" }),
    makeLayby({ id: "2", status: "cancelled" }),
    makeLayby({ id: "3", status: "overdue" }),
  ];

  it("filters by a single status", () => {
    const result = filterLaybysByStatus(laybys, ["active"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by multiple statuses", () => {
    const result = filterLaybysByStatus(laybys, ["active", "overdue"]);
    expect(result).toHaveLength(2);
  });
});

describe("searchLaybys", () => {
  const laybys = [
    makeLayby({ referenceNumber: "LB-100", customerName: "Alice Smith" }),
    makeLayby({ referenceNumber: "LB-200", customerName: "Bob Jones" }),
  ];

  it("finds by reference number", () => {
    expect(searchLaybys(laybys, "LB-100")).toHaveLength(1);
  });

  it("finds by customer name (case-insensitive)", () => {
    expect(searchLaybys(laybys, "bob")).toHaveLength(1);
  });
});

describe("sortLaybysByDate", () => {
  const laybys = [
    makeLayby({ id: "a", startDate: "2025-03-01T00:00:00.000Z" }),
    makeLayby({ id: "b", startDate: "2025-01-01T00:00:00.000Z" }),
  ];

  it("sorts ascending", () => {
    const sorted = sortLaybysByDate(laybys, "startDate", "asc");
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("sorts descending", () => {
    const sorted = sortLaybysByDate(laybys, "startDate", "desc");
    expect(sorted[0].id).toBe("a");
    expect(sorted[1].id).toBe("b");
  });
});

describe("calculateOverdueAmount", () => {
  it("sums outstanding amounts on overdue entries", () => {
    const now = new Date("2025-04-01T00:00:00.000Z");
    const schedule = [
      makeEntry({ dueDate: "2025-02-01T00:00:00.000Z", amount: 200, paidAmount: 50, status: "partial" }),
      makeEntry({ dueDate: "2025-03-01T00:00:00.000Z", amount: 200, paidAmount: 0, status: "pending" }),
      makeEntry({ dueDate: "2025-05-01T00:00:00.000Z", amount: 200, paidAmount: 0, status: "pending" }),
    ];
    // overdue: (200-50) + (200-0) = 350, third entry is in the future
    expect(calculateOverdueAmount(schedule, now)).toBe(350);
  });
});

describe("getStatusColor", () => {
  it("returns green for active", () => {
    expect(getStatusColor("active")).toBe("#22c55e");
  });

  it("returns red for cancelled", () => {
    expect(getStatusColor("cancelled")).toBe("#ef4444");
  });

  it("returns yellow for overdue", () => {
    expect(getStatusColor("overdue")).toBe("#fbbf24");
  });
});
