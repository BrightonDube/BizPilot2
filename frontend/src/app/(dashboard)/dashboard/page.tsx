'use client';

/**
 * Dashboard page component.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardContent, Button, LoadingSpinner } from '@/components/ui';
import { apiClient } from '@/lib/api';

interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  revenue_change: number;
  orders_change: number;
  customers_change: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
}

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ordersRes, productsRes] = await Promise.all([
        apiClient.get('/reports/stats', { params: { range: '30d' } }),
        apiClient.get('/orders', { params: { limit: 5 } }),
        apiClient.get('/reports/top-products', { params: { range: '30d', limit: 5 } }),
      ]);
      
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.items || []);
      setTopProducts(productsRes.data || []);
    } catch (error) {
      // Use fallback data if API is not available
      setStats({
        total_revenue: 0,
        total_orders: 0,
        total_customers: 0,
        total_products: 0,
        revenue_change: 0,
        orders_change: 0,
        customers_change: 0,
      });
      setRecentOrders([]);
      setTopProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getChangeType = (value: number): 'positive' | 'negative' | 'neutral' => {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  };

  const statsDisplay = stats ? [
    {
      title: 'Total Revenue',
      value: `R ${stats.total_revenue.toLocaleString()}`,
      change: stats.revenue_change ? `${stats.revenue_change > 0 ? '+' : ''}${stats.revenue_change}%` : undefined,
      changeType: getChangeType(stats.revenue_change),
      icon: <DollarSign className="w-5 h-5" />,
      description: 'from last period',
    },
    {
      title: 'Orders',
      value: stats.total_orders.toLocaleString(),
      change: stats.orders_change ? `${stats.orders_change > 0 ? '+' : ''}${stats.orders_change}%` : undefined,
      changeType: getChangeType(stats.orders_change),
      icon: <ShoppingCart className="w-5 h-5" />,
      description: 'from last period',
    },
    {
      title: 'Customers',
      value: stats.total_customers.toLocaleString(),
      change: stats.customers_change ? `${stats.customers_change > 0 ? '+' : ''}${stats.customers_change}%` : undefined,
      changeType: getChangeType(stats.customers_change),
      icon: <Users className="w-5 h-5" />,
      description: 'total customers',
    },
    {
      title: 'Products',
      value: stats.total_products.toLocaleString(),
      changeType: 'neutral' as const,
      icon: <Package className="w-5 h-5" />,
      description: 'active products',
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here&apos;s what&apos;s happening with your business today."
        actions={
          <Link href="/reports">
            <Button variant="gradient">
              <TrendingUp className="h-4 w-4 mr-2" />
              View Reports
            </Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsDisplay.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{order.order_number}</p>
                      <p className="text-xs text-gray-400">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">R {order.total?.toLocaleString() || '0'}</p>
                      <p className={`text-xs ${
                        order.status === 'completed' ? 'text-green-400' :
                        order.status === 'processing' ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {order.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Products</CardTitle>
            <Link href="/products">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No product data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-400 w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{product.name}</p>
                        <p className="text-xs text-gray-400">{product.sales} sales</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-white">R {product.revenue?.toLocaleString() || '0'}</p>
                  </div>
                ))}
              </div>
            )}
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
            <Link href="/orders">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 w-full">
                <ShoppingCart className="h-6 w-6" />
                <span>New Order</span>
              </Button>
            </Link>
            <Link href="/products/new">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 w-full">
                <Package className="h-6 w-6" />
                <span>Add Product</span>
              </Button>
            </Link>
            <Link href="/customers/new">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 w-full">
                <Users className="h-6 w-6" />
                <span>Add Customer</span>
              </Button>
            </Link>
            <Link href="/invoices">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 w-full">
                <FileText className="h-6 w-6" />
                <span>Create Invoice</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
