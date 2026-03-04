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
  ],
});
