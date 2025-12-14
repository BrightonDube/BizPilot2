'use client';

/**
 * Dashboard page component with real data from API.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';

interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  orders_today: number;
  revenue_today: number;
  orders_this_month: number;
  revenue_this_month: number;
  pending_invoices: number;
  pending_invoice_amount: number;
  low_stock_products: number;
  currency: string;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface TopProduct {
  id: string;
  name: string;
  sku: string | null;
  quantity_sold: number;
  revenue: number;
}

interface DashboardData {
  stats: DashboardStats;
  recent_orders: RecentOrder[];
  top_products: TopProduct[];
}

// Format currency in ZAR
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format status for display
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'completed':
    case 'paid':
      return 'text-green-400';
    case 'processing':
    case 'shipped':
    case 'confirmed':
      return 'text-yellow-400';
    case 'pending':
    case 'draft':
      return 'text-gray-400';
    case 'cancelled':
    case 'refunded':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await apiClient.get('/dashboard');
        setDashboardData(response.data);
      } catch (err: unknown) {
        console.error('Failed to fetch dashboard data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load dashboard</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <Button variant="gradient" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Build stats from API data
  const stats = dashboardData ? [
    {
      title: 'Total Revenue',
      value: formatCurrency(dashboardData.stats.total_revenue),
      change: `+${dashboardData.stats.orders_this_month} this month`,
      changeType: 'positive' as const,
      icon: <DollarSign className="w-5 h-5" />,
      description: 'all time',
    },
    {
      title: 'Orders',
      value: dashboardData.stats.total_orders.toString(),
      change: `${dashboardData.stats.orders_today} today`,
      changeType: 'positive' as const,
      icon: <ShoppingCart className="w-5 h-5" />,
      description: 'total orders',
    },
    {
      title: 'Customers',
      value: dashboardData.stats.total_customers.toString(),
      change: 'Active customers',
      changeType: 'positive' as const,
      icon: <Users className="w-5 h-5" />,
      description: 'registered',
    },
    {
      title: 'Products',
      value: dashboardData.stats.total_products.toString(),
      change: `${dashboardData.stats.low_stock_products} low stock`,
      changeType: dashboardData.stats.low_stock_products > 0 ? 'negative' as const : 'positive' as const,
      icon: <Package className="w-5 h-5" />,
      description: 'active products',
    },
  ] : [];

  const recentOrders = dashboardData?.recent_orders || [];
  const topProducts = dashboardData?.top_products || [];

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
            <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{order.order_number}</p>
                      <p className="text-xs text-gray-400">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{formatCurrency(order.total)}</p>
                      <p className={`text-xs ${getStatusColor(order.status)}`}>
                        {capitalizeStatus(order.status)}
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
            <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No products yet</p>
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
                        <p className="text-xs text-gray-400">{product.quantity_sold} in stock</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-white">{formatCurrency(product.revenue)}</p>
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
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => router.push('/orders?action=new')}
            >
              <ShoppingCart className="h-6 w-6" />
              <span>New Order</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => router.push('/products?action=new')}
            >
              <Package className="h-6 w-6" />
              <span>Add Product</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => router.push('/customers?action=new')}
            >
              <Users className="h-6 w-6" />
              <span>Add Customer</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => router.push('/invoices?action=new')}
            >
              <TrendingDown className="h-6 w-6" />
              <span>Create Invoice</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invoices Alert */}
      {dashboardData && dashboardData.stats.pending_invoices > 0 && (
        <Card className="mt-4 border-yellow-600/30 bg-yellow-900/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-400">
                  You have {dashboardData.stats.pending_invoices} pending invoice{dashboardData.stats.pending_invoices > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-yellow-300/70">
                  Total outstanding: {formatCurrency(dashboardData.stats.pending_invoice_amount)}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
                onClick={() => router.push('/invoices?status=pending')}
              >
                View Invoices
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
