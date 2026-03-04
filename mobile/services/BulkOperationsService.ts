/**
 * BulkOperationsService — manages bulk operation creation, queuing, and sync.
 *
 * Why a dedicated service?
 * Bulk operations touch the WatermelonDB layer, the API client, and the sync
 * queue. Keeping this logic in a service class (rather than inside a screen)
 * makes it independently testable and reusable across different UI surfaces.
 *
 * Offline-first pattern:
 * 1. Staff creates a bulk operation → saved locally with status = "pending"
 * 2. If online, immediately submit to server → status = "processing"
 * 3. If offline, the operation sits in the local queue with isDirty = true
 * 4. SyncScheduler picks up dirty operations on next connectivity event
 * 5. Server sends progress updates; we poll until status = "completed" | "failed"
 */

import { Database, Q } from "@nozbe/watermelondb";
import {
  BulkOperation,
  BulkOperationType,
  BulkOperationStatus,
} from "../db/models/BulkOperation";
import { apiClient } from "./api/client";

// How often to poll for progress on active operations (milliseconds)
const PROGRESS_POLL_INTERVAL_MS = 3_000;

// Maximum number of completed operations to keep in local history
const MAX_HISTORY_ITEMS = 50;

/**
 * Parameters for creating a new bulk price update operation.
 */
export interface PriceUpdateParams {
  productIds: string[];
  adjustmentType: "percentage_increase" | "percentage_decrease" | "fixed_set";
  adjustmentValue: number;
}

/**
 * Parameters for creating a new bulk stock adjustment operation.
 */
export interface StockAdjustmentParams {
  adjustments: Array<{ productId: string; quantity: number }>;
  reason: string;
}

/**
 * Response from the server when a bulk operation is submitted.
 */
interface ServerBulkOperationResponse {
  id: string;
  status: BulkOperationStatus;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  started_at: string | null;
  completed_at: string | null;
  errors: Array<{ record_id: string; error_message: string }> | null;
}

export class BulkOperationsService {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Query helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch all bulk operations for a business, newest first.
   * Returns a WatermelonDB observable query — components should use
   * `useQuery` / `withObservables` to observe this reactively.
   */
  getOperationsQuery(businessId: string) {
    return this.db
      .get<BulkOperation>("bulk_operations")
      .query(
        Q.where("business_id", businessId),
        Q.sortBy("created_at", Q.desc)
      );
  }

  /**
   * Fetch only pending/processing operations (i.e. active jobs).
   * Used to show the "in progress" section of the UI.
   */
  getActiveOperationsQuery(businessId: string) {
    return this.db
      .get<BulkOperation>("bulk_operations")
      .query(
        Q.where("business_id", businessId),
        Q.where("status", Q.oneOf(["pending", "processing"])),
        Q.sortBy("created_at", Q.desc)
      );
  }

  /**
   * Fetch unsynced (dirty) operations that need to be submitted to the server.
   * Called by the SyncScheduler on connectivity events.
   */
  getDirtyOperations(businessId: string) {
    return this.db
      .get<BulkOperation>("bulk_operations")
      .query(
        Q.where("business_id", businessId),
        Q.where("is_dirty", true),
        Q.where("status", "pending")
      )
      .fetch();
  }

  // ---------------------------------------------------------------------------
  // Create operations
  // ---------------------------------------------------------------------------

  /**
   * Queue a bulk price update operation.
   * Saves locally first (offline-safe), then attempts immediate server submission.
   */
  async queuePriceUpdate(
    businessId: string,
    params: PriceUpdateParams
  ): Promise<BulkOperation> {
    const operation = await this.db.write(async () => {
      return this.db.get<BulkOperation>("bulk_operations").create((record) => {
        record.businessId = businessId;
        record.operationType = "price_update";
        record.status = "pending";
        record.title = `Price update — ${params.productIds.length} products`;
        record.description = `${params.adjustmentType} by ${params.adjustmentValue}`;
        record.totalRecords = params.productIds.length;
        record.processedRecords = 0;
        record.successfulRecords = 0;
        record.failedRecords = 0;
        record.paramsJson = JSON.stringify(params);
        record.errorsJson = null;
        record.isDirty = true;
        record.syncedAt = null;
        record.startedAt = null;
        record.completedAt = null;
      });
    });

    // Fire-and-forget server submission — fails gracefully if offline
    this.submitToServer(operation).catch((err) => {
      console.warn("[BulkOps] Deferred: will retry on next sync", err);
    });

    return operation;
  }

