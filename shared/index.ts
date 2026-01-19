/**
 * BizPilot Shared Types and Contracts
 * 
 * This module contains shared TypeScript types used by both frontend and backend.
 */

// Export pricing configuration
export * from './pricing-config';

// Export marketing AI context
export * from './marketing-ai-context';

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'manager' | 'employee';

// Business types
export interface Business {
  id: string;
  name: string;
  ownerId: string;
  logo?: string;
  address?: Address;
  taxNumber?: string;
  vatRate: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Product types
export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  description?: string;
  category?: string;
  price: number;
  cost: number;
  quantity: number;
  reorderLevel: number;
  status: ProductStatus;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

// Order types
export interface Order {
  id: string;
  businessId: string;
  customerId: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// Customer types
export interface Customer {
  id: string;
  businessId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  address?: Address;
  taxNumber?: string;
  notes?: string;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

// Invoice types
export interface Invoice {
  id: string;
  businessId: string;
  customerId: string;
  orderId?: string;
  invoiceNumber: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

// Payment types
export interface Payment {
  id: string;
  businessId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'credit_card' | 'payfast' | 'yoco' | 'snapscan';

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}
