'use client';

import { useState } from 'react';
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
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';

const mockOrders = [
  {
    id: '1',
    order_number: 'ORD-20241212-00001',
    customer_name: 'John Doe',
    status: 'processing',
    payment_status: 'paid',
    total: 245.99,
    items_count: 3,
    order_date: '2024-12-12',
  },
  {
    id: '2',
    order_number: 'ORD-20241211-00045',
    customer_name: 'Acme Corporation',
    status: 'shipped',
    payment_status: 'paid',
    total: 1250.00,
    items_count: 12,
    order_date: '2024-12-11',
  },
  {
    id: '3',
    order_number: 'ORD-20241210-00089',
    customer_name: 'Jane Smith',
    status: 'pending',
    payment_status: 'pending',
    total: 89.50,
    items_count: 2,
    order_date: '2024-12-10',
  },
  {
    id: '4',
    order_number: 'ORD-20241209-00102',
    customer_name: 'TechStart Inc',
    status: 'delivered',
    payment_status: 'paid',
    total: 5499.00,
    items_count: 25,
    order_date: '2024-12-09',
  },
];

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredOrders = mockOrders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = mockOrders.length;
  const totalRevenue = mockOrders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = mockOrders.filter(o => o.status === 'pending').length;
  const completedOrders = mockOrders.filter(o => o.status === 'delivered').length;

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
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          trend={{ value: 22, isPositive: true }}
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
          trend={{ value: 8, isPositive: true }}
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
        <select
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
            const status = statusConfig[order.status];
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
                          <p className="text-sm text-gray-400">{order.customer_name}</p>
                          <p className="text-xs text-gray-500">{order.items_count} items • {order.order_date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          ${order.total.toLocaleString()}
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
