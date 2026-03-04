/**
 * BulkOperation — WatermelonDB model for tracking bulk operation jobs.
 *
 * Why store bulk operations locally?
 * Bulk operations (price updates, stock adjustments) can be queued offline
 * and executed when connectivity is restored. Storing them locally allows:
 * 1. Offline queuing — staff can set up a bulk price change even without internet
 * 2. Progress tracking — we can show real-time progress as the server processes
 * 3. History — staff can review past bulk operations on-device
 *
 * Lifecycle: PENDING → PROCESSING → COMPLETED | FAILED | CANCELLED
 * Only PENDING operations are eligible for sync/submission to the server.
 */

import { Model } from "@nozbe/watermelondb";
import { field, readonly, date } from "@nozbe/watermelondb/decorators";

/** All supported bulk operation types. Keep in sync with backend BulkOperationType enum. */
export type BulkOperationType =
  | "price_update"
  | "stock_adjustment"
  | "product_import"
  | "product_export"
  | "category_update"
  | "product_deactivate";

/** Operation lifecycle status. */
export type BulkOperationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export class BulkOperation extends Model {
  static table = "bulk_operations";

  /** Server-side UUID, null until first sync */
  @field("remote_id") remoteId!: string | null;

  /** Business this operation belongs to */
  @field("business_id") businessId!: string;

  /** Which type of bulk operation this is */
  @field("operation_type") operationType!: BulkOperationType;

  /** Current lifecycle status */
  @field("status") status!: BulkOperationStatus;

  /** Human-readable title shown in the progress list (e.g. "Update 45 prices") */
  @field("title") title!: string;

  /** Optional description / notes set by the user */
  @field("description") description!: string | null;

  /** Total number of records the operation will process */
  @field("total_records") totalRecords!: number;

  /** How many records have been processed so far (0–totalRecords) */
  @field("processed_records") processedRecords!: number;

  /** How many records were processed without error */
  @field("successful_records") successfulRecords!: number;

  /** How many records failed validation or processing */
  @field("failed_records") failedRecords!: number;

  /**
   * JSON-encoded operation parameters.
   * For price_update: { adjustment_type, adjustment_value, product_ids }
   * For stock_adjustment: { reason, adjustments: [{product_id, qty}] }
   * Stored as a string because WatermelonDB doesn't support JSONB natively.
   */
  @field("params_json") paramsJson!: string;

  /**
   * JSON-encoded error details for failed operations.
   * Format: [{ record_id, error_message }]
   */
  @field("errors_json") errorsJson!: string | null;

  /** True if this operation has been submitted to the server */
  @field("is_dirty") isDirty!: boolean;

  /** When the operation was submitted to the server */
  @field("synced_at") syncedAt!: number | null;

  /** When the operation was started (server-side) */
  @field("started_at") startedAt!: number | null;

  /** When the operation completed (server-side) */
  @field("completed_at") completedAt!: number | null;

  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  /** Computed progress percentage (0–100) */
  get progressPercent(): number {
    if (this.totalRecords === 0) return 0;
    return Math.round((this.processedRecords / this.totalRecords) * 100);
  }

  /** True if this operation can still be cancelled */
  get isCancellable(): boolean {
    return this.status === "pending";
  }

  /** Parsed params object. Prefer using this over paramsJson directly. */
  get params(): Record<string, unknown> {
    try {
      return JSON.parse(this.paramsJson || "{}");
    } catch {
      return {};
    }
  }

  /** Parsed errors array. Empty array if none. */
  get errors(): Array<{ record_id: string; error_message: string }> {
    try {
      return JSON.parse(this.errorsJson || "[]");
    } catch {
      return [];
    }
  }
}
