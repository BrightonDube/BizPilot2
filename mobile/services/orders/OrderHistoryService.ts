/**
 * OrderHistoryService — pure functions for order history search, filtering,
 * and display logic. (order-management tasks 13.1-13.4)
 *
 * Why pure functions?
 * The order history screen needs fast local filtering and search across
 * potentially hundreds of orders. Pure functions let us filter in useMemo
 * without async overhead. The actual data comes from WatermelonDB or API.
 *
 * This service handles:
 *   - Text search across order numbers, customer names, and items
 *   - Date range filtering
 *   - Status and order type filtering
 *   - Sorting (newest first, oldest first, highest total)
 *   - Pagination helpers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "served"
  | "completed"
  | "cancelled"
  | "refunded";

export type OrderType = "dine_in" | "takeaway" | "delivery" | "tab";

export interface HistoricalOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  customerName?: string;
  tableName?: string;
  items: HistoricalOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  createdAt: string; // ISO 8601
  completedAt?: string;
  staffName: string;
  notes?: string;
}

export interface HistoricalOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  modifiers?: string[];
}

export interface OrderHistoryFilters {
  searchQuery: string;
  status: OrderStatus | "all";
  orderType: OrderType | "all";
  dateFrom?: string; // ISO date
  dateTo?: string;
  staffName?: string;
}

export type SortField = "date_desc" | "date_asc" | "total_desc" | "total_asc";

export interface OrderHistoryPage {
  orders: HistoricalOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ORDER_STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready", label: "Ready" },
  { value: "served", label: "Served" },
];

export const ORDER_TYPE_OPTIONS: { value: OrderType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "dine_in", label: "Dine In" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
  { value: "tab", label: "Tab" },
];

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#fbbf24",
  in_progress: "#3b82f6",
  ready: "#22c55e",
  served: "#8b5cf6",
  completed: "#10b981",
  cancelled: "#ef4444",
  refunded: "#f97316",
};

// ---------------------------------------------------------------------------
// Task 13.2: Search and filter
// ---------------------------------------------------------------------------

/**
 * Filter orders by text search.
 * Searches across order number, customer name, and item names.
 */
export function searchOrders(
  orders: HistoricalOrder[],
  query: string
): HistoricalOrder[] {
  if (!query.trim()) return orders;

  const lowerQuery = query.toLowerCase().trim();

  return orders.filter((order) => {
    if (order.orderNumber.toLowerCase().includes(lowerQuery)) return true;
    if (order.customerName?.toLowerCase().includes(lowerQuery)) return true;
    if (order.tableName?.toLowerCase().includes(lowerQuery)) return true;
    if (order.staffName.toLowerCase().includes(lowerQuery)) return true;
    if (order.items.some((item) => item.name.toLowerCase().includes(lowerQuery))) {
      return true;
    }
    return false;
  });
}

/**
 * Filter orders by status, type, and date range.
 */
export function filterOrders(
  orders: HistoricalOrder[],
  filters: OrderHistoryFilters
): HistoricalOrder[] {
  let result = orders;

  if (filters.searchQuery) {
    result = searchOrders(result, filters.searchQuery);
  }

  if (filters.status !== "all") {
    result = result.filter((o) => o.status === filters.status);
  }

  if (filters.orderType !== "all") {
    result = result.filter((o) => o.orderType === filters.orderType);
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    result = result.filter((o) => new Date(o.createdAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime() + 86400000; // End of day
    result = result.filter((o) => new Date(o.createdAt).getTime() < to);
  }

  if (filters.staffName) {
    const lowerStaff = filters.staffName.toLowerCase();
    result = result.filter((o) => o.staffName.toLowerCase().includes(lowerStaff));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort orders by the specified field.
 */
export function sortOrders(
  orders: HistoricalOrder[],
  sortField: SortField
): HistoricalOrder[] {
  const sorted = [...orders];

  switch (sortField) {
    case "date_desc":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "date_asc":
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case "total_desc":
      return sorted.sort((a, b) => b.total - a.total);
    case "total_asc":
      return sorted.sort((a, b) => a.total - b.total);
    default:
      return sorted;
  }
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Paginate a list of orders.
 */
export function paginateOrders(
  orders: HistoricalOrder[],
  page: number,
  pageSize: number
): OrderHistoryPage {
  const totalCount = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  const end = start + pageSize;

  return {
    orders: orders.slice(start, end),
    totalCount,
    page: clampedPage,
    pageSize,
    totalPages,
  };
}

// ---------------------------------------------------------------------------
// Task 13.3: Order detail helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the duration of an order from creation to completion.
 * Returns human-readable string like "12m" or "1h 23m".
 */
export function calculateOrderDuration(order: HistoricalOrder): string | null {
  if (!order.completedAt) return null;

  const start = new Date(order.createdAt).getTime();
  const end = new Date(order.completedAt).getTime();
  const diffMs = end - start;

  if (diffMs < 0) return null;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format a date for display in the order history list.
 */
export function formatOrderDate(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;

  return `${date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  })} ${time}`;
}
