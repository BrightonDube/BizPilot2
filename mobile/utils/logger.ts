/**
 * BizPilot Mobile POS — Action Logger
 *
 * Records POS actions (sales, voids, payments, syncs) with timestamps
 * and metadata for debugging production issues.
 *
 * Why a custom logger instead of console.log?
 * 1. Structured data — every log entry has a type, timestamp, and payload
 * 2. Ring buffer — keeps the last N entries in memory, never grows unbounded
 * 3. Export capability — dump logs to clipboard/email for remote debugging
 * 4. Severity levels — filter noise when debugging a specific issue
 *
 * In a production POS, this would forward to Sentry/Datadog.
 * For now, we keep an in-memory ring buffer that can be dumped
 * from the Settings screen for customer support cases.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  | "auth"
  | "cart"
  | "order"
  | "payment"
  | "sync"
  | "inventory"
  | "navigation"
  | "system";

export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Log severity */
  level: LogLevel;
  /** Functional area */
  category: LogCategory;
  /** Human-readable message */
  message: string;
  /** Optional structured data */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum number of log entries to keep in memory */
const MAX_LOG_ENTRIES = 500;

/** Minimum level to actually store (can be raised in production) */
let minLevel: LogLevel = __DEV__ ? "debug" : "info";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Ring buffer storage
// ---------------------------------------------------------------------------

const logBuffer: LogEntry[] = [];

// ---------------------------------------------------------------------------
// Core logging function
// ---------------------------------------------------------------------------

function addEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>
): void {
  // Skip entries below the minimum level
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data,
  };

  // Add to ring buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  // Also forward to console in development
  if (__DEV__) {
    const prefix = `[${category.toUpperCase()}]`;
    switch (level) {
      case "debug":
        console.debug(prefix, message, data ?? "");
        break;
      case "info":
        console.info(prefix, message, data ?? "");
        break;
      case "warn":
        console.warn(prefix, message, data ?? "");
        break;
      case "error":
        console.error(prefix, message, data ?? "");
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const logger = {
  /** Log a debug-level message */
  debug: (category: LogCategory, message: string, data?: Record<string, unknown>) =>
    addEntry("debug", category, message, data),

  /** Log an info-level message */
  info: (category: LogCategory, message: string, data?: Record<string, unknown>) =>
    addEntry("info", category, message, data),

  /** Log a warning-level message */
  warn: (category: LogCategory, message: string, data?: Record<string, unknown>) =>
    addEntry("warn", category, message, data),

  /** Log an error-level message */
  error: (category: LogCategory, message: string, data?: Record<string, unknown>) =>
    addEntry("error", category, message, data),

  /**
   * Get all stored log entries.
   * Returns a copy to prevent external mutation of the buffer.
   */
  getEntries: (): LogEntry[] => [...logBuffer],

  /**
   * Get entries filtered by category and/or level.
   */
  getFiltered: (
    options: { category?: LogCategory; level?: LogLevel } = {}
  ): LogEntry[] => {
    return logBuffer.filter((entry) => {
      if (options.category && entry.category !== options.category) return false;
      if (
        options.level &&
        LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[options.level]
      )
        return false;
      return true;
    });
  },

  /**
   * Export logs as a JSON string for debugging.
   * Can be copied to clipboard or sent via email from Settings screen.
   */
  exportAsJson: (): string => {
    return JSON.stringify(logBuffer, null, 2);
  },

  /**
   * Export logs as a compact text format for pasting into support tickets.
   */
  exportAsText: (): string => {
    return logBuffer
      .map(
        (e) =>
          `${e.timestamp} [${e.level.toUpperCase()}] [${e.category}] ${e.message}${
            e.data ? " " + JSON.stringify(e.data) : ""
          }`
      )
      .join("\n");
  },

  /** Clear all stored entries */
  clear: (): void => {
    logBuffer.length = 0;
  },

  /** Set the minimum log level */
  setMinLevel: (level: LogLevel): void => {
    minLevel = level;
  },

  /** Get current entry count */
  getCount: (): number => logBuffer.length,
};
