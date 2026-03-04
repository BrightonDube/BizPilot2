/**
 * BizPilot Mobile POS — Database Initialization
 *
 * Creates and exports the WatermelonDB database instance.
 * This is the single source of truth for the local database.
 *
 * Why a singleton pattern?
 * WatermelonDB should only be initialized once per app lifecycle.
 * Multiple instances would cause data corruption and race conditions.
 * We export a single `database` instance used by all hooks and services.
 */

import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";

import { schema } from "./schema";
import { migrations } from "./migrations";
import {
  Product,
  Category,
  Order,
  OrderItem,
  Customer,
  User,
  SyncQueueItem,
  Setting,
  AssociationRule,
  SuggestionMetric,
  BulkOperation,
} from "./models";

/**
 * SQLite adapter — the bridge between WatermelonDB and the
 * platform's native SQLite engine (iOS: built-in, Android: SQLCipher).
 */
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Why jsi: true?
  // JSI (JavaScript Interface) provides direct C++ bridge to SQLite,
  // bypassing the slow JSON serialization of the old bridge.
  // This gives ~3x faster query performance on large datasets.
  jsi: true,
  onSetUpError: (error) => {
    // Database setup failed — this is a critical error.
    // In production, we'd report to Sentry and show a recovery screen.
    console.error("[DB] Setup error:", error);
  },
});

/**
 * The WatermelonDB database instance.
 * Import this wherever you need to perform database operations.
 */
export const database = new Database({
  adapter,
  modelClasses: [
    Product,
    Category,
    Order,
    OrderItem,
    Customer,
    User,
    SyncQueueItem,
    Setting,
    AssociationRule,
    SuggestionMetric,
    BulkOperation,
  ],
});
