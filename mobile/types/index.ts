/**
 * BizPilot Mobile POS — Core Type Definitions
 */

export interface SyncMetadata {
  remoteId?: string | null;
  syncedAt?: number | null;
  isDirty?: boolean;
}

export interface Product extends SyncMetadata {
  id?: string;
  name?: string;
  price?: number;
  category_id?: string;
  is_available?: boolean;
  discount?: number;
  quantity?: number;
  // Compatibility
  productId?: string;
  productName?: string;
  unitPrice?: number;
}

export interface Customer extends SyncMetadata {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  loyaltyPoints?: number;
  totalSpent?: number;
  visitCount?: number;
  updatedAt?: number;
  createdAt?: number;
}

export interface MobileUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  pinHash?: string | null;
}

export interface CartItem {
  id?: string;
  productId?: string;
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  price?: number;
  discount: number;
  notes?: string | null;
  remoteId?: string | null;
  total?: number;
  createdAt?: number;
  syncedAt?: number | null;
  isDirty?: boolean;
}

export interface MobileOrderItem extends CartItem {
  id: string;
  orderId?: string;
}

export type OrderStatus =
  | "draft"
  | "pending"
  | "completed"
  | "cancelled"
  | "refunded"
  | "partial"
  | "voided"
  | "new"
  | "preparing"
  | "ready"
  | "delivered";

export interface MobileOrder extends SyncMetadata {
  id: string;
  total: number;
  status: OrderStatus;
  discount?: number;
  discountAmount?: number;
  orderNumber?: string;
  customerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  subtotal?: number;
  taxAmount?: number;
  voidReason?: string;
  voidedBy?: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  items?: any[];
  statusHistory?: any[];
  orderType?: string;
  tableId?: string;
  notes?: string | null;
  createdBy?: string;
  amountTendered?: number;
  change?: number;
  cartDiscount?: number;
  vatRate?: number;
  taxInclusive?: boolean;
}

export interface TableRecord {
  id: string;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "dirty";
  activeOrderId: string | null;
  statusChangedAt: string;
}

export interface ManagedOrder extends MobileOrder {
  orderType: string;
  tableId?: string;
  statusHistory: Array<{
    timestamp: string;
    status: OrderStatus;
    changedBy: string;
  }>;
}

export interface KDSOrder {
  id: string;
  displayNumber: string;
  orderType: string;
  tableName?: string;
  items: KDSOrderItem[];
  sentAt: string;
  priority: number;
}

export interface KDSOrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  modifiers: string[];
  category: string;
  status: "pending" | "preparing" | "ready" | "delivered";
  stationId: string;
}

export interface KDSStation {
  id: string;
  name: string;
  categories: string[];
}

export type SyncStatus = "idle" | "syncing" | "error";

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  syncError: string | null;
  // Aliases for compatibility
  pendingChanges: number;
  lastError: string | null;
}

export interface AuthState {
  user: MobileUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pinUser?: MobileUser | null;
}

export { Product as MobileProduct, Customer as MobileCustomer };

export interface LoyaltyTransaction {
  type: "expired" | "earned" | "redeemed" | "adjusted";
  points: number;
  createdAt?: number;
}

export interface OrderItem extends MobileOrderItem {}
