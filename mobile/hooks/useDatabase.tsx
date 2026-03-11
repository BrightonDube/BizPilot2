/**
 * BizPilot Mobile POS — useDatabase Hook & Provider
 *
 * Provides the WatermelonDB database instance through React context.
 * While the database singleton can be imported directly, the provider
 * pattern is required for:
 *
 * 1. WatermelonDB's withDatabase HOC and enhanced() components
 * 2. Testing — swap in an in-memory database for unit tests
 * 3. Error handling — show a recovery screen if DB init fails
 *
 * Why Context + Hook instead of just importing `database`?
 * Direct imports couple every component to the production database.
 * With a provider, tests can inject a mock database without mocking
 * the entire module, making tests faster and more reliable.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Database } from "@nozbe/watermelondb";
import { database as defaultDatabase } from "@/db";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DatabaseContextValue {
  /** The WatermelonDB database instance */
  database: Database;
  /** True while the database is being initialized */
  isLoading: boolean;
  /** Error message if database initialization failed */
  error: string | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DatabaseProviderProps {
  children: ReactNode;
  /** Optional override for testing — inject a different database instance */
  testDatabase?: Database;
}

/**
 * Provides the WatermelonDB database to all child components.
 *
 * Wrap your app root with this provider:
 * ```tsx
 * <DatabaseProvider>
 *   <App />
 * </DatabaseProvider>
 * ```
 */
export function DatabaseProvider({
  children,
  testDatabase,
}: DatabaseProviderProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const db = testDatabase ?? defaultDatabase;

  useEffect(() => {
    // Verify the database is operational by attempting a read
    async function verifyDatabase() {
      try {
        // A lightweight query to confirm the adapter is working.
        // If the SQLite file is corrupt, this will throw.
        await db.get("settings").query().fetchCount();
        setIsLoading(false);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Database initialization failed";
        console.error("[DatabaseProvider] Init error:", message);
        setError(message);
        setIsLoading(false);
      }
    }

    verifyDatabase();
  }, [db]);

  const value = useMemo<DatabaseContextValue>(
    () => ({ database: db, isLoading, error }),
    [db, isLoading, error]
  );

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the WatermelonDB database from any component.
 *
 * Throws if called outside a DatabaseProvider.
 *
 * @returns The database instance, loading state, and any init error
 *
 * Usage:
 * ```tsx
 * const { database, isLoading, error } = useDatabase();
 * ```
 */
export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error(
      "useDatabase must be used within a <DatabaseProvider>. " +
        "Wrap your app root or test component with <DatabaseProvider>."
    );
  }

  return context;
}

export default DatabaseProvider;
