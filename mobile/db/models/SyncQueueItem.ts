/**
 * WatermelonDB SyncQueueItem Model
 *
 * Queued offline changes waiting to be pushed to the server.
 * Each entry represents one create/update/delete operation.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class SyncQueueItem extends Model {
  static table = "sync_queue";

  @text("entity_type") entityType!: string;
  @text("entity_id") entityId!: string;
  @text("action") action!: string;
  @text("payload") payload!: string;
  @field("attempts") attempts!: number;
  @text("last_error") lastError!: string | null;
  @field("created_at") createdAt!: number;
  @field("processed_at") processedAt!: number | null;
}
