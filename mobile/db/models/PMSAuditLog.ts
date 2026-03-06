/**
 * WatermelonDB PMS Audit Log Model
 *
 * Immutable audit trail for PMS operations. Every charge post,
 * reversal, failure, and retry is logged locally before any
 * network call. This ensures regulatory compliance (POPIA, GDPR)
 * even when the server is unreachable.
 *
 * Audit logs are append-only — records are never updated or deleted.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class PMSAuditLog extends Model {
  static table = "pms_audit_logs";

  /** Action type: charge_posted, charge_failed, charge_reversed, charge_queued, etc. */
  @text("action") action!: string;
  /** Related charge ID (null for non-charge events) */
  @text("charge_id") chargeId!: string | null;
  /** Related guest ID */
  @text("guest_id") guestId!: string | null;
  /** Operator/staff who performed the action */
  @text("operator_id") operatorId!: string;
  /** JSON-encoded details (amounts, room numbers, error messages, etc.) */
  @text("details_json") detailsJson!: string;
  @field("created_at") createdAt!: number;
  @field("synced_at") syncedAt!: number | null;
}
