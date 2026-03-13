/**
 * Loyalty Components
 *
 * Barrel export for all loyalty-related POS UI components.
 *
 * - LoyaltyRedemptionPanel: inline panel in checkout for point-based discounts (Task 4.1)
 * - RewardsCatalogModal: full reward catalog browsing + selection (Tasks 5.1–5.4)
 * - LoyaltyCardModal: card lookup, digital card display, card-customer linking (Tasks 8.1–8.3)
 */

export { default as LoyaltyRedemptionPanel } from "./LoyaltyRedemptionPanel";
export type { LoyaltyRedemptionPanelProps } from "./LoyaltyRedemptionPanel";

export { default as RewardsCatalogModal } from "./RewardsCatalogModal";
export type { RewardsCatalogModalProps, Reward } from "./RewardsCatalogModal";

export { default as LoyaltyCardModal } from "./LoyaltyCardModal";
export type { LoyaltyCardModalProps, LoyaltyCardCustomer } from "./LoyaltyCardModal";
