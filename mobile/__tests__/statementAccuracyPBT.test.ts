/**
 * BizPilot Mobile POS — Statement Accuracy Property-Based Tests
 *
 * Property 4 from the spec:
 * "For any statement, closing_balance SHALL equal opening_balance plus
 * charges minus payments."
 *
 * Why this property matters for a POS?
 * If statement balances don't add up, the business can't trust its
 * accounts-receivable figures — potentially sending wrong invoices,
 * under-collecting, or over-collecting from customers.
 *
 * All currency arithmetic uses `round2` to avoid floating-point drift.
 */

import fc from "fast-check";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places — the currency precision used by the POS. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A single transaction with a type and absolute amount. */
interface Transaction {
  type: "charge" | "payment";
  amount: number;
}

/** The computed statement produced by `generateStatement`. */
interface StatementResult {
  openingBalance: number;
  closingBalance: number;
  totalCharges: number;
  totalPayments: number;
  transactions: Transaction[];
}

/**
 * Given an opening balance and a list of transactions, compute the
 * closing balance, total charges and total payments.
 */
function generateStatement(
  openingBalance: number,
  transactions: Transaction[],
): StatementResult {
  let totalCharges = 0;
  let totalPayments = 0;

  for (const tx of transactions) {
    if (tx.type === "charge") {
      totalCharges = round2(totalCharges + tx.amount);
    } else {
      totalPayments = round2(totalPayments + tx.amount);
    }
  }

  const closingBalance = round2(openingBalance + totalCharges - totalPayments);

  return {
    openingBalance,
    closingBalance,
    totalCharges,
    totalPayments,
    transactions,
  };
}

/**
 * Compute a running balance after each transaction, starting from the
 * given opening balance.
 */
function calculateRunningBalance(
  openingBalance: number,
  transactions: Transaction[],
): number[] {
  const balances: number[] = [];
  let balance = openingBalance;

  for (const tx of transactions) {
    if (tx.type === "charge") {
      balance = round2(balance + tx.amount);
    } else {
      balance = round2(balance - tx.amount);
    }
    balances.push(balance);
  }

  return balances;
}

/**
 * Validate that a statement's closing balance equals
 * opening_balance + total_charges − total_payments.
 */
function validateStatementIntegrity(statement: StatementResult): boolean {
  const expected = round2(
    statement.openingBalance + statement.totalCharges - statement.totalPayments,
  );
  return statement.closingBalance === expected;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for a positive currency amount (0.01 – 100 000). */
const arbAmount = fc.double({ min: 0.01, max: 100_000, noNaN: true }).map(round2);

/** Arbitrary for an opening balance (0 – 100 000). */
const arbOpening = fc.double({ min: 0, max: 100_000, noNaN: true }).map(round2);

/** Arbitrary for a single transaction. */
const arbTransaction: fc.Arbitrary<Transaction> = fc.record({
  type: fc.constantFrom("charge" as const, "payment" as const),
  amount: arbAmount,
});

/** Arbitrary for a list of 1-50 transactions. */
const arbTransactions = fc.array(arbTransaction, { minLength: 1, maxLength: 50 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Statement Accuracy PBT", () => {
  it("1 — closing balance equals opening + charges − payments", () => {
    fc.assert(
      fc.property(arbOpening, arbTransactions, (opening, txs) => {
        const stmt = generateStatement(opening, txs);
        expect(stmt.closingBalance).toBe(
          round2(stmt.openingBalance + stmt.totalCharges - stmt.totalPayments),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("2 — last running balance equals closing balance", () => {
    fc.assert(
      fc.property(arbOpening, arbTransactions, (opening, txs) => {
        const stmt = generateStatement(opening, txs);
        const running = calculateRunningBalance(opening, txs);
        expect(running[running.length - 1]).toBe(stmt.closingBalance);
      }),
      { numRuns: 100 },
    );
  });

  it("3 — total charges + total payments equals sum of all transaction amounts", () => {
    fc.assert(
      fc.property(arbOpening, arbTransactions, (opening, txs) => {
        const stmt = generateStatement(opening, txs);
        const sumAll = round2(txs.reduce((s, tx) => s + tx.amount, 0));
        expect(round2(stmt.totalCharges + stmt.totalPayments)).toBe(sumAll);
      }),
      { numRuns: 100 },
    );
  });

  it("4 — zero transactions ⇒ closing equals opening", () => {
    fc.assert(
      fc.property(arbOpening, (opening) => {
        const stmt = generateStatement(opening, []);
        expect(stmt.closingBalance).toBe(opening);
      }),
      { numRuns: 100 },
    );
  });

  it("5 — single charge ⇒ closing equals opening + charge", () => {
    fc.assert(
      fc.property(arbOpening, arbAmount, (opening, amount) => {
        const stmt = generateStatement(opening, [{ type: "charge", amount }]);
        expect(stmt.closingBalance).toBe(round2(opening + amount));
      }),
      { numRuns: 100 },
    );
  });

  it("6 — single payment ⇒ closing equals opening − payment", () => {
    fc.assert(
      fc.property(arbOpening, arbAmount, (opening, amount) => {
        const stmt = generateStatement(opening, [{ type: "payment", amount }]);
        expect(stmt.closingBalance).toBe(round2(opening - amount));
      }),
      { numRuns: 100 },
    );
  });

  it("7 — reversibility: adding inverse transactions restores opening", () => {
    fc.assert(
      fc.property(arbOpening, arbTransactions, (opening, txs) => {
        const inverseTxs: Transaction[] = txs.map((tx) => ({
          type: tx.type === "charge" ? "payment" : "charge",
          amount: tx.amount,
        }));
        const combined = [...txs, ...inverseTxs];
        const stmt = generateStatement(opening, combined);
        expect(stmt.closingBalance).toBe(opening);
      }),
      { numRuns: 100 },
    );
  });

  it("8 — non-negative totals: charges ≥ 0 and payments ≥ 0 always", () => {
    fc.assert(
      fc.property(arbOpening, arbTransactions, (opening, txs) => {
        const stmt = generateStatement(opening, txs);
        expect(stmt.totalCharges).toBeGreaterThanOrEqual(0);
        expect(stmt.totalPayments).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it("9 — idempotent recalculation: computing twice gives same result", () => {
    fc.assert(
      fc.property(arbOpening, arbTransactions, (opening, txs) => {
        const stmt1 = generateStatement(opening, txs);
        const stmt2 = generateStatement(opening, txs);
        expect(stmt1.closingBalance).toBe(stmt2.closingBalance);
        expect(stmt1.totalCharges).toBe(stmt2.totalCharges);
        expect(stmt1.totalPayments).toBe(stmt2.totalPayments);
      }),
      { numRuns: 100 },
    );
  });

  it("10 — large volume stability: 1000 transactions, no floating-point drift", () => {
    fc.assert(
      fc.property(
        arbOpening,
        fc.array(arbTransaction, { minLength: 1000, maxLength: 1000 }),
        (opening, txs) => {
          const stmt = generateStatement(opening, txs);
          expect(validateStatementIntegrity(stmt)).toBe(true);

          const running = calculateRunningBalance(opening, txs);
          expect(running[running.length - 1]).toBe(stmt.closingBalance);
        },
      ),
      { numRuns: 100 },
    );
  });
});
