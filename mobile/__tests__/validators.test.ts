/**
 * BizPilot Mobile POS — Validator Tests
 *
 * Tests all input validation functions.
 * These are critical for POS security — bad input must be rejected.
 */

import {
  validateEmail,
  validatePassword,
  validatePin,
  validateQuantity,
  validateAmount,
  validateRequired,
} from "@/utils/validators";

describe("validateEmail", () => {
  it("returns null for a valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateEmail("")).toBe("Email is required");
  });

  it("rejects whitespace-only string", () => {
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("rejects missing @", () => {
    expect(validateEmail("userexample.com")).toBe("Invalid email address");
  });

  it("rejects missing domain", () => {
    expect(validateEmail("user@")).toBe("Invalid email address");
  });

  it("rejects missing TLD", () => {
    expect(validateEmail("user@example")).toBe("Invalid email address");
  });
});

describe("validatePassword", () => {
  it("returns null for valid password (8+ chars)", () => {
    expect(validatePassword("securepassword")).toBeNull();
  });

  it("rejects empty password", () => {
    expect(validatePassword("")).toBe("Password is required");
  });

  it("rejects short password (< 8 chars)", () => {
    expect(validatePassword("short")).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("accepts exactly 8 characters", () => {
    expect(validatePassword("12345678")).toBeNull();
  });
});

describe("validatePin", () => {
  it("returns null for a valid 4-digit PIN", () => {
    expect(validatePin("1234")).toBeNull();
  });

  it("rejects empty PIN", () => {
    expect(validatePin("")).toBe("PIN is required");
  });

  it("rejects PIN with wrong length", () => {
    expect(validatePin("123")).toBe("PIN must be 4 digits");
  });

  it("rejects non-numeric PIN", () => {
    expect(validatePin("abcd")).toBe("PIN must contain only numbers");
  });

  it("rejects mixed alphanumeric PIN", () => {
    expect(validatePin("12ab")).toBe("PIN must contain only numbers");
  });
});

describe("validateQuantity", () => {
  it("returns null for positive integer", () => {
    expect(validateQuantity(5)).toBeNull();
  });

  it("returns null for positive decimal", () => {
    expect(validateQuantity(2.5)).toBeNull();
  });

  it("rejects zero", () => {
    expect(validateQuantity(0)).toBe("Quantity must be greater than zero");
  });

  it("rejects negative number", () => {
    expect(validateQuantity(-1)).toBe("Quantity must be greater than zero");
  });

  it("rejects Infinity", () => {
    expect(validateQuantity(Infinity)).toBe("Invalid quantity");
  });

  it("rejects NaN", () => {
    expect(validateQuantity(NaN)).toBe("Invalid quantity");
  });
});

describe("validateAmount", () => {
  it("returns null for valid amount", () => {
    expect(validateAmount(99.99)).toBeNull();
  });

  it("accepts zero", () => {
    expect(validateAmount(0)).toBeNull();
  });

  it("rejects negative amount", () => {
    expect(validateAmount(-10)).toBe("Amount cannot be negative");
  });

  it("rejects Infinity", () => {
    expect(validateAmount(Infinity)).toBe("Invalid amount");
  });

  it("rejects more than 2 decimal places", () => {
    expect(validateAmount(10.123)).toBe(
      "Amount cannot have more than 2 decimal places"
    );
  });
});

describe("validateRequired", () => {
  it("returns null for non-empty string", () => {
    expect(validateRequired("hello", "Name")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateRequired("", "Name")).toBe("Name is required");
  });

  it("rejects whitespace-only string", () => {
    expect(validateRequired("   ", "Name")).toBe("Name is required");
  });
});
