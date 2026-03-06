/**
 * BizPilot Mobile POS — Offline Petty Cash Operations
 *
 * Provides CRUD operations for petty cash funds, expenses, and
 * categories using WatermelonDB for local persistence.
 * All writes go through the ChangeTracker so that changes are
 * automatically queued for sync when connectivity resumes.
 *
 * Why a separate offline service?
 * The existing PettyCashService.ts contains pure business-logic
 * functions (validation, calculations). This service handles the
 * data-access layer (WatermelonDB reads/writes) and keeps the two
 * concerns cleanly separated.
 */

import { database } from "@/db";
import { Q } from "@nozbe/watermelondb";
import { trackedCreate, trackedUpdate, trackedDelete } from "@/services/sync/ChangeTracker";
import type PettyCashFund from "@/db/models/PettyCashFund";
import type PettyCashExpense from "@/db/models/PettyCashExpense";
import type ExpenseCategory from "@/db/models/ExpenseCategory";

// ---------------------------------------------------------------------------
// Collections (lazy accessors)
// ---------------------------------------------------------------------------

const fundsCollection = () => database.get<PettyCashFund>("petty_cash_funds");
const expensesCollection = () => database.get<PettyCashExpense>("petty_cash_expenses");
const categoriesCollection = () => database.get<ExpenseCategory>("expense_categories");

// ---------------------------------------------------------------------------
// Fund operations
// ---------------------------------------------------------------------------

/**
 * Retrieve all petty cash funds for the current business.
 * Results are sorted by name ascending.
 */
export async function getFunds(businessId: string): Promise<PettyCashFund[]> {
  return fundsCollection()
    .query(Q.where("business_id", businessId), Q.sortBy("name", Q.asc))
    .fetch();
}

/**
 * Retrieve a single fund by its local WatermelonDB ID.
 */
export async function getFundById(id: string): Promise<PettyCashFund> {
  return fundsCollection().find(id);
}

/**
 * Retrieve a fund by its remote (server) UUID.
 * Useful after sync when we have the server ID but need the local record.
 */
export async function getFundByRemoteId(
  remoteId: string
): Promise<PettyCashFund | null> {
  const results = await fundsCollection()
    .query(Q.where("remote_id", remoteId))
    .fetch();
  return results[0] ?? null;
}

/** Create a new petty cash fund locally. */
export async function createFund(data: {
  businessId: string;
  name: string;
  initialAmount: number;
  custodianId: string;
}): Promise<PettyCashFund> {
  return trackedCreate("petty_cash_funds", fundsCollection(), (record) => {
    record.businessId = data.businessId;
    record.name = data.name;
    record.initialAmount = data.initialAmount;
    record.currentBalance = data.initialAmount;
    record.custodianId = data.custodianId;
    record.status = "active";
  });
}

/** Update a fund's mutable fields. */
export async function updateFund(
  id: string,
  data: Partial<{
    name: string;
    currentBalance: number;
    status: string;
  }>
): Promise<PettyCashFund> {
  const fund = await fundsCollection().find(id);
  return trackedUpdate("petty_cash_funds", fund, () => {
    if (data.name !== undefined) fund.name = data.name;
    if (data.currentBalance !== undefined) fund.currentBalance = data.currentBalance;
    if (data.status !== undefined) fund.status = data.status;
  });
}

// ---------------------------------------------------------------------------
// Expense operations
// ---------------------------------------------------------------------------

/** List expenses for a given fund, newest first. */
export async function getExpensesByFund(
  fundId: string
): Promise<PettyCashExpense[]> {
  return expensesCollection()
    .query(Q.where("fund_id", fundId), Q.sortBy("expense_date", Q.desc))
    .fetch();
}

/** List expenses by business + status. */
export async function getExpensesByStatus(
  businessId: string,
  status: string
): Promise<PettyCashExpense[]> {
  return expensesCollection()
    .query(
      Q.where("business_id", businessId),
      Q.where("status", status),
      Q.sortBy("expense_date", Q.desc)
    )
    .fetch();
}

