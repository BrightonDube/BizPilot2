/**
 * BizPilot Mobile POS — Formatting Utilities
 *
 * Pure functions for formatting currency, dates, and display values.
 * No side effects — safe to call anywhere.
 *
 * Why ZAR locale?
 * BizPilot is a South African POS product. All currency formatting
 * defaults to ZAR with the en-ZA locale for correct thousands
 * separators and decimal placement (e.g., R 1 234,56).
 */

import { CURRENCY_CODE, LOCALE } from "./constants";

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/**
 * Format a number as South African Rand.
 *
 * @param amount - The numeric value (e.g., 1234.56)
 * @returns Formatted string like "R 1 234,56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Format an epoch timestamp to a human-readable date string.
 *
 * @param epochMs - Timestamp in milliseconds since Unix epoch
 * @returns Formatted string like "15 Jun 2025, 14:30"
 */
export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

/**
 * Format an epoch timestamp to a short date (no time).
 *
 * @param epochMs - Timestamp in milliseconds since Unix epoch
 * @returns Formatted string like "15 Jun 2025"
 */
export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(epochMs));
}

/**
 * Format a relative time like "5 minutes ago".
 *
 * @param epochMs - Timestamp in milliseconds since Unix epoch
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(epochMs: number): string {
  const now = Date.now();
  const diffMs = now - epochMs;
  const diffSeconds = Math.floor(diffMs / 1_000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(epochMs);
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Format a quantity with appropriate precision.
 * Whole numbers display without decimals; fractional show 2 decimals.
 */
export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }
  return quantity.toFixed(2);
}

/**
 * Generate a local order number.
 *
 * Why timestamp + random suffix?
 * Offline devices can't coordinate auto-incrementing IDs.
 * Timestamp ensures rough ordering; random suffix avoids collisions
 * if two devices create orders in the same second.
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `POS-${timestamp}-${random}`;
}
