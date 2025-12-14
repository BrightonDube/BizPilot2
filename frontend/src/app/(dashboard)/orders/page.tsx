'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_id: string | null;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  items_count?: number;
  order_date: string;
  created_at: string;
}

interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-gray-500', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending: { color: 'bg-yellow-500', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  confirmed: { color: 'bg-blue-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Confirmed' },
  processing: { color: 'bg-purple-500', icon: <Package className="w-3 h-3" />, label: 'Processing' },
  shipped: { color: 'bg-indigo-500', icon: <Truck className="w-3 h-3" />, label: 'Shipped' },
  delivered: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Delivered' },
  cancelled: { color: 'bg-red-500', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        setIsLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '20',
        });
        
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        if (selectedStatus !== 'all') {
          params.append('status', selectedStatus);
        }
        
        const response = await apiClient.get<OrderListResponse>(`/orders?${params}`);
        setOrders(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setError('Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    }

    // Debounce search
    const timeoutId = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, selectedStatus]);

  const filteredOrders = orders;

  const totalOrders = total;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load orders</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`Manage customer orders (${totalOrders} orders)`}
        actions={
          <Link href="/orders/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={totalOrders}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Pending Orders"
          value={pendingOrders}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Completed"
          value={completedOrders}
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="order-status-filter" className="sr-only">Filter by order status</label>
        <select
          id="order-status-filter"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button variant="outline" className="border-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description="Try adjusting your search or filters"
          action={
            <Link href="/orders/new">
              <Button>Create Your First Order</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${status.color} bg-opacity-20 flex items-center justify-center`}>
                          <span className={`${status.color.replace('bg-', 'text-')}`}>
                            {status.icon}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{order.order_number}</h3>
                            <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>
                              {order.payment_status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{order.customer_name || 'Walk-in Customer'}</p>
                          <p className="text-xs text-gray-500">{order.items_count || 0} items • {formatDate(order.order_date || order.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(order.total)}
                        </div>
                        <Badge variant="secondary">{status.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} orders)
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
