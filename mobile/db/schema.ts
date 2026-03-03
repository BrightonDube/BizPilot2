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
  version: 1,
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
  ],
});
