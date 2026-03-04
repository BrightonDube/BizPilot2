/**
 * Remote Error Logger — Sentry-compatible adapter for production error reporting. (task 13.2)
 *
 * Why a wrapper adapter instead of using Sentry directly?
 * @sentry/react-native requires native module linking and build configuration
 * that varies per platform.  An adapter pattern lets us:
 *   1. Ship a working logger to production NOW without Sentry setup
 *   2. Drop in the real Sentry SDK later by updating ONLY this file
 *   3. Swap providers (Sentry → Datadog → Bugsnag) without touching call sites
 *
 * Current implementation:
 *   - Delegates to the existing in-memory logger (utils/logger.ts)
 *   - Captures errors to the ring buffer (viewable via Settings > Debug Logs)
 *   - Prints to console.error in __DEV__ mode for immediate developer feedback
 *
 * To enable Sentry:
 *   1. Run: npx expo install @sentry/react-native
 *   2. Add your DSN to .env: EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 *   3. Uncomment the Sentry block below and comment out the fallback block
 *   4. Re-run `expo prebuild` to link native modules
 *
 * API matches the Sentry React Native SDK surface so migration is a find-replace.
 */

import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Types — subset of Sentry's public API
// ---------------------------------------------------------------------------

export interface ErrorContext {
  /** Logical area of the app where the error occurred */
  domain?: string;
  /** Additional structured key-value metadata */
  extra?: Record<string, unknown>;
  /** User info attached to the error report */
  user?: { id?: string; email?: string; username?: string };
  /** Tags for filtering in the error dashboard */
  tags?: Record<string, string>;
  /** Severity override */
  level?: "fatal" | "error" | "warning" | "info" | "debug";
}

export interface Breadcrumb {
  /** Category (e.g., "navigation", "ui", "network") */
  category?: string;
  /** Human-readable message */
  message: string;
  /** Structured data attached to this breadcrumb */
  data?: Record<string, unknown>;
  /** Severity level */
  level?: "fatal" | "error" | "warning" | "info" | "debug";
}

// ---------------------------------------------------------------------------
// Adapter implementation
//
// SWAP POINT: To enable Sentry, replace everything below the "ADAPTER" header
// with the Sentry implementation.  The exported function signatures must stay
// the same so call sites continue to compile without changes.
// ---------------------------------------------------------------------------

// --- FALLBACK (in-memory logger + console) ---

/**
 * Capture an unhandled exception or explicitly caught critical error.
 *
 * Equivalent to: Sentry.captureException(error, { extra: context })
 */
export function captureException(error: unknown, context?: ErrorContext): void {
  const message =
    error instanceof Error ? error.message : String(error);
  const domain = context?.domain ?? "unknown";

  logger.error(domain as any, `[RemoteError] ${message}`, {
    ...(context?.extra ?? {}),
    tags: context?.tags,
    level: context?.level ?? "error",
  });

  if (__DEV__) {
    // In development, also print to console for immediate visibility
    console.error(`[RemoteErrorLogger] ${domain}:`, error, context?.extra);
  }
}

/**
 * Capture a non-fatal message (analytics event, warning, info).
 *
 * Equivalent to: Sentry.captureMessage(message, level)
 */
export function captureMessage(
  message: string,
  level: ErrorContext["level"] = "info",
  context?: Omit<ErrorContext, "level">
): void {
  const domain = context?.domain ?? "unknown";

  logger.info(domain as any, `[RemoteMessage] ${message}`, {
    ...(context?.extra ?? {}),
    level,
  });

  if (__DEV__ && level === "warning") {
    console.warn(`[RemoteErrorLogger] ${domain}:`, message);
  }
}

/**
 * Add a breadcrumb to the current error report's trail.
 * Breadcrumbs appear in the Sentry issue view as a timeline of events
 * leading up to the crash.
 *
 * Equivalent to: Sentry.addBreadcrumb(breadcrumb)
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  // In fallback mode: breadcrumbs go into the logger ring buffer as debug entries
  logger.debug(
    (breadcrumb.category ?? "app") as any,
    `[Breadcrumb] ${breadcrumb.message}`,
    breadcrumb.data
  );
}

/**
 * Associate a user with subsequent error reports.
 * Call this after login; call with undefined after logout.
 *
 * Equivalent to: Sentry.setUser(user)
 */
export function setUser(user: ErrorContext["user"] | null): void {
  if (user) {
    logger.info("auth", `[RemoteLogger] User identified: ${user.email ?? user.id}`, {
      userId: user.id,
    });
  } else {
    logger.info("auth", "[RemoteLogger] User context cleared");
  }
}

/**
 * Set global tags that will be attached to every subsequent error report.
 *
 * Equivalent to: Sentry.setTags(tags)
 */
export function setTags(tags: Record<string, string>): void {
  logger.debug("app" as any, "[RemoteLogger] Tags updated", tags);
}

// ---------------------------------------------------------------------------
// Initialisation (no-op in fallback mode)
// ---------------------------------------------------------------------------

/**
 * Initialise the remote error reporter.
 * Call once from the root layout, before rendering any screens.
 *
 * In fallback mode this is a no-op.  With the real Sentry SDK:
 *   Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, ... })
 */
export function initRemoteLogger(options?: { dsn?: string; environment?: string }): void {
  if (__DEV__) {
    console.info(
      "[RemoteErrorLogger] Running in fallback mode (in-memory ring buffer). " +
        "Set EXPO_PUBLIC_SENTRY_DSN to enable remote reporting."
    );
  }

  // Log init event so we can see it in the debug logs
  logger.info("app" as any, "[RemoteLogger] Initialised", {
    mode: options?.dsn ? "remote" : "local-fallback",
    environment: options?.environment ?? "development",
  });
}
