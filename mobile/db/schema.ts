/**
 * BizPilot Mobile POS — WatermelonDB Schema Definition
 *
 * Defines the local SQLite schema for offline-first data storage.
 * Every table that needs to sync with the server includes:
 *   - remote_id: the server's UUID for this record
 *   - synced_at: when this record was last successfully synced
 *   - is_dirty: true if the record has local changes not yet pushed
 *
 * Why WatermelonDB?
 * It's the highest-performance offline-first database for React Native.
 * Unlike AsyncStorage or MMKV, it supports proper SQL queries,
 * relational data, lazy loading, and reactive queries that
 * automatically re-render components when data changes.
 * Critical for a POS handling 10,000+ products.
 */

import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 4,
  tables: [
    // -----------------------------------------------------------------
    // Products — the core catalog shown in the POS grid
    // -----------------------------------------------------------------
    tableSchema({
      name: "products",
      columns: [
        { name: "remote_id", type: "string", isIndexed: true },
        { name: "name", type: "string" },
        { name: "sku", type: "string", isOptional: true, isIndexed: true },
        { name: "barcode", type: "string", isOptional: true, isIndexed: true },
        { name: "description", type: "string", isOptional: true },
        { name: "price", type: "number" },
        { name: "cost_price", type: "number", isOptional: true },
        { name: "category_id", type: "string", isIndexed: true },
        { name: "image_url", type: "string", isOptional: true },
        { name: "is_active", type: "boolean" },
        { name: "track_inventory", type: "boolean" },
        { name: "stock_quantity", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
        { name: "is_dirty", type: "boolean" },
      ],
    }),

    // -----------------------------------------------------------------
    // Categories — product groupings shown as filter tabs
    // -----------------------------------------------------------------
    tableSchema({
      name: "categories",
      columns: [
        { name: "remote_id", type: "string", isIndexed: true },
        { name: "name", type: "string" },
        { name: "color", type: "string", isOptional: true },
        { name: "icon", type: "string", isOptional: true },
        { name: "parent_id", type: "string", isOptional: true },
        { name: "sort_order", type: "number" },
        { name: "is_active", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
        { name: "is_dirty", type: "boolean" },
      ],
    }),

    // -----------------------------------------------------------------
    // Orders — completed and in-progress sales transactions
    // -----------------------------------------------------------------
    tableSchema({
      name: "orders",
      columns: [
        {
          name: "remote_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "order_number", type: "string", isIndexed: true },
        {
          name: "customer_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "status", type: "string", isIndexed: true },
        { name: "subtotal", type: "number" },
        { name: "tax_amount", type: "number" },
        { name: "discount_amount", type: "number" },
        { name: "total", type: "number" },
        { name: "payment_method", type: "string", isOptional: true },
        { name: "payment_status", type: "string" },
        { name: "notes", type: "string", isOptional: true },
        { name: "created_by", type: "string" },
        { name: "created_at", type: "number", isIndexed: true },
        { name: "updated_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
        { name: "is_dirty", type: "boolean" },
      ],
    }),

    // -----------------------------------------------------------------
    // Order Items — line items within an order
    // -----------------------------------------------------------------
    tableSchema({
      name: "order_items",
      columns: [
        { name: "remote_id", type: "string", isOptional: true },
        { name: "order_id", type: "string", isIndexed: true },
        { name: "product_id", type: "string", isIndexed: true },
        { name: "product_name", type: "string" },
        { name: "quantity", type: "number" },
        { name: "unit_price", type: "number" },
        { name: "discount", type: "number" },
        { name: "total", type: "number" },
        { name: "notes", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
        { name: "is_dirty", type: "boolean" },
      ],
    }),

    // -----------------------------------------------------------------
    // Customers — walk-in and loyalty customers
    // -----------------------------------------------------------------
    tableSchema({
      name: "customers",
      columns: [
        { name: "remote_id", type: "string", isIndexed: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "email", type: "string", isOptional: true, isIndexed: true },
        { name: "phone", type: "string", isOptional: true },
        { name: "address", type: "string", isOptional: true },
        { name: "notes", type: "string", isOptional: true },
        { name: "loyalty_points", type: "number" },
        { name: "total_spent", type: "number" },
        { name: "visit_count", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
        { name: "is_dirty", type: "boolean" },
      ],
    }),

    // -----------------------------------------------------------------
    // Users — POS operators (cashiers, managers)
    // -----------------------------------------------------------------
    tableSchema({
      name: "users",
      columns: [
        { name: "remote_id", type: "string", isIndexed: true },
        { name: "email", type: "string", isIndexed: true },
        { name: "first_name", type: "string" },
        { name: "last_name", type: "string" },
        { name: "pin_hash", type: "string", isOptional: true },
        { name: "role", type: "string" },
        { name: "is_active", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
      ],
    }),

    // -----------------------------------------------------------------
    // Sync Queue — offline changes waiting to be pushed to server
    //
    // Why a dedicated sync queue table?
    // Instead of scanning every table for is_dirty=true (slow for
    // 10k+ products), we maintain an explicit queue of changes.
    // This makes push operations O(queue size) not O(total records).
    // -----------------------------------------------------------------
    tableSchema({
      name: "sync_queue",
      columns: [
        { name: "entity_type", type: "string", isIndexed: true },
        { name: "entity_id", type: "string", isIndexed: true },
        { name: "action", type: "string" },
        { name: "payload", type: "string" },
        { name: "attempts", type: "number" },
        { name: "last_error", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "processed_at", type: "number", isOptional: true },
      ],
    }),

    // -----------------------------------------------------------------
    // Settings — local key-value configuration store
    //
    // Why a DB table instead of AsyncStorage?
    // WatermelonDB queries are reactive — components that observe
    // a setting re-render automatically when it changes. AsyncStorage
    // requires manual subscription management.
    // -----------------------------------------------------------------
    tableSchema({
      name: "settings",
      columns: [
        { name: "key", type: "string", isIndexed: true },
        { name: "value", type: "string" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // -----------------------------------------------------------------
    // Association Rules — product pairing rules for Smart Cart
    //
    // Why store these in WatermelonDB instead of AsyncStorage?
    // A business with 1,000+ products could have thousands of rules.
    // WatermelonDB lets us query rules by business_id and antecedent
    // efficiently. AsyncStorage would require loading the entire
    // rule set into memory on every cart update.
    //
    // Rules are read-only on the client — generated by the server and
    // synced down. The client NEVER writes association rules.
    // -----------------------------------------------------------------
    tableSchema({
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
    // -----------------------------------------------------------------
    // suggestion_metrics — AI suggestion event log (schema version 3)
    //
    // Append-only event log for tracking suggestion shown/accepted/dismissed
    // events. Used to compute acceptance rates for the analytics dashboard.
    // Each event is a separate row for easy re-aggregation by date range.
    // -----------------------------------------------------------------
    tableSchema({
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
    // -----------------------------------------------------------------
    // bulk_operations — locally queued bulk operation jobs (schema version 4)
    //
    // Why local storage for bulk operations?
    // Staff may set up a bulk price change while offline (e.g. in a warehouse
    // with no Wi-Fi). The operation is queued locally and submitted when the
    // device reconnects. Progress is updated via server-sent events or polling.
    // -----------------------------------------------------------------
    tableSchema({
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
});
