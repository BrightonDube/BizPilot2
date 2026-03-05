jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light", Medium: "medium" } }));
jest.mock("@/utils/formatters", () => ({ formatCurrency: (v: number) => `R ${v.toFixed(2)}` }));

import {
  round2,
  calculateAvailableBalance,
  canApproveRequest,
  requiresApproval,
  validateExpenseRequest,
  applyDisbursement,
  applyReceipt,
  calculateReconciliationVariance,
  getDailySpending,
  checkDailyLimit,
  filterRequestsByStatus,
  getPendingApprovals,
  calculateFundUtilization,
  sortRequestsByUrgency,
  formatRequestNumber,
  PettyCashFund,
  ExpenseCategory,
  ExpenseRequest,
  ExpenseApproval,
} from '../services/petty-cash/PettyCashService';

// ---------------------------------------------------------------------------
// Helpers — reusable fixtures
// ---------------------------------------------------------------------------

const makeFund = (overrides: Partial<PettyCashFund> = {}): PettyCashFund => ({
  id: 'fund-1',
  name: 'Main Fund',
  businessId: 'biz-1',
  initialBalance: 10000,
  currentBalance: 5000,
  availableBalance: 4000,
  reservedAmount: 1000,
  singleExpenseLimit: 500,
  dailyExpenseLimit: 2000,
  status: 'active',
  custodianId: 'user-1',
  custodianName: 'John',
  lastReconciledAt: null,
  ...overrides,
});

const makeRequest = (overrides: Partial<ExpenseRequest> = {}): ExpenseRequest => ({
  id: 'req-1',
  fundId: 'fund-1',
  categoryId: 'cat-1',
  categoryName: 'Office Supplies',
  requestedBy: 'user-2',
  requestedByName: 'Jane',
  description: 'Printer paper',
  justification: 'Ran out of A4',
  requestedAmount: 200,
  approvedAmount: null,
  status: 'submitted',
  createdAt: '2024-06-15T10:00:00Z',
  updatedAt: '2024-06-15T10:00:00Z',
  ...overrides,
});

