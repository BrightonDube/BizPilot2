/**
 * BizPilot Mobile POS — BluetoothPrinterService
 *
 * Handles Bluetooth thermal printer discovery, connection, and printing.
 * Generates ESC/POS commands for receipt printing.
 *
 * Why ESC/POS over image-based printing?
 * ESC/POS is the industry standard for thermal receipt printers.
 * Text-based commands are:
 * 1. Fast — no image rendering/transfer overhead
 * 2. Small — a receipt is ~500 bytes vs ~50KB as an image
 * 3. Universal — works with 95%+ of thermal printers
 * 4. Reliable — simple byte commands, no rendering bugs
 *
 * Architecture:
 * This service is a facade over react-native-ble-plx (BLE) or
 * classic Bluetooth (via react-native-bluetooth-serial-next).
 * The actual BLE/Bluetooth library calls are abstracted behind
 * the PrinterConnection interface so we can swap implementations.
 *
 * Note: This service defines the types and ESC/POS command generation.
 * The actual Bluetooth transport requires native modules installed.
 * TODO: Install react-native-ble-plx and wire up real transport.
 */

import type { FormattedReceipt } from "./ReceiptService";
import { renderTextReceipt } from "./ReceiptService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported printer connection types */
export type PrinterConnectionType = "bluetooth_classic" | "bluetooth_le" | "usb";

/** Printer status */
export type PrinterStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "printing"
  | "error";

/** Discovered printer device */
export interface PrinterDevice {
  /** Unique device identifier (MAC address or UUID) */
  id: string;
  /** Human-readable device name */
  name: string;
  /** Connection type */
  connectionType: PrinterConnectionType;
  /** Signal strength (RSSI) for BLE devices */
  rssi?: number;
}

/** Active printer connection */
export interface PrinterConnection {
  /** The connected device */
  device: PrinterDevice;
  /** Current status */
  status: PrinterStatus;
  /** Send raw bytes to the printer */
  write: (data: Uint8Array) => Promise<void>;
  /** Disconnect from the printer */
  disconnect: () => Promise<void>;
}

/** Print job configuration */
export interface PrintConfig {
  /** Number of copies to print */
  copies: number;
  /** Whether to cut paper after printing */
  autoCut: boolean;
  /** Whether to open the cash drawer */
  openCashDrawer: boolean;
  /** Paper width in characters (default: 42 for 80mm, 32 for 58mm) */
  paperWidth: number;
}

/** Print job result */
export interface PrintResult {
  success: boolean;
  error?: string;
  /** Timestamp of print completion/failure */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// ESC/POS command constants
// ---------------------------------------------------------------------------

/**
 * ESC/POS commands for thermal receipt printers.
 * These are the byte sequences sent to the printer to control formatting.
 *
 * Why raw bytes instead of a library?
 * ESC/POS is simple enough that a library adds unnecessary abstraction.
 * The commands are well-documented and rarely change.
 * Raw control gives us exact output for receipt formatting.
 */
export const ESCPOS = {
  /** Initialize printer (reset to default settings) */
  INIT: new Uint8Array([0x1b, 0x40]),

  /** Line feed */
  LF: new Uint8Array([0x0a]),

  /** Cut paper (partial cut) */
  CUT: new Uint8Array([0x1d, 0x56, 0x41, 0x03]),

  /** Full paper cut */
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),

  /** Open cash drawer (pulse pin 2) */
  CASH_DRAWER: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),

  /** Bold on */
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),

  /** Bold off */
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),

  /** Double height on */
  DOUBLE_HEIGHT_ON: new Uint8Array([0x1b, 0x21, 0x10]),

  /** Double height off / normal size */
  DOUBLE_HEIGHT_OFF: new Uint8Array([0x1b, 0x21, 0x00]),

  /** Align left */
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),

  /** Align center */
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),

  /** Align right */
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),

  /** Underline on */
  UNDERLINE_ON: new Uint8Array([0x1b, 0x2d, 0x01]),

  /** Underline off */
  UNDERLINE_OFF: new Uint8Array([0x1b, 0x2d, 0x00]),

  /** Feed N lines before cut (3 lines) */
  FEED_BEFORE_CUT: new Uint8Array([0x1b, 0x64, 0x03]),
} as const;

// ---------------------------------------------------------------------------
// ESC/POS receipt builder
// ---------------------------------------------------------------------------

/**
 * Encodes a string as bytes for ESC/POS printing.
 * Uses CP437 (default thermal printer codepage) compatible encoding.
 *
 * Why manual encoding?
 * TextEncoder uses UTF-8, but most thermal printers use CP437/CP850.
 * For ASCII-only text (which SA receipts are), the encodings are identical.
 * Non-ASCII characters (accents, symbols) would need a proper CP437 table.
 */
