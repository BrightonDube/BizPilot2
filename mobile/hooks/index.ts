/**
 * BizPilot Mobile POS — Hooks Barrel Export
 */

export { useAuth } from "./useAuth";
export { useSync } from "./useSync";
export { useNetworkStatus } from "./useNetworkStatus";
export { useProducts } from "./useProducts";
export { useCategories } from "./useCategories";
export { useOrders } from "./useOrders";
export { useCustomers } from "./useCustomers";

// POS convenience hooks
export { useRecentSearches } from "./useRecentSearches";
export { useFavoriteProducts } from "./useFavoriteProducts";
export { useLastCategory } from "./useLastCategory";
export { useKeyboardShortcuts, createPosShortcuts } from "./useKeyboardShortcuts";

// PMS (Property Management System) hooks
export { usePMSConnection } from "./usePMSConnection";
export { useGuestSearch } from "./useGuestSearch";
export { useRoomCharge } from "./useRoomCharge";
export { useFolio } from "./useFolio";
