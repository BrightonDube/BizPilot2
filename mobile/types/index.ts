/**
 * BizPilot Mobile POS — Core Type Definitions
 *
 * Shared types for the mobile POS application. These mirror the
 * backend schemas but are optimized for offline-first mobile use.
 *
 * Why separate from shared/?
 * Mobile types include sync metadata (isDirty, syncedAt, remoteId)
 * that only exist on the client side. The shared/ package has
 * server-canonical types; these extend them for offline use.
 */

// ---------------------------------------------------------------------------
// Sync metadata — every syncable entity carries these fields
// ---------------------------------------------------------------------------

export interface SyncMetadata {
  /** Server-side UUID, null if created offline and not yet synced */
  remoteId: string | null;
  /** Timestamp of last successful sync (epoch ms) */
  syncedAt: number | null;
  /** True if the record has local changes not yet pushed to server */
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export interface MobileProduct extends SyncMetadata {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  price: number;
  costPrice: number | null;
  categoryId: string;
  imageUrl: string | null;
  isActive: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export interface MobileCategory extends SyncMetadata {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "draft"
  | "pending"
  | "completed"
  | "cancelled"
  | "refunded"
  | "partial"
  | "voided";

export type PaymentStatus = "pending" | "paid" | "partial" | "refunded";

export interface MobileOrder extends SyncMetadata {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: OrderStatus;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Order Item
// ---------------------------------------------------------------------------

export interface MobileOrderItem {
  id: string;
  remoteId: string | null;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  notes: string | null;
  createdAt: number;
  syncedAt: number | null;
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export interface MobileCustomer extends SyncMetadata {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// User (POS operator)
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "manager" | "cashier" | "waiter";

export interface MobileUser {
  id: string;
  remoteId: string;
  email: string;
  firstName: string;
  lastName: string;
  pinHash: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
}

// ---------------------------------------------------------------------------
// Settings (key-value local config)
// ---------------------------------------------------------------------------

export interface MobileSetting {
  id: string;
  key: string;
  value: string;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Sync Queue Entry
// ---------------------------------------------------------------------------

export type SyncAction = "create" | "update" | "delete";

export interface SyncQueueEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: SyncAction;
  /** JSON-serialized payload */
  payload: string;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  processedAt: number | null;
}

// ---------------------------------------------------------------------------
// Cart (in-memory, not persisted to WatermelonDB)
// ---------------------------------------------------------------------------

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  notes: string | null;
}

export interface Cart {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "error";

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingChanges: number;
  isOnline: boolean;
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

export interface AuthState {
  isAuthenticated: boolean;
  user: MobileUser | null;
  token: string | null;
  refreshToken: string | null;
  pinUser: MobileUser | null;
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ApiListResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SyncPullResponse<T> {
  changes: T[];
  timestamp: number;
  hasMore: boolean;
}

export interface SyncPushResponse {
  accepted: number;
  rejected: number;
  conflicts: Array<{
    entityId: string;
    serverVersion: number;
    resolution: string;
  }>;
}
