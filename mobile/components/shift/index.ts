/**
 * Shift UI Components — barrel export
 *
 * All POS shift management UI components exported from one place.
 *
 * Usage:
 *   import { PinEntryPad, ShiftOpenModal, ShiftCloseModal,
 *            CashMovementModal, VarianceDisplay, CashDrawerButton,
 *            EODSummaryView, ShiftReportsView }
 *     from "@/components/shift";
 */

export { default as PinEntryPad } from "./PinEntryPad";
export { default as ShiftOpenModal } from "./ShiftOpenModal";
export { default as ShiftCloseModal } from "./ShiftCloseModal";
export { default as CashMovementModal } from "./CashMovementModal";
export { default as VarianceDisplay } from "./VarianceDisplay";
export { default as CashDrawerButton } from "./CashDrawerButton";
export { default as EODSummaryView } from "./EODSummaryView";
export { default as ShiftReportsView } from "./ShiftReportsView";

// Re-export key types for consuming components
export type { PinEntryPadProps } from "./PinEntryPad";
export type { ShiftOpenModalProps, ShiftOpenData } from "./ShiftOpenModal";
export type { ShiftCloseModalProps, ShiftCloseData } from "./ShiftCloseModal";
export type { CashMovementModalProps, CashMovementData, CashMovementType } from "./CashMovementModal";
export type { VarianceDisplayProps } from "./VarianceDisplay";
export type { CashDrawerButtonProps, DrawerKickResult } from "./CashDrawerButton";
export type { EODSummaryViewProps } from "./EODSummaryView";
export type { ShiftReportsViewProps } from "./ShiftReportsView";

// Default float constant (Task 8.1)
export { DEFAULT_OPENING_FLOAT } from "./ShiftOpenModal";
