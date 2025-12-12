'use client';

/**
 * Dashboard page component.
 */

import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';

export default function DashboardPage() {
  // Mock data - in production this would come from API
  const stats = [
    {
      title: 'Total Revenue',
      value: 'R 45,231',
      change: '+20.1%',
      changeType: 'positive' as const,
      icon: <DollarSign className="w-5 h-5" />,
      description: 'from last month',
    },
    {
      title: 'Orders',
      value: '356',
      change: '+12.5%',
      changeType: 'positive' as const,
      icon: <ShoppingCart className="w-5 h-5" />,
      description: 'from last month',
    },
    {
      title: 'Customers',
      value: '1,234',
      change: '+5.2%',
      changeType: 'positive' as const,
      icon: <Users className="w-5 h-5" />,
      description: 'from last month',
    },
    {
      title: 'Products',
      value: '573',
      change: '-2.1%',
      changeType: 'negative' as const,
      icon: <Package className="w-5 h-5" />,
      description: 'low stock items',
    },
  ];

  const recentOrders = [
    { id: 'ORD-001', customer: 'John Doe', amount: 'R 1,250', status: 'Completed' },
    { id: 'ORD-002', customer: 'Jane Smith', amount: 'R 890', status: 'Processing' },
    { id: 'ORD-003', customer: 'Bob Wilson', amount: 'R 2,340', status: 'Pending' },
    { id: 'ORD-004', customer: 'Alice Brown', amount: 'R 560', status: 'Completed' },
    { id: 'ORD-005', customer: 'Charlie Davis', amount: 'R 1,890', status: 'Processing' },
  ];

  const topProducts = [
    { name: 'Premium Widget', sales: 234, revenue: 'R 23,400' },
    { name: 'Standard Gadget', sales: 189, revenue: 'R 18,900' },
    { name: 'Deluxe Package', sales: 156, revenue: 'R 31,200' },
    { name: 'Basic Bundle', sales: 143, revenue: 'R 7,150' },
    { name: 'Pro Subscription', sales: 98, revenue: 'R 9,800' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here&apos;s what&apos;s happening with your business today."
        actions={
          <Button variant="gradient">
            <TrendingUp className="h-4 w-4 mr-2" />
            View Reports
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{order.id}</p>
                    <p className="text-xs text-gray-400">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{order.amount}</p>
                    <p className={`text-xs ${
                      order.status === 'Completed' ? 'text-green-400' :
                      order.status === 'Processing' ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {order.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Products</CardTitle>
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.sales} sales</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white">{product.revenue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <ShoppingCart className="h-6 w-6" />
              <span>New Order</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Package className="h-6 w-6" />
              <span>Add Product</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Users className="h-6 w-6" />
              <span>Add Customer</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <TrendingDown className="h-6 w-6" />
              <span>Create Invoice</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