/** Create a new expense request (offline-first). */
export async function createExpense(data: {
  fundId: string;
  businessId: string;
  categoryId: string;
  requestedById: string;
  amount: number;
  description: string;
  vendor?: string;
  receiptNumber?: string;
  receiptImageUrl?: string;
  expenseDate: number;
}): Promise<PettyCashExpense> {
  return trackedCreate("petty_cash_expenses", expensesCollection(), (record) => {
    record.fundId = data.fundId;
    record.businessId = data.businessId;
    record.categoryId = data.categoryId;
    record.requestedById = data.requestedById;
    record.amount = data.amount;
    record.description = data.description;
    record.vendor = data.vendor ?? null;
    record.receiptNumber = data.receiptNumber ?? null;
    record.receiptImageUrl = data.receiptImageUrl ?? null;
    record.expenseDate = data.expenseDate;
    record.status = "pending";
  });
}

/** Attach or update receipt data on an existing expense. */
export async function attachReceipt(
  expenseId: string,
  receiptNumber: string,
  receiptImageUrl: string
): Promise<PettyCashExpense> {
  const expense = await expensesCollection().find(expenseId);
  return trackedUpdate("petty_cash_expenses", expense, () => {
    expense.receiptNumber = receiptNumber;
    expense.receiptImageUrl = receiptImageUrl;
  });
}

/** Update expense status (e.g. approved, rejected). */
export async function updateExpenseStatus(
  expenseId: string,
  status: string,
  opts?: { approvedById?: string; rejectionReason?: string }
): Promise<PettyCashExpense> {
  const expense = await expensesCollection().find(expenseId);
  return trackedUpdate("petty_cash_expenses", expense, () => {
    expense.status = status;
    if (opts?.approvedById) expense.approvedById = opts.approvedById;
    if (opts?.rejectionReason) expense.rejectionReason = opts.rejectionReason;
  });
}

// ---------------------------------------------------------------------------
// Category operations
// ---------------------------------------------------------------------------

/** List active expense categories for a business. */
export async function getCategories(
  businessId: string
): Promise<ExpenseCategory[]> {
  return categoriesCollection()
    .query(
      Q.where("business_id", businessId),
      Q.where("is_active", true),
      Q.sortBy("name", Q.asc)
    )
    .fetch();
}

/** Upsert a category (used during sync pull). */
export async function upsertCategory(data: {
  remoteId: string;
  businessId: string;
  name: string;
  description?: string;
  glAccountCode?: string;
  isActive: boolean;
}): Promise<ExpenseCategory> {
  const existing = await categoriesCollection()
    .query(Q.where("remote_id", data.remoteId))
    .fetch();

  if (existing.length > 0) {
    const cat = existing[0];
    return trackedUpdate("expense_categories", cat, () => {
      cat.name = data.name;
      cat.description = data.description ?? null;
      cat.glAccountCode = data.glAccountCode ?? null;
      cat.isActive = data.isActive;
    });
  }

  return trackedCreate("expense_categories", categoriesCollection(), (record) => {
    record.remoteId = data.remoteId;
    record.businessId = data.businessId;
    record.name = data.name;
    record.description = data.description ?? null;
    record.glAccountCode = data.glAccountCode ?? null;
    record.isActive = data.isActive;
  });
}

// ---------------------------------------------------------------------------
// Conflict resolution helper
//
// Why server-wins for petty cash?
// Financial data must be authoritative from the server. If two users
// edit the same fund's balance offline, the server reconciliation is
// the source of truth. Local changes are re-applied only if the
// server hasn't superseded them.
// ---------------------------------------------------------------------------

/** Apply server data to a local fund record (server-wins strategy). */
export async function applyServerFund(
  remoteId: string,
  data: {
    businessId: string;
    name: string;
    initialAmount: number;
    currentBalance: number;
    custodianId: string;
    status: string;
    syncedAt: number;
  }
): Promise<PettyCashFund> {
  const existing = await getFundByRemoteId(remoteId);

  if (existing) {
    return trackedUpdate("petty_cash_funds", existing, () => {
      existing.name = data.name;
      existing.initialAmount = data.initialAmount;
      existing.currentBalance = data.currentBalance;
      existing.custodianId = data.custodianId;
      existing.status = data.status;
      existing.syncedAt = data.syncedAt;
      (existing as any).isDirty = false;
    });
  }

  return trackedCreate("petty_cash_funds", fundsCollection(), (record) => {
    record.remoteId = remoteId;
    record.businessId = data.businessId;
    record.name = data.name;
    record.initialAmount = data.initialAmount;
    record.currentBalance = data.currentBalance;
    record.custodianId = data.custodianId;
    record.status = data.status;
    record.syncedAt = data.syncedAt;
    (record as any).isDirty = false;
  });
}
