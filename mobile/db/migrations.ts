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
 * Current: Version 1 (initial schema, no migrations yet).
 * When adding new columns or tables, add a migration step here
 * and bump the schema version in schema.ts.
 */

import {
  schemaMigrations,
  // addColumns,
  // createTable,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    // Future migrations go here. Example:
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({
    //       table: 'products',
    //       columns: [
    //         { name: 'tax_category', type: 'string', isOptional: true },
    //       ],
    //     }),
    //   ],
    // },
  ],
});
