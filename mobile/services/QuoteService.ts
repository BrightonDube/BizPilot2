/**
 * Mobile Quote Service
 *
 * Handles offline draft creation of proforma quotes in WatermelonDB
 * and syncing dirty records to the backend API.
 */

import { database } from "../db";
import { apiClient } from "./api";

export interface QuoteDraftInput {
  customerId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  expiryDate?: Date;
}

export interface QuoteSyncResult {
  pushed: number;
  failed: number;
}

class QuoteService {
  /**
   * Create a draft quote in the local WatermelonDB store.
   * Marks it as dirty so it will be synced on next sync cycle.
   */
  async createDraftQuote(input: QuoteDraftInput): Promise<void> {
    await database.write(async () => {
      const quotesCollection = database.get("quotes");
      await quotesCollection.create((record: Record<string, unknown>) => {
        record["quote_number"] = `DRAFT-${Date.now()}`;
        record["customer_id"] = input.customerId ?? null;
        record["status"] = "draft";
        record["subtotal"] = input.subtotal;
        record["tax_amount"] = input.taxAmount;
        record["discount_amount"] = input.discountAmount;
        record["total"] = input.total;
        record["notes"] = input.notes ?? null;
        record["terms"] = input.terms ?? null;
        record["issue_date"] = Date.now();
        record["expiry_date"] = input.expiryDate ? input.expiryDate.getTime() : null;
        record["created_at"] = Date.now();
        record["updated_at"] = Date.now();
        record["is_dirty"] = true;
      });
    });
  }

  /**
   * Push all dirty (unsynced) quote drafts to the backend.
   * After a successful push, marks each record as not-dirty and
   * stores the server-assigned remote_id.
   */
  async syncQuotes(): Promise<QuoteSyncResult> {
    const quotesCollection = database.get("quotes");
    const dirtyQuotes = await quotesCollection
      .query()
      .fetch()
      .then((all: unknown[]) =>
        (all as Array<Record<string, unknown>>).filter((q) => q["is_dirty"] === true)
      );

    let pushed = 0;
    let failed = 0;

    for (const quote of dirtyQuotes) {
      try {
        const response = await apiClient.post("/api/v1/quotes", {
          customer_id: quote["customer_id"] ?? null,
          subtotal: quote["subtotal"],
          tax_amount: quote["tax_amount"],
          discount_amount: quote["discount_amount"],
          total: quote["total"],
          notes: quote["notes"] ?? null,
          terms: quote["terms"] ?? null,
        });

        await database.write(async () => {
          await (quote as { update: (fn: (r: Record<string, unknown>) => void) => Promise<void> }).update((r) => {
            r["remote_id"] = response.data?.id ?? null;
            r["quote_number"] = response.data?.quote_number ?? quote["quote_number"];
            r["status"] = response.data?.status ?? "draft";
            r["synced_at"] = Date.now();
            r["is_dirty"] = false;
          });
        });

        pushed++;
      } catch {
        failed++;
      }
    }

    return { pushed, failed };
  }

  /**
   * Fetch the latest quotes from the server and update the local DB.
   */
  async pullQuotes(): Promise<void> {
    try {
      const response = await apiClient.get("/api/v1/quotes?per_page=100");
      const serverQuotes: Array<Record<string, unknown>> = response.data?.items ?? [];

      await database.write(async () => {
        const quotesCollection = database.get("quotes");

        for (const serverQuote of serverQuotes) {
          const existing = await quotesCollection
            .query()
            .fetch()
            .then((all: unknown[]) =>
              (all as Array<Record<string, unknown>>).find(
                (q) => q["remote_id"] === serverQuote["id"]
              )
            );

          if (existing && !(existing["is_dirty"] as boolean)) {
            await (existing as { update: (fn: (r: Record<string, unknown>) => void) => Promise<void> }).update((r) => {
              r["status"] = serverQuote["status"];
              r["total"] = serverQuote["total"];
              r["synced_at"] = Date.now();
            });
          }
        }
      });
    } catch {
      // Network unavailable — local data remains valid
    }
  }
}

export const quoteService = new QuoteService();
