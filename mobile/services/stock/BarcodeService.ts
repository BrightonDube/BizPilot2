/**
 * BarcodeService — Pure functions for barcode scanning, validation, and product lookup.
 *
 * Why pure functions: Enables deterministic testing without mocking barcode hardware.
 * The service handles barcode format detection, validation, and matching to products.
 * Every function is side-effect-free and takes all needed data as arguments.
 *
 * Barcode standards implemented:
 * - EAN-13 (International Article Number, 13 digits)
 * - EAN-8  (Compact variant, 8 digits)
 * - UPC-A  (Universal Product Code, 12 digits)
 * - UPC-E  (Compressed UPC, 8 digits starting with 0 or 1)
 * - CODE-128, CODE-39, QR (detected by pattern, no check-digit validation)
 *
 * @module BarcodeService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BarcodeProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  currentStock: number;
  category: string;
}

export interface BarcodeScanResult {
  rawValue: string;
  format: BarcodeFormat;
  isValid: boolean;
  product: BarcodeProduct | null;
  timestamp: string;
}

export type BarcodeFormat =
  | "EAN-13"
  | "EAN-8"
  | "UPC-A"
  | "UPC-E"
  | "CODE-128"
  | "CODE-39"
  | "QR"
  | "UNKNOWN";

export interface BarcodeValidationResult {
  isValid: boolean;
  format: BarcodeFormat;
  error?: string;
}

export interface ScanHistorySummary {
  totalScans: number;
  uniqueProducts: number;
  unrecognized: number;
  recentScans: BarcodeScanResult[];
}

// ─── Format Detection ────────────────────────────────────────────────────────

/**
 * Detect the barcode format from a raw string value.
 *
 * Why string-pattern detection instead of hardware metadata?
 * Hardware scanners and camera scanners report format differently (or not at all).
 * Pattern-based detection gives a consistent result regardless of input source.
 *
 * @param raw - The raw scanned barcode string
 * @returns The detected barcode format
 */
export function detectBarcodeFormat(raw: string): BarcodeFormat {
  const trimmed = raw.trim();

  // QR codes typically contain non-numeric characters or are longer mixed strings
  if (/[^0-9]/.test(trimmed) && trimmed.length > 13) {
    return "QR";
  }

  // CODE-39 allows uppercase letters, digits, and special chars (-, ., $, /, +, %, space)
  if (/^[A-Z0-9\-.\$/+% ]+$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return "CODE-39";
  }

  // CODE-128 allows full ASCII — detected when alphanumeric but not CODE-39
  if (/[^0-9]/.test(trimmed)) {
    return "CODE-128";
  }

  // Purely numeric — determine by length
  if (/^\d{13}$/.test(trimmed)) return "EAN-13";
  if (/^\d{8}$/.test(trimmed)) return "EAN-8";
  if (/^\d{12}$/.test(trimmed)) return "UPC-A";

  // UPC-E: 6-8 digits, commonly starts with 0 or 1
  if (/^\d{6,8}$/.test(trimmed) && (trimmed[0] === "0" || trimmed[0] === "1")) {
    return "UPC-E";
  }

  return "UNKNOWN";
}

// ─── Check Digit Validation ──────────────────────────────────────────────────

/**
 * Validate an EAN-13 barcode using the standard modulo-10 check digit algorithm.
 *
 * The check digit is the 13th digit. The algorithm:
 * 1. Sum digits at odd positions (1st, 3rd, …, 11th) × 1
 * 2. Sum digits at even positions (2nd, 4th, …, 12th) × 3
 * 3. Check digit = (10 − (sum mod 10)) mod 10
 *
 * @param barcode - A 13-digit string
 * @returns true if the check digit is correct
 */
export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;

  const digits = barcode.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    // Even-indexed positions (0, 2, 4…) use weight 1; odd use weight 3
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[12];
}

/**
 * Validate an EAN-8 barcode using the standard modulo-10 check digit algorithm.
 *
 * Same algorithm as EAN-13 but with 8 digits. Weights alternate 3, 1, 3, 1…
 * for the first 7 digits (note: reversed weight pattern compared to EAN-13).
 *
 * @param barcode - An 8-digit string
 * @returns true if the check digit is correct
 */
export function validateEAN8(barcode: string): boolean {
  if (!/^\d{8}$/.test(barcode)) return false;

  const digits = barcode.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 7; i++) {
    // EAN-8 weights: positions 0,2,4,6 → weight 3; positions 1,3,5 → weight 1
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[7];
}

/**
 * Validate a UPC-A barcode using the standard modulo-10 check digit algorithm.
 *
 * UPC-A is 12 digits. Weights: odd positions (1st, 3rd…) × 3, even × 1.
 *
 * @param barcode - A 12-digit string
 * @returns true if the check digit is correct
 */
export function validateUPCA(barcode: string): boolean {
  if (!/^\d{12}$/.test(barcode)) return false;

  const digits = barcode.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    // UPC-A weights: positions 0,2,4… → weight 3; positions 1,3,5… → weight 1
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[11];
}

// ─── Unified Validation ──────────────────────────────────────────────────────

