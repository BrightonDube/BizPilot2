/**
 * BizPilot Mobile POS — Petty Cash Sync Adapter
 *
 * Handles push/pull synchronization for petty cash entities:
 * - petty_cash_funds
 * - petty_cash_expenses
 * - expense_categories
 *
 * Why a dedicated sync adapter?
 * Petty cash data has specific sync requirements:
 * 1. Financial data uses server-wins conflict resolution
 * 2. Expense receipts may have local images that need uploading
 * 3. Fund balances must be reconciled with server totals
 * 4. Categories are server-authoritative (admin-managed)
 */

import { database } from "@/db";
import { Q } from "@nozbe/watermelondb";
import { logger } from "@/utils/logger";
import {
  applyServerFund,
  upsertCategory,
} from "./OfflinePettyCashService";
import type PettyCashFund from "@/db/models/PettyCashFund";
import type PettyCashExpense from "@/db/models/PettyCashExpense";
import type ExpenseCategory from "@/db/models/ExpenseCategory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PettyCashSyncPayload {
  funds: ServerFundData[];
  expenses: ServerExpenseData[];
  categories: ServerCategoryData[];
}

export interface ServerFundData {
  id: string;
  business_id: string;
  name: string;
  initial_amount: number;
  current_balance: number;
  custodian_id: string;
  status: string;
  updated_at: string;
}

export interface ServerExpenseData {
  id: string;
  fund_id: string;
  business_id: string;
  category_id: string;
  requested_by_id: string;
  approved_by_id: string | null;
  amount: number;
  description: string;
  vendor: string | null;
  receipt_number: string | null;
  receipt_image_url: string | null;
  expense_date: string;
  status: string;
  rejection_reason: string | null;
  updated_at: string;
}

export interface ServerCategoryData {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  gl_account_code: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Push — collect dirty local records for server upload
// ---------------------------------------------------------------------------

/** Collect all dirty petty cash funds for push. */
export async function getDirtyFunds(): Promise<PettyCashFund[]> {
  return database
    .get<PettyCashFund>("petty_cash_funds")
    .query(Q.where("is_dirty", true))
    .fetch();
}

/** Collect all dirty expenses for push. */
export async function getDirtyExpenses(): Promise<PettyCashExpense[]> {
  return database
    .get<PettyCashExpense>("petty_cash_expenses")
    .query(Q.where("is_dirty", true))
    .fetch();
}

/** Serialize a fund record for server upload. */
export function serializeFund(fund: PettyCashFund): Record<string, unknown> {
  return {
    local_id: fund.id,
    remote_id: fund.remoteId || undefined,
    business_id: fund.businessId,
    name: fund.name,
    initial_amount: fund.initialAmount,
    current_balance: fund.currentBalance,
    custodian_id: fund.custodianId,
    status: fund.status,
  };
}

/** Serialize an expense record for server upload. */
export function serializeExpense(
  expense: PettyCashExpense
): Record<string, unknown> {
  return {
    local_id: expense.id,
    remote_id: expense.remoteId || undefined,
    fund_id: expense.fundId,
    business_id: expense.businessId,
    category_id: expense.categoryId,
    requested_by_id: expense.requestedById,
    amount: expense.amount,
    description: expense.description,
    vendor: expense.vendor,
    receipt_number: expense.receiptNumber,
    receipt_image_url: expense.receiptImageUrl,
    expense_date: new Date(expense.expenseDate).toISOString(),
    status: expense.status,
  };
}

// ---------------------------------------------------------------------------
// Pull — apply server data to local database
// ---------------------------------------------------------------------------

/**
 * Apply a batch of server changes to the local petty cash tables.
 *
 * Categories are upserted (server-authoritative).
 * Funds use server-wins conflict resolution.
 * Expenses are merged (new ones inserted, status changes applied).
 */
export async function applyServerChanges(
  payload: PettyCashSyncPayload
): Promise<{ applied: number; errors: string[] }> {
  let applied = 0;
  const errors: string[] = [];
  const now = Date.now();

  // 1. Categories first (referenced by expenses)
  for (const cat of payload.categories) {
    try {
      await upsertCategory({
        remoteId: cat.id,
        businessId: cat.business_id,
        name: cat.name,
        description: cat.description ?? undefined,
        glAccountCode: cat.gl_account_code ?? undefined,
        isActive: cat.is_active,
      });
      applied++;
    } catch (err) {
      const msg = `Failed to sync category ${cat.id}: ${err}`;
      logger.error("sync", msg);
      errors.push(msg);
    }
  }

  // 2. Funds (server-wins)
  for (const fund of payload.funds) {
    try {
      await applyServerFund(fund.id, {
        businessId: fund.business_id,
        name: fund.name,
        initialAmount: fund.initial_amount,
        currentBalance: fund.current_balance,
        custodianId: fund.custodian_id,
        status: fund.status,
        syncedAt: now,
      });
      applied++;
    } catch (err) {
      const msg = `Failed to sync fund ${fund.id}: ${err}`;
      logger.error("sync", msg);
      errors.push(msg);
    }
  }

  // 3. Expenses (insert new, update status on existing)
  for (const expense of payload.expenses) {
    try {
      await applyServerExpense(expense, now);
      applied++;
    } catch (err) {
      const msg = `Failed to sync expense ${expense.id}: ${err}`;
      logger.error("sync", msg);
      errors.push(msg);
    }
  }

  logger.info("sync", `Petty cash sync: ${applied} applied, ${errors.length} errors`);
  return { applied, errors };
}

/**
 * Apply a single server expense to the local database.
 * Server-wins: server status always overrides local status.
 */
async function applyServerExpense(
  data: ServerExpenseData,
  syncedAt: number
): Promise<void> {
  const collection = database.get<PettyCashExpense>("petty_cash_expenses");
  const existing = await collection
    .query(Q.where("remote_id", data.id))
    .fetch();

  if (existing.length > 0) {
    const record = existing[0];
    await database.write(async () => {
      await record.update((r) => {
        r.status = data.status;
        r.approvedById = data.approved_by_id;
        r.rejectionReason = data.rejection_reason;
        r.receiptImageUrl = data.receipt_image_url;
        r.syncedAt = syncedAt;
        (r as any).isDirty = false;
      });
    });
  } else {
    await database.write(async () => {
      await collection.create((r) => {
        r.remoteId = data.id;
        r.fundId = data.fund_id;
        r.businessId = data.business_id;
        r.categoryId = data.category_id;
        r.requestedById = data.requested_by_id;
        r.approvedById = data.approved_by_id;
        r.amount = data.amount;
        r.description = data.description;
        r.vendor = data.vendor;
        r.receiptNumber = data.receipt_number;
        r.receiptImageUrl = data.receipt_image_url;
        r.expenseDate = new Date(data.expense_date).getTime();
        r.status = data.status;
        r.rejectionReason = data.rejection_reason;
        r.syncedAt = syncedAt;
        (r as any).isDirty = false;
      });
    });
  }
}
