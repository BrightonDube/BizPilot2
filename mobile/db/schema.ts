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
  version: 7,
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

    // -----------------------------------------------------------------
    // Payments — individual payment lines against an order
    // Supports split payments (one order may have multiple payment rows)
    // Schema version 5
    //
    // Why local payments table?
    // When processing a payment offline (e.g., cash sale with no internet),
    // we still need to record the payment locally and then sync to the server
    // when reconnected. This ensures the order is marked paid and change
    // is calculated correctly even without a server round-trip.
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // PMS Charges — room charges posted or pending posting to PMS
    // Schema version 6
    //
    // Why persist charges locally?
    // Offline charges must survive app restarts. Zustand state is
    // volatile — WatermelonDB ensures queued charges persist across
    // crashes, background kills, and device reboots.
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // PMS Guests — cached guest profiles for offline search
    //
    // Why cache guests locally?
    // When the PMS connection drops, staff still need to search for
    // guests they recently looked up. This table caches the last N
    // guest profiles for offline access. Entries are TTL-based.
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // PMS Audit Logs — immutable audit trail of PMS actions
    //
    // Why a separate audit table instead of syncing to server immediately?
    // Regulatory compliance (POPIA, GDPR) requires that every charge
    // action is logged locally BEFORE attempting the server round-trip.
    // If the network fails, we still have an unbroken local audit trail.
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // Petty Cash Funds — cash floats for daily operations
    // Schema version 7
    //
    // Why persist petty cash locally?
    // Staff managing cash floats (e.g. at a bar or kitchen) need to
    // record expenses immediately. If the network is down, the expense
    // must still be recorded and synced later.
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // Petty Cash Expenses — individual expense records against a fund
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // Expense Categories — classification for petty cash expenses
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // Tag Categories — groups for organising tags (e.g. "Dietary", "Size")
    // Schema version 7
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // Tags — individual tags within a category (e.g. "Vegan", "Gluten-Free")
    // -----------------------------------------------------------------
    tableSchema({
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

    // -----------------------------------------------------------------
    // Product Tags — many-to-many link between products and tags
    // -----------------------------------------------------------------
    tableSchema({
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
});