  /**
   * Queue a bulk stock adjustment operation.
   */
  async queueStockAdjustment(
    businessId: string,
    params: StockAdjustmentParams
  ): Promise<BulkOperation> {
    const operation = await this.db.write(async () => {
      return this.db.get<BulkOperation>("bulk_operations").create((record) => {
        record.businessId = businessId;
        record.operationType = "stock_adjustment";
        record.status = "pending";
        record.title = `Stock adjustment — ${params.adjustments.length} products`;
        record.description = `Reason: ${params.reason}`;
        record.totalRecords = params.adjustments.length;
        record.processedRecords = 0;
        record.successfulRecords = 0;
        record.failedRecords = 0;
        record.paramsJson = JSON.stringify(params);
        record.errorsJson = null;
        record.isDirty = true;
        record.syncedAt = null;
        record.startedAt = null;
        record.completedAt = null;
      });
    });

    this.submitToServer(operation).catch((err) => {
      console.warn("[BulkOps] Deferred: will retry on next sync", err);
    });

    return operation;
  }

  // ---------------------------------------------------------------------------
  // Server sync
  // ---------------------------------------------------------------------------

  /**
   * Submit a pending local operation to the server.
   * Updates the local record with the server's remoteId and status.
   */
  async submitToServer(operation: BulkOperation): Promise<void> {
    try {
      const params = operation.params;

      const response = await apiClient.post<ServerBulkOperationResponse>(
        "/api/v1/bulk-operations",
        {
          operation_type: operation.operationType,
          business_id: operation.businessId,
          params,
        }
      );

      await this.db.write(async () => {
        await operation.update((record) => {
          record.remoteId = response.data.id;
          record.status = response.data.status;
          record.isDirty = false;
          record.syncedAt = Date.now();
          if (response.data.started_at) {
            record.startedAt = new Date(response.data.started_at).getTime();
          }
        });
      });
    } catch (error) {
      // Network error — operation stays dirty, will retry later
      console.warn("[BulkOps] Submit failed, will retry:", error);
    }
  }

  /**
   * Poll the server for progress on a processing operation.
   * Call this in a useEffect with an interval. Returns updated status.
   */
  async pollProgress(operation: BulkOperation): Promise<BulkOperationStatus> {
    if (!operation.remoteId) return operation.status;
    if (!["pending", "processing"].includes(operation.status)) {
      return operation.status;
    }

    try {
      const response = await apiClient.get<ServerBulkOperationResponse>(
        `/api/v1/bulk-operations/${operation.remoteId}`
      );

      const data = response.data;

      await this.db.write(async () => {
        await operation.update((record) => {
          record.status = data.status;
          record.processedRecords = data.processed_records;
          record.successfulRecords = data.successful_records;
          record.failedRecords = data.failed_records;
          if (data.errors) {
            record.errorsJson = JSON.stringify(data.errors);
          }
          if (data.completed_at) {
            record.completedAt = new Date(data.completed_at).getTime();
          }
        });
      });

      return data.status;
    } catch (error) {
      console.warn("[BulkOps] Poll failed:", error);
      return operation.status;
    }
  }

  // ---------------------------------------------------------------------------
  // Manage operations
  // ---------------------------------------------------------------------------

  /**
   * Cancel a pending operation (before it has been submitted to the server).
   * Once status = "processing", cancellation must go through the server API.
   */
  async cancelOperation(operation: BulkOperation): Promise<void> {
    if (operation.status !== "pending") {
      throw new Error(
        "Only pending operations can be cancelled locally. Use the API for processing operations."
      );
    }

    await this.db.write(async () => {
      await operation.update((record) => {
        record.status = "cancelled";
      });
    });
  }

  /**
   * Prune old completed/failed/cancelled operations from the local store.
   * Keeps the most recent MAX_HISTORY_ITEMS, deletes the rest.
   * Call this during a maintenance sync cycle.
   */
  async pruneHistory(businessId: string): Promise<void> {
    const all = await this.db
      .get<BulkOperation>("bulk_operations")
      .query(
        Q.where("business_id", businessId),
        Q.where("status", Q.oneOf(["completed", "failed", "cancelled"])),
        Q.sortBy("created_at", Q.desc)
      )
      .fetch();

    if (all.length <= MAX_HISTORY_ITEMS) return;

    const toDelete = all.slice(MAX_HISTORY_ITEMS);

    await this.db.write(async () => {
      const deletions = toDelete.map((op) => op.prepareDestroyPermanently());
      await this.db.batch(...deletions);
    });
  }
}

export { PROGRESS_POLL_INTERVAL_MS };