/**
 * Validate a barcode string — detects format and runs the appropriate
 * check-digit algorithm when available.
 *
 * @param raw - The raw barcode value
 * @returns Validation result with format, validity, and optional error message
 */
export function validateBarcode(raw: string): BarcodeValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { isValid: false, format: "UNKNOWN", error: "Empty barcode" };
  }

  const format = detectBarcodeFormat(trimmed);

  switch (format) {
    case "EAN-13": {
      const valid = validateEAN13(trimmed);
      return {
        isValid: valid,
        format,
        error: valid ? undefined : "Invalid EAN-13 check digit",
      };
    }
    case "EAN-8": {
      const valid = validateEAN8(trimmed);
      return {
        isValid: valid,
        format,
        error: valid ? undefined : "Invalid EAN-8 check digit",
      };
    }
    case "UPC-A": {
      const valid = validateUPCA(trimmed);
      return {
        isValid: valid,
        format,
        error: valid ? undefined : "Invalid UPC-A check digit",
      };
    }
    case "UPC-E":
      // UPC-E validation requires expansion to UPC-A — treat as valid if format matches
      return { isValid: true, format };
    case "CODE-128":
    case "CODE-39":
    case "QR":
      // No check-digit validation for these formats
      return { isValid: true, format };
    case "UNKNOWN":
      return {
        isValid: false,
        format,
        error: "Unrecognized barcode format",
      };
    default:
      return { isValid: false, format: "UNKNOWN", error: "Unsupported format" };
  }
}

// ─── Product Lookup ──────────────────────────────────────────────────────────

/**
 * Look up a product by exact barcode match in the local catalog.
 *
 * Why local catalog instead of API call?
 * Barcode scanning happens in rapid succession during stock takes. Hitting
 * the network on every scan would be too slow and unreliable in warehouses
 * with poor connectivity. The catalog is synced periodically.
 *
 * @param barcode - The barcode to look up
 * @param catalog - Local product catalog
 * @returns The matching product or null
 */
export function lookupProduct(
  barcode: string,
  catalog: BarcodeProduct[]
): BarcodeProduct | null {
  const trimmed = barcode.trim();
  return catalog.find((p) => p.barcode === trimmed) ?? null;
}

// ─── Scan Processing ─────────────────────────────────────────────────────────

/**
 * Process a raw barcode scan — validate, detect format, and look up product.
 * Returns a complete scan result suitable for display and history tracking.
 *
 * @param raw - Raw scanned value
 * @param catalog - Local product catalog
 * @param now - Optional ISO timestamp override (for deterministic testing)
 * @returns Complete scan result
 */
export function processScan(
  raw: string,
  catalog: BarcodeProduct[],
  now?: string
): BarcodeScanResult {
  const trimmed = raw.trim();
  const validation = validateBarcode(trimmed);
  const product = validation.isValid ? lookupProduct(trimmed, catalog) : null;

  return {
    rawValue: trimmed,
    format: validation.format,
    isValid: validation.isValid,
    product,
    timestamp: now ?? new Date().toISOString(),
  };
}

// ─── History & Analytics ─────────────────────────────────────────────────────

/**
 * Build a summary of scan history for display in the scanner UI.
 * Counts total scans, unique products found, and unrecognized scans.
 *
 * @param scans - Array of scan results
 * @returns Summary with counts and the full scan list (most recent first)
 */
export function buildScanHistory(scans: BarcodeScanResult[]): ScanHistorySummary {
  const uniqueProductIds = new Set<string>();
  let unrecognized = 0;

  for (const scan of scans) {
    if (scan.product) {
      uniqueProductIds.add(scan.product.id);
    } else {
      unrecognized++;
    }
  }

  // Most recent scans first for display
  const recentScans = [...scans].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    totalScans: scans.length,
    uniqueProducts: uniqueProductIds.size,
    unrecognized,
    recentScans,
  };
}

// ─── Check Digit Generation ─────────────────────────────────────────────────

/**
 * Generate the EAN-13 check digit from the first 12 digits.
 * Useful for creating new product barcodes.
 *
 * @param first12 - The first 12 digits of an EAN-13 barcode
 * @returns The check digit (single character) or empty string if input is invalid
 */
export function generateEAN13CheckDigit(first12: string): string {
  if (!/^\d{12}$/.test(first12)) return "";

  const digits = first12.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

/**
 * Find products whose barcode starts with the given partial string.
 *
 * Why fuzzy matching?
 * Partially scanned or manually typed barcodes are common during stock takes.
 * This lets staff find the product even with an incomplete barcode by showing
 * suggestions as they type.
 *
 * @param partial - Partial barcode string (prefix match)
 * @param catalog - Local product catalog
 * @returns Array of matching products (empty if partial is too short)
 */
export function fuzzyBarcodeMatch(
  partial: string,
  catalog: BarcodeProduct[]
): BarcodeProduct[] {
  const trimmed = partial.trim();

  // Require at least 3 characters to avoid returning the entire catalog
  if (trimmed.length < 3) return [];

  return catalog.filter((p) =>
    p.barcode.startsWith(trimmed) || p.sku.toLowerCase().includes(trimmed.toLowerCase())
  );
}