const makeCategory = (overrides: Partial<ExpenseCategory> = {}): ExpenseCategory => ({
  id: 'cat-1',
  name: 'Office Supplies',
  accountCode: '6100',
  spendingLimit: 1000,
  approvalRequiredAbove: 200,
  isActive: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PettyCashService', () => {
  // -- calculateAvailableBalance ------------------------------------------

  describe('calculateAvailableBalance', () => {
    it('returns currentBalance minus reservedAmount', () => {
      const fund = makeFund({ currentBalance: 5000, reservedAmount: 1000 });
      expect(calculateAvailableBalance(fund)).toBe(4000);
    });

    it('returns zero when reservedAmount equals currentBalance', () => {
      const fund = makeFund({ currentBalance: 3000, reservedAmount: 3000 });
      expect(calculateAvailableBalance(fund)).toBe(0);
    });
  });

  // -- canApproveRequest --------------------------------------------------

  describe('canApproveRequest', () => {
    it('approves a valid request within limits', () => {
      const fund = makeFund();
      const req = makeRequest({ requestedAmount: 300 });
      const result = canApproveRequest(req, fund);
      expect(result.canApprove).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('rejects when fund is frozen', () => {
      const fund = makeFund({ status: 'frozen' });
      const req = makeRequest({ requestedAmount: 100 });
      const result = canApproveRequest(req, fund);
      expect(result.canApprove).toBe(false);
      expect(result.reason).toContain('frozen');
    });

    it('rejects when amount exceeds single expense limit', () => {
      const fund = makeFund({ singleExpenseLimit: 500 });
      const req = makeRequest({ requestedAmount: 600 });
      const result = canApproveRequest(req, fund);
      expect(result.canApprove).toBe(false);
      expect(result.reason).toContain('single-expense limit');
    });

    it('rejects when amount exceeds available balance', () => {
      const fund = makeFund({ currentBalance: 300, reservedAmount: 0, singleExpenseLimit: 5000 });
      const req = makeRequest({ requestedAmount: 400 });
      const result = canApproveRequest(req, fund);
      expect(result.canApprove).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });
  });

  // -- requiresApproval ---------------------------------------------------

  describe('requiresApproval', () => {
    it('returns true when amount exceeds threshold', () => {
      const cat = makeCategory({ approvalRequiredAbove: 200 });
      expect(requiresApproval(250, cat)).toBe(true);
    });

    it('returns false when category has no threshold', () => {
      const cat = makeCategory({ approvalRequiredAbove: null });
      expect(requiresApproval(9999, cat)).toBe(false);
    });
  });

  // -- validateExpenseRequest ---------------------------------------------

  describe('validateExpenseRequest', () => {
    it('passes for a valid request', () => {
      const fund = makeFund();
      const categories = [makeCategory()];
      const result = validateExpenseRequest(
        { amount: 100, description: 'Pens', categoryId: 'cat-1' },
        fund,
        categories,
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for zero amount', () => {
      const fund = makeFund();
      const categories = [makeCategory()];
      const result = validateExpenseRequest(
        { amount: 0, description: 'Pens', categoryId: 'cat-1' },
        fund,
        categories,
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than zero');
    });

    it('returns error for empty description', () => {
      const fund = makeFund();
      const categories = [makeCategory()];
      const result = validateExpenseRequest(
        { amount: 100, description: '   ', categoryId: 'cat-1' },
        fund,
        categories,
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('returns error for inactive category', () => {
      const fund = makeFund();
      const categories = [makeCategory({ isActive: false })];
      const result = validateExpenseRequest(
        { amount: 50, description: 'Tape', categoryId: 'cat-1' },
        fund,
        categories,
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('no longer active'))).toBe(true);
    });
  });

  // -- applyDisbursement --------------------------------------------------

  describe('applyDisbursement', () => {
    it('decreases currentBalance and reservedAmount', () => {
      const fund = makeFund({ currentBalance: 5000, reservedAmount: 1000 });
      const updated = applyDisbursement(fund, 300);
      expect(updated.currentBalance).toBe(4700);
      expect(updated.reservedAmount).toBe(700);
      expect(updated.availableBalance).toBe(4000);
    });
  });

  // -- applyReceipt -------------------------------------------------------

  describe('applyReceipt', () => {
    it('increases balance when receipt is less than disbursed amount', () => {
      const fund = makeFund({ currentBalance: 4700, reservedAmount: 700 });
      const updated = applyReceipt(fund, 280, 300);
      expect(updated.currentBalance).toBe(4720);
    });

    it('decreases balance on overspend', () => {
      const fund = makeFund({ currentBalance: 4700, reservedAmount: 700 });
      const updated = applyReceipt(fund, 320, 300);
      expect(updated.currentBalance).toBe(4680);
    });
  });

  // -- calculateReconciliationVariance ------------------------------------

  describe('calculateReconciliationVariance', () => {
    it('reports balanced when amounts match within tolerance', () => {
      const result = calculateReconciliationVariance(5000, 5000);
      expect(result.isBalanced).toBe(true);
      expect(result.status).toBe('balanced');
      expect(result.variance).toBe(0);
    });

    it('detects a positive variance (shortage)', () => {
      const result = calculateReconciliationVariance(5000, 4900);
      expect(result.isBalanced).toBe(false);
      expect(result.status).toBe('variance_found');
      expect(result.variance).toBe(100);
    });
  });

  // -- getDailySpending & checkDailyLimit ---------------------------------

  describe('getDailySpending', () => {
    it('sums only approved/disbursed/completed requests for the date', () => {
      const requests = [
        makeRequest({ status: 'approved', requestedAmount: 100, approvedAmount: 100, createdAt: '2024-06-15T08:00:00Z' }),
        makeRequest({ id: 'req-2', status: 'rejected', requestedAmount: 500, createdAt: '2024-06-15T09:00:00Z' }),
        makeRequest({ id: 'req-3', status: 'disbursed', requestedAmount: 200, approvedAmount: 200, createdAt: '2024-06-15T11:00:00Z' }),
      ];
      const summary = getDailySpending(requests, '2024-06-15', 2000);
      expect(summary.totalSpent).toBe(300);
      expect(summary.transactionCount).toBe(2);
      expect(summary.remainingDailyLimit).toBe(1700);
    });

    it('returns zero for empty request list', () => {
      const summary = getDailySpending([], '2024-06-15', 2000);
      expect(summary.totalSpent).toBe(0);
      expect(summary.transactionCount).toBe(0);
    });
  });

  describe('checkDailyLimit', () => {
    it('returns within limit when spending is under cap', () => {
      const fund = makeFund({ dailyExpenseLimit: 2000 });
      const requests = [
        makeRequest({ status: 'approved', requestedAmount: 500, approvedAmount: 500, createdAt: '2024-06-15T08:00:00Z' }),
      ];
      const result = checkDailyLimit(fund, requests, 300, '2024-06-15');
      expect(result.withinLimit).toBe(true);
      expect(result.remaining).toBe(1200);
    });

    it('returns over limit when new amount breaches daily cap', () => {
      const fund = makeFund({ dailyExpenseLimit: 1000 });
      const requests = [
        makeRequest({ status: 'approved', requestedAmount: 800, approvedAmount: 800, createdAt: '2024-06-15T08:00:00Z' }),
      ];
      const result = checkDailyLimit(fund, requests, 300, '2024-06-15');
      expect(result.withinLimit).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  // -- filterRequestsByStatus ---------------------------------------------

  describe('filterRequestsByStatus', () => {
    it('returns only requests matching given statuses', () => {
      const requests = [
        makeRequest({ id: 'r1', status: 'submitted' }),
        makeRequest({ id: 'r2', status: 'approved' }),
        makeRequest({ id: 'r3', status: 'rejected' }),
      ];
      const filtered = filterRequestsByStatus(requests, ['submitted', 'approved']);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.id)).toEqual(['r1', 'r2']);
    });
  });

  // -- calculateFundUtilization -------------------------------------------

  describe('calculateFundUtilization', () => {
    it('returns healthy when balance is above 80%', () => {
      const fund = makeFund({ initialBalance: 10000, currentBalance: 9000 });
      const result = calculateFundUtilization(fund);
      expect(result.status).toBe('healthy');
      expect(result.utilized).toBe(1000);
    });

    it('returns critical when balance is below 50%', () => {
      const fund = makeFund({ initialBalance: 10000, currentBalance: 3000 });
      const result = calculateFundUtilization(fund);
      expect(result.status).toBe('critical');
    });

    it('returns critical for zero initial balance', () => {
      const fund = makeFund({ initialBalance: 0, currentBalance: 0 });
      const result = calculateFundUtilization(fund);
      expect(result.status).toBe('critical');
      expect(result.percentage).toBe(0);
    });
  });

  // -- sortRequestsByUrgency ----------------------------------------------

  describe('sortRequestsByUrgency', () => {
    it('puts pending_approval first, then submitted, then rest', () => {
      const requests = [
        makeRequest({ id: 'r1', status: 'completed', createdAt: '2024-06-15T12:00:00Z' }),
        makeRequest({ id: 'r2', status: 'submitted', createdAt: '2024-06-15T11:00:00Z' }),
        makeRequest({ id: 'r3', status: 'pending_approval', createdAt: '2024-06-15T10:00:00Z' }),
      ];
      const sorted = sortRequestsByUrgency(requests);
      expect(sorted.map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
    });
  });

  // -- formatRequestNumber ------------------------------------------------

  describe('formatRequestNumber', () => {
    it('formats with date and zero-padded index', () => {
      expect(formatRequestNumber(1, '2024-06-15')).toBe('PC-20240615-0001');
    });

    it('handles large index values', () => {
      expect(formatRequestNumber(12345, '2024-01-01')).toBe('PC-20240101-12345');
    });
  });
});
