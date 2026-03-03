/**
 * BizPilot Mobile POS — POS Components Barrel Export
 *
 * Re-exports all POS-specific components from a single entry point.
 * Import like: import { ProductGrid, CartPanel } from "@/components/pos"
 */

export { default as ProductCard } from "./ProductCard";
export { default as ProductGrid } from "./ProductGrid";
export { default as CategoryTabs } from "./CategoryTabs";
export { default as SearchBar } from "./SearchBar";
export { default as CartItem } from "./CartItem";
export { default as SwipeableCartItem } from "./SwipeableCartItem";
export { default as CartPanel } from "./CartPanel";
export { default as CustomerSelector } from "./CustomerSelector";
export { default as PaymentModal } from "./PaymentModal";
export { default as Receipt } from "./Receipt";
export { default as VoidOrderModal } from "./VoidOrderModal";
export { default as ItemNotesModal } from "./ItemNotesModal";
export { default as ItemDiscountModal } from "./ItemDiscountModal";
export { default as QuickAddCustomer } from "./QuickAddCustomer";
export { default as HeldCartsPanel } from "./HeldCartsPanel";
export { default as RecentOrdersPanel } from "./RecentOrdersPanel";
export { default as FavoriteProducts } from "./FavoriteProducts";
export { default as SearchResultsDropdown } from "./SearchResultsDropdown";
export { default as BarcodeScanner } from "./BarcodeScanner";
export { default as SuggestionBanner } from "./SuggestionBanner";

// Re-export prop types for consumers
export type { ProductCardProps } from "./ProductCard";
export type { ProductGridProps } from "./ProductGrid";
export type { CategoryTabsProps } from "./CategoryTabs";
export type { SearchBarProps } from "./SearchBar";
export type { CartItemProps } from "./CartItem";
export type { SwipeableCartItemProps } from "./SwipeableCartItem";
export type { CartPanelProps } from "./CartPanel";
export type { CustomerSelectorProps } from "./CustomerSelector";
export type { PaymentModalProps, PaymentMethod } from "./PaymentModal";
export type { ReceiptProps } from "./Receipt";
export type { VoidOrderModalProps } from "./VoidOrderModal";
export type { ItemNotesModalProps } from "./ItemNotesModal";
export type { ItemDiscountModalProps } from "./ItemDiscountModal";
export type { QuickAddCustomerProps } from "./QuickAddCustomer";
export type { HeldCartsPanelProps } from "./HeldCartsPanel";
export type { RecentOrdersPanelProps } from "./RecentOrdersPanel";
export type { FavoriteProductsProps } from "./FavoriteProducts";
export type { SearchResultsDropdownProps } from "./SearchResultsDropdown";
export type { BarcodeScannerProps, BarcodeScanResult, BarcodeFormat } from "./BarcodeScanner";
export type { SuggestionBannerProps } from "./SuggestionBanner";
