/**
 * BizPilot Mobile POS — Input Validators
 *
 * Pure validation functions that return error messages or null.
 * Used by form components to validate user input before submission.
 *
 * Why pure functions instead of a validation library?
 * A POS app has simple validation needs (email, PIN, quantity).
 * Adding Yup/Zod increases bundle size for minimal benefit.
 * These pure functions are easy to test and debug.
 */

import { PIN_LENGTH } from "./constants";

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Validate an email address.
 * Uses a simple regex — not RFC 5322 compliant, but catches
 * the common typos (missing @, missing domain).
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Invalid email address";
  return null;
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

/**
 * Validate a password.
 * Minimum 8 characters — matches backend requirements.
 */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

/**
 * Validate a numeric PIN.
 * Must be exactly PIN_LENGTH digits.
 */
export function validatePin(pin: string): string | null {
  if (!pin) return "PIN is required";
  if (pin.length !== PIN_LENGTH) return `PIN must be ${PIN_LENGTH} digits`;
  if (!/^\d+$/.test(pin)) return "PIN must contain only numbers";
  return null;
}

// ---------------------------------------------------------------------------
// Quantity
// ---------------------------------------------------------------------------

/**
 * Validate a quantity value (must be positive integer or decimal).
 */
export function validateQuantity(value: number): string | null {
  if (value <= 0) return "Quantity must be greater than zero";
  if (!Number.isFinite(value)) return "Invalid quantity";
  return null;
}

// ---------------------------------------------------------------------------
// Price / Amount
// ---------------------------------------------------------------------------

/**
 * Validate a monetary amount (must be non-negative, max 2 decimal places).
 */
export function validateAmount(value: number): string | null {
  if (value < 0) return "Amount cannot be negative";
  if (!Number.isFinite(value)) return "Invalid amount";
  // Check max 2 decimal places
  const decimalPart = value.toString().split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return "Amount cannot have more than 2 decimal places";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Generic required field
// ---------------------------------------------------------------------------

/**
 * Validate that a string field is not empty.
 */
export function validateRequired(
  value: string,
  fieldName: string
): string | null {
  if (!value.trim()) return `${fieldName} is required`;
  return null;
}
