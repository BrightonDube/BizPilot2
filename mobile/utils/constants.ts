/**
 * BizPilot Mobile POS — Application Constants
 *
 * Centralizes all magic numbers, strings, and configuration values.
 *
 * Why a constants file?
 * Scattering magic values across components makes them hard to find
 * and update. A single file means one place to change when business
 * rules evolve (e.g., VAT rate changes from 15% to 16%).
 */

// ---------------------------------------------------------------------------
// API Configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for the BizPilot API.
 * In production, this comes from environment variables.
 * Falls back to localhost for dev.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/** Request timeout in milliseconds (30 seconds) */
export const API_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for failed API requests */
export const API_MAX_RETRIES = 3;

/** Base delay between retries in milliseconds (doubles each attempt) */
export const API_RETRY_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/** SecureStore key for the JWT access token */
export const SECURE_STORE_TOKEN_KEY = "bizpilot_access_token";

/** SecureStore key for the refresh token */
export const SECURE_STORE_REFRESH_KEY = "bizpilot_refresh_token";

/** Auto-logout after this many minutes of inactivity */
export const INACTIVITY_TIMEOUT_MINUTES = 30;

/** PIN length for quick login */
export const PIN_LENGTH = 4;

// ---------------------------------------------------------------------------
// Sync Configuration
// ---------------------------------------------------------------------------

/** How many records to push/pull per sync batch */
export const SYNC_BATCH_SIZE = 50;

/** Automatic sync interval in milliseconds (5 minutes) */
export const SYNC_INTERVAL_MS = 5 * 60 * 1_000;

/** Maximum sync retry attempts before marking as failed */
export const SYNC_MAX_RETRIES = 5;

/** Base delay for sync retries (exponential backoff) */
export const SYNC_RETRY_BASE_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// POS / Business Rules
// ---------------------------------------------------------------------------

/**
 * Default VAT rate for South Africa (15%).
 * Used when the business hasn't configured a custom rate.
 */
export const DEFAULT_VAT_RATE = 0.15;

/** Currency code used throughout the app */
export const CURRENCY_CODE = "ZAR";

/** Locale for number/currency formatting */
export const LOCALE = "en-ZA";

// ---------------------------------------------------------------------------
// UI / UX
// ---------------------------------------------------------------------------

/** Minimum touch target size in dp (accessibility guideline) */
export const MIN_TOUCH_TARGET = 44;

/** Number of columns in the product grid for tablets */
export const PRODUCT_GRID_COLUMNS_TABLET = 4;

/** Number of columns in the product grid for phones */
export const PRODUCT_GRID_COLUMNS_PHONE = 2;

/** Maximum items to show before virtualizing a list */
export const VIRTUALIZATION_THRESHOLD = 20;
