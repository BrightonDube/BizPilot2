/**
 * WatermelonDB Schema Migrations
 *
 * Handles database schema evolution across app versions.
 *
 * Why explicit migrations?
 * WatermelonDB doesn't auto-migrate. If we add a column in v2,
 * users upgrading from v1 would lose all data without a migration.
 * This file ensures smooth upgrades.
 *
 * Version history:
 * - v1: Initial schema (products, categories, orders, order_items,
 *       customers, users, sync_queue, settings)
 * - v2: Added association_rules table for Smart Cart AI suggestions
 * - v7: Added petty_cash_funds, petty_cash_expenses, expense_categories,
 *       tags, tag_categories, product_tags tables for offline support
 */

import {
  schemaMigrations,
  createTable,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: "association_rules",
          columns: [
            { name: "remote_id", type: "string", isIndexed: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "antecedent_product_id", type: "string", isIndexed: true },
            { name: "consequent_product_id", type: "string" },
            { name: "confidence", type: "number" },
            { name: "support", type: "number" },
            { name: "lift", type: "number" },
            { name: "computed_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "suggestion_metrics",
          columns: [
            { name: "business_id", type: "string", isIndexed: true },
            { name: "suggested_product_id", type: "string", isOptional: true },
            { name: "trigger_product_ids", type: "string" },
            { name: "event_type", type: "string", isIndexed: true },
            { name: "confidence", type: "number" },
            { name: "occurred_at", type: "number", isIndexed: true },
            { name: "synced_at", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
          name: "bulk_operations",
          columns: [
            { name: "remote_id", type: "string", isOptional: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "operation_type", type: "string", isIndexed: true },
            { name: "status", type: "string", isIndexed: true },
            { name: "title", type: "string" },
            { name: "description", type: "string", isOptional: true },
            { name: "total_records", type: "number" },
            { name: "processed_records", type: "number" },
            { name: "successful_records", type: "number" },
            { name: "failed_records", type: "number" },
            { name: "params_json", type: "string" },
            { name: "errors_json", type: "string", isOptional: true },
            { name: "is_dirty", type: "boolean" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "started_at", type: "number", isOptional: true },
            { name: "completed_at", type: "number", isOptional: true },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
          ],
        }),
      ],
    },

    // v4 → v5: Add payments table for split payment support
    {
      toVersion: 5,
      steps: [
        createTable({
          name: "payments",
          columns: [
            { name: "remote_id", type: "string", isOptional: true },
            { name: "order_id", type: "string", isIndexed: true },
            { name: "payment_method", type: "string", isIndexed: true },
            { name: "amount", type: "number" },
            { name: "cash_tendered", type: "number", isOptional: true },
            { name: "status", type: "string", isIndexed: true },
            { name: "reference", type: "string", isOptional: true },
            { name: "processed_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
          ],
        }),
      ],
    },

    // v5 → v6: Add PMS integration tables (charges, guests, audit logs)
    {
      toVersion: 6,
      steps: [
        createTable({
          name: "pms_charges",
          columns: [
            { name: "remote_id", type: "string", isOptional: true, isIndexed: true },
            { name: "guest_id", type: "string", isIndexed: true },
            { name: "room_number", type: "string", isIndexed: true },
            { name: "guest_name", type: "string" },
            { name: "amount", type: "number" },
            { name: "description", type: "string" },
            { name: "terminal_id", type: "string" },
            { name: "operator_id", type: "string" },
            { name: "status", type: "string", isIndexed: true },
            { name: "pms_reference", type: "string", isOptional: true },
            { name: "authorization_type", type: "string", isOptional: true },
            { name: "signature_data", type: "string", isOptional: true },
            { name: "order_id", type: "string", isOptional: true, isIndexed: true },
            { name: "attempts", type: "number" },
            { name: "last_error", type: "string", isOptional: true },
            { name: "posted_at", type: "number", isOptional: true },
            { name: "created_at", type: "number", isIndexed: true },
            { name: "synced_at", type: "number", isOptional: true },
          ],
        }),
        createTable({
          name: "pms_guests",
          columns: [
            { name: "remote_id", type: "string", isIndexed: true },
            { name: "name", type: "string", isIndexed: true },
            { name: "room_number", type: "string", isIndexed: true },
            { name: "check_in_date", type: "number" },
            { name: "check_out_date", type: "number" },
            { name: "folio_number", type: "string" },
            { name: "vip_level", type: "number" },
            { name: "is_active", type: "boolean" },
            { name: "can_charge", type: "boolean" },
            { name: "daily_charge_limit", type: "number", isOptional: true },
            { name: "transaction_charge_limit", type: "number", isOptional: true },
            { name: "confirmation_number", type: "string", isOptional: true },
            { name: "fetched_at", type: "number", isIndexed: true },
          ],
        }),
        createTable({
          name: "pms_audit_logs",
          columns: [
            { name: "action", type: "string", isIndexed: true },
            { name: "charge_id", type: "string", isOptional: true, isIndexed: true },
            { name: "guest_id", type: "string", isOptional: true },
            { name: "operator_id", type: "string" },
            { name: "details_json", type: "string" },
            { name: "created_at", type: "number", isIndexed: true },
            { name: "synced_at", type: "number", isOptional: true },
          ],
        }),
      ],
    },

    // v6 → v7: Add petty cash + tags/categorization tables for offline support
    {
      toVersion: 7,
      steps: [
        createTable({
          name: "petty_cash_funds",
          columns: [
            { name: "remote_id", type: "string", isIndexed: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "name", type: "string" },
            { name: "initial_amount", type: "number" },
            { name: "current_balance", type: "number" },
            { name: "custodian_id", type: "string", isIndexed: true },
            { name: "status", type: "string", isIndexed: true },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
          ],
        }),
        createTable({
          name: "petty_cash_expenses",
          columns: [
            { name: "remote_id", type: "string", isOptional: true, isIndexed: true },
            { name: "fund_id", type: "string", isIndexed: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "category_id", type: "string", isIndexed: true },
            { name: "requested_by_id", type: "string" },
            { name: "approved_by_id", type: "string", isOptional: true },
            { name: "amount", type: "number" },
            { name: "description", type: "string" },
            { name: "vendor", type: "string", isOptional: true },
            { name: "receipt_number", type: "string", isOptional: true },
            { name: "receipt_image_url", type: "string", isOptional: true },
            { name: "expense_date", type: "number" },
            { name: "status", type: "string", isIndexed: true },
            { name: "rejection_reason", type: "string", isOptional: true },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
          ],
        }),
        createTable({
          name: "expense_categories",
          columns: [
            { name: "remote_id", type: "string", isIndexed: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "name", type: "string" },
            { name: "description", type: "string", isOptional: true },
            { name: "gl_account_code", type: "string", isOptional: true },
            { name: "is_active", type: "boolean" },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
          ],
        }),
        createTable({
          name: "tag_categories",
          columns: [
            { name: "remote_id", type: "string", isIndexed: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "name", type: "string" },
            { name: "slug", type: "string", isIndexed: true },
            { name: "description", type: "string", isOptional: true },
            { name: "color", type: "string", isOptional: true },
            { name: "icon", type: "string", isOptional: true },
            { name: "sort_order", type: "number" },
            { name: "is_active", type: "boolean" },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
          ],
        }),
        createTable({
          name: "tags",
          columns: [
            { name: "remote_id", type: "string", isIndexed: true },
            { name: "business_id", type: "string", isIndexed: true },
            { name: "category_id", type: "string", isIndexed: true },
            { name: "parent_tag_id", type: "string", isOptional: true },
            { name: "name", type: "string", isIndexed: true },
            { name: "slug", type: "string", isIndexed: true },
            { name: "description", type: "string", isOptional: true },
            { name: "color", type: "string", isOptional: true },
            { name: "hierarchy_level", type: "number" },
            { name: "hierarchy_path", type: "string", isOptional: true },
            { name: "usage_count", type: "number" },
            { name: "is_system_tag", type: "boolean" },
            { name: "is_active", type: "boolean" },
            { name: "auto_apply_rules", type: "string", isOptional: true },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
          ],
        }),
        createTable({
          name: "product_tags",
          columns: [
            { name: "remote_id", type: "string", isOptional: true, isIndexed: true },
            { name: "product_id", type: "string", isIndexed: true },
            { name: "tag_id", type: "string", isIndexed: true },
            { name: "assigned_by", type: "string" },
            { name: "assigned_at", type: "number" },
            { name: "assignment_source", type: "string" },
            { name: "synced_at", type: "number", isOptional: true },
            { name: "is_dirty", type: "boolean" },
          ],
        }),
      ],
    },
  ],
});
