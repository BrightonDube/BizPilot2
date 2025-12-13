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
  ShoppingCart
} from 'lucide-react';
import { Button, Input, Card, CardContent, LoadingSpinner } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  payment_status: string;
  total: number;
  items_count: number;
  order_date: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-gray-500', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending: { color: 'bg-yellow-500', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  confirmed: { color: 'bg-blue-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Confirmed' },
  processing: { color: 'bg-purple-500', icon: <Package className="w-3 h-3" />, label: 'Processing' },
  shipped: { color: 'bg-indigo-500', icon: <Truck className="w-3 h-3" />, label: 'Shipped' },
  delivered: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Delivered' },
  completed: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
  cancelled: { color: 'bg-red-500', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get('/orders', {
        params: { limit: 50 },
      });
      setOrders(response.data.items || []);
    } catch (error) {
      // Use empty array if API is not available
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage customer orders"
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
          value={`R ${totalRevenue.toLocaleString()}`}
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="order-status-filter" className="sr-only">Filter by order status</label>
        <select
          id="order-status-filter"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
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
          description={orders.length === 0 
            ? "Create your first order to get started"
            : "Try adjusting your search or filters"
          }
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
                              {order.payment_status || 'pending'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{order.customer_name || 'Unknown Customer'}</p>
                          <p className="text-xs text-gray-500">{order.items_count || 0} items • {order.order_date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          R {(order.total || 0).toLocaleString()}
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
    </div>
  );
}