function encodeText(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** Concatenate multiple Uint8Array into one */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Build ESC/POS byte commands for a formatted receipt.
 * Returns a Uint8Array ready to send to the printer.
 *
 * This is the core function that converts our receipt data into
 * the byte stream that produces a formatted thermal printout.
 */
export function buildEscPosReceipt(
  receipt: FormattedReceipt,
  config: Partial<PrintConfig> = {}
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Initialize printer
  parts.push(ESCPOS.INIT);

  // Header — centered, bold, double height for business name
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_HEIGHT_ON);
  parts.push(encodeText(receipt.header.businessName));
  parts.push(ESCPOS.LF);
  parts.push(ESCPOS.DOUBLE_HEIGHT_OFF);
  parts.push(ESCPOS.BOLD_OFF);

  if (receipt.header.addressLine1) {
    parts.push(encodeText(receipt.header.addressLine1));
    parts.push(ESCPOS.LF);
  }
  if (receipt.header.addressLine2) {
    parts.push(encodeText(receipt.header.addressLine2));
    parts.push(ESCPOS.LF);
  }
  if (receipt.header.phone) {
    parts.push(encodeText(`Tel: ${receipt.header.phone}`));
    parts.push(ESCPOS.LF);
  }
  if (receipt.header.vatNumber) {
    parts.push(encodeText(`VAT: ${receipt.header.vatNumber}`));
    parts.push(ESCPOS.LF);
  }

  // Divider
  parts.push(ESCPOS.ALIGN_LEFT);
  parts.push(encodeText("=".repeat(config.paperWidth ?? 42)));
  parts.push(ESCPOS.LF);

  // Use the text receipt for the body — it's already formatted
  const textReceipt = renderTextReceipt(receipt);
  const lines = textReceipt.split("\n");

  // Skip header lines (already printed with formatting above)
  // Find the first "=" line and start from there
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("=")) {
      startIndex = i + 1;
      break;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    parts.push(encodeText(lines[i]));
    parts.push(ESCPOS.LF);
  }

  // Feed before cut
  parts.push(ESCPOS.FEED_BEFORE_CUT);

  // Auto cut
  if (config.autoCut !== false) {
    parts.push(ESCPOS.CUT);
  }

  // Open cash drawer
  if (config.openCashDrawer) {
    parts.push(ESCPOS.CASH_DRAWER);
  }

  return concatBytes(...parts);
}

// ---------------------------------------------------------------------------
// Printer management functions
// ---------------------------------------------------------------------------

/**
 * Build a print job for a receipt with the specified configuration.
 * Returns the raw bytes to send to the printer.
 *
 * For multiple copies, the bytes are repeated.
 */
export function buildPrintJob(
  receipt: FormattedReceipt,
  config: Partial<PrintConfig> = {}
): Uint8Array {
  const copies = config.copies ?? 1;
  const receiptBytes = buildEscPosReceipt(receipt, config);

  if (copies <= 1) return receiptBytes;

  // For multiple copies, concatenate the receipt bytes
  const allCopies: Uint8Array[] = [];
  for (let i = 0; i < copies; i++) {
    allCopies.push(receiptBytes);
  }
  return concatBytes(...allCopies);
}

/**
 * Send a print job to a connected printer.
 * Handles the write and returns the result.
 */
export async function printReceipt(
  connection: PrinterConnection,
  receipt: FormattedReceipt,
  config: Partial<PrintConfig> = {}
): Promise<PrintResult> {
  if (connection.status !== "connected") {
    return {
      success: false,
      error: `Printer not connected (status: ${connection.status})`,
      timestamp: Date.now(),
    };
  }

  try {
    const data = buildPrintJob(receipt, config);
    await connection.write(data);

    return {
      success: true,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown print error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Open the cash drawer without printing a receipt.
 * Used for manual cash drawer open (e.g., start-of-shift).
 */
export async function openCashDrawer(
  connection: PrinterConnection
): Promise<PrintResult> {
  if (connection.status !== "connected") {
    return {
      success: false,
      error: "Printer not connected",
      timestamp: Date.now(),
    };
  }

  try {
    await connection.write(ESCPOS.CASH_DRAWER);
    return { success: true, timestamp: Date.now() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Print a test page to verify printer connection and alignment.
 */
export function buildTestPage(): Uint8Array {
  return concatBytes(
    ESCPOS.INIT,
    ESCPOS.ALIGN_CENTER,
    ESCPOS.BOLD_ON,
    ESCPOS.DOUBLE_HEIGHT_ON,
    encodeText("BizPilot POS"),
    ESCPOS.LF,
    ESCPOS.DOUBLE_HEIGHT_OFF,
    ESCPOS.BOLD_OFF,
    encodeText("Printer Test Page"),
    ESCPOS.LF,
    ESCPOS.LF,
    ESCPOS.ALIGN_LEFT,
    encodeText("=".repeat(42)),
    ESCPOS.LF,
    encodeText("If you can read this,"),
    ESCPOS.LF,
    encodeText("your printer is working!"),
    ESCPOS.LF,
    encodeText("=".repeat(42)),
    ESCPOS.LF,
    ESCPOS.LF,
    encodeText(`Printed: ${new Date().toLocaleString("en-ZA")}`),
    ESCPOS.LF,
    ESCPOS.FEED_BEFORE_CUT,
    ESCPOS.CUT
  );
}
