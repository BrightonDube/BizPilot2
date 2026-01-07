'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle, ShoppingBag, CreditCard, CalendarDays, Edit } from 'lucide-react';
import { Badge, PageHeader, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { Card, CardContent, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { OrderStatusTracker } from '@/components/orders/OrderStatusTracker';

type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'failed';

interface OrderItem {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  discount_percent: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  line_total: number;
}

interface OrderResponse {
  id: string;
  order_number: string;
  customer_id?: string | null;
  customer_name?: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: string | null;
  shipping_address?: Record<string, string | null | undefined> | null;
  billing_address?: Record<string, string | null | undefined> | null;
  notes?: string | null;
  internal_notes?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  shipping_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  is_paid: boolean;
  order_date: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  items_count: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<OrderResponse>(`/orders/${orderId}`);
        setOrder(response.data);
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    }
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const paymentBadgeVariant =
    order?.payment_status === 'paid'
      ? 'success'
      : order?.payment_status === 'refunded'
      ? 'secondary'
      : order?.payment_status === 'failed'
      ? 'danger'
      : order?.payment_status === 'partial'
      ? 'warning'
      : 'warning';

  const statusLabel = useMemo(() => {
    if (!order) return '';
    return order.status.charAt(0).toUpperCase() + order.status.slice(1);
  }, [order]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-300">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p>Loading order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Order"
          description="Order details"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          }
        />
        <EmptyState
          title="Unable to load order"
          description={error}
          icon={<AlertTriangle className="w-8 h-8 text-yellow-400" />}
          action={
            <Button onClick={() => router.refresh()}>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        description={order.customer_name ? `Order for ${order.customer_name}` : 'Order details'}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/orders">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <Link href={`/orders/${orderId}/edit`}>
              <Button variant="secondary">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Status" value={statusLabel} icon={<ShoppingBag className="w-5 h-5" />} />
        <StatCard
          title="Payment"
          value={order.payment_status.toUpperCase()}
          icon={<CreditCard className="w-5 h-5" />}
          badge={<Badge variant={paymentBadgeVariant}>{order.payment_status}</Badge>}
        />
        <StatCard
          title="Total"
          value={formatCurrency(Number(order.total))}
          icon={<ShoppingBag className="w-5 h-5" />}
        />
        <StatCard
          title="Balance Due"
          value={formatCurrency(Number(order.balance_due))}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{order.order_number}</Badge>
                <Badge variant={paymentBadgeVariant}>{order.payment_status}</Badge>
              </div>
              <p className="text-gray-400 text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                {formatDate(order.order_date)}
              </p>
            </div>
            <OrderStatusTracker status={order.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Customer</h3>
              <p className="text-gray-300">{order.customer_name || 'Walk-in / Unassigned'}</p>
              <p className="text-xs text-gray-500">Customer ID: {order.customer_id || '—'}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Payment</h3>
              <p className="text-gray-300">Method: {order.payment_method || '—'}</p>
              <p className="text-gray-300">Paid: {formatCurrency(Number(order.amount_paid))}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Shipping Address</h3>
              <AddressBlock address={order.shipping_address} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Billing Address</h3>
              <AddressBlock address={order.billing_address} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Items ({order.items_count})</h3>
          </div>
          {order.items.length === 0 ? (
            <EmptyState title="No items" description="This order has no line items yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900/50 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-gray-400">Item</th>
                    <th className="px-4 py-3 text-gray-400">Qty</th>
                    <th className="px-4 py-3 text-gray-400">Unit</th>
                    <th className="px-4 py-3 text-gray-400">Discount</th>
                    <th className="px-4 py-3 text-gray-400">Tax</th>
                    <th className="px-4 py-3 text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-900/40">
                      <td className="px-4 py-3 text-white">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.name}</span>
                          {item.sku && <span className="text-xs text-gray-500">SKU: {item.sku}</span>}
                          {item.description && (
                            <span className="text-xs text-gray-500 line-clamp-2">{item.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{item.quantity}</td>
                      <td className="px-4 py-3 text-gray-300">{formatCurrency(Number(item.unit_price))}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {item.discount_percent}% ({formatCurrency(Number(item.discount_amount))})
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {item.tax_rate}% ({formatCurrency(Number(item.tax_amount))})
                      </td>
                      <td className="px-4 py-3 text-gray-100 font-semibold">
                        {formatCurrency(Number(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-4 justify-end text-sm text-gray-300 border-t border-gray-800 pt-4">
            <SummaryRow label="Subtotal" value={formatCurrency(Number(order.subtotal))} />
            <SummaryRow label="Discount" value={`- ${formatCurrency(Number(order.discount_amount))}`} />
            <SummaryRow label="Tax" value={formatCurrency(Number(order.tax_amount))} />
            <SummaryRow label="Shipping" value={formatCurrency(Number(order.shipping_amount || 0))} />
            <SummaryRow label="Total" value={formatCurrency(Number(order.total))} highlight />
            <SummaryRow label="Balance Due" value={formatCurrency(Number(order.balance_due))} highlight />
          </div>
        </CardContent>
      </Card>

      {(order.notes || order.internal_notes) && (
        <Card className="bg-gray-900/60 border-gray-800">
          <CardContent className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">Notes</h3>
            {order.notes && <p className="text-gray-200 whitespace-pre-wrap">{order.notes}</p>}
            {order.internal_notes && (
              <p className="text-gray-400 text-sm whitespace-pre-wrap">Internal: {order.internal_notes}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddressBlock({ address }: { address?: Record<string, string | null | undefined> | null }) {
  if (!address || Object.keys(address || {}).length === 0) {
    return <p className="text-gray-500 text-sm">Not provided</p>;
  }
  const parts = ['line1', 'line2', 'city', 'state', 'postal_code', 'country']
    .map((k) => address[k])
    .filter(Boolean);
  return <p className="text-gray-200 text-sm leading-relaxed">{parts.join(', ')}</p>;
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${highlight ? 'text-green-300 font-semibold' : ''}`}>
      <span className="text-gray-400">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
