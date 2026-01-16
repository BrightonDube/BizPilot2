'use client';

/**
 * Reports page - Financial reports and analytics dashboard.
 */

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  StatCard,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import { OrdersTrendChart } from '@/components/charts/OrdersTrendChart';

interface ReportStats {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  revenue_change: number;
  orders_change: number;
  customers_change: number;
}

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

interface TopCustomer {
  id: string;
  name: string;
  orders: number;
  total_spent: number;
}

interface TrendDataPoint {
  date: string;
  value: number;
  label: string;
}

interface RevenueTrend {
  data: TrendDataPoint[];
  total: number;
  average: number;
}

interface OrdersTrend {
  data: TrendDataPoint[];
  total: number;
  average: number;
}

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomer] = useState<TopCustomer[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend | null>(null);
  const [ordersTrend, setOrdersTrend] = useState<OrdersTrend | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const [category, setCategory] = useState<'all' | 'sales' | 'purchases'>('sales');

  useEffect(() => {
    fetchReportData();
  }, [dateRange, category]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const direction = category === 'sales' ? 'inbound' : category === 'purchases' ? 'outbound' : undefined;
      const [statsRes, productsRes, customersRes, revenueTrendRes, ordersTrendRes] = await Promise.all([
        apiClient.get('/reports/stats', { params: { range: dateRange, direction } }),
        apiClient.get('/reports/top-products', { params: { range: dateRange, limit: 5, direction } }),
        apiClient.get('/reports/top-customers', { params: { range: dateRange, limit: 5, direction } }),
        apiClient.get('/reports/revenue-trend', { params: { range: dateRange, direction } }),
        apiClient.get('/reports/orders-trend', { params: { range: dateRange, direction } }),
      ]);
      setStats(statsRes.data);
      setTopProducts(productsRes.data || []);
      setTopCustomers(customersRes.data || []);
      setRevenueTrend(revenueTrendRes.data || { data: [], total: 0, average: 0 });
      setOrdersTrend(ordersTrendRes.data || { data: [], total: 0, average: 0 });
    } catch (error) {
      // Use default values if API is not available
      setStats({
        total_revenue: 0,
        total_orders: 0,
        total_customers: 0,
        total_products: 0,
        revenue_change: 0,
        orders_change: 0,
        customers_change: 0,
      });
      setTopProducts([]);
      setTopCustomers([]);
      setRevenueTrend({ data: [], total: 0, average: 0 });
      setOrdersTrend({ data: [], total: 0, average: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const categoryOptions = [
    { value: 'sales', label: 'Sales report' },
    { value: 'purchases', label: 'Purchases report' },
    { value: 'all', label: 'All activity' },
  ] as const;

  const extractFilenameFromContentDisposition = (value?: string) => {
    if (!value) return null;
    const match = value.match(/filename="?([^\";]+)"?/i);
    return match?.[1] || null;
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const direction = category === 'sales' ? 'inbound' : category === 'purchases' ? 'outbound' : undefined;
      const res = await apiClient.get('/reports/export/pdf', {
        params: { range: dateRange, direction },
        responseType: 'blob',
      });

      const contentDisposition = res.headers?.['content-disposition'] as string | undefined;
      const filename =
        extractFilenameFromContentDisposition(contentDisposition) || `report_${dateRange}.pdf`;

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Business analytics and insights"
        actions={
          <div className="flex items-center gap-3">
            <label htmlFor="report-category-select" className="sr-only">Select report category</label>
            <Select
              id="report-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as 'all' | 'sales' | 'purchases')}
              className="w-auto text-sm"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <label htmlFor="date-range-select" className="sr-only">Select date range</label>
            <Select
              id="date-range-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-auto text-sm"
            >
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              className="border-gray-700"
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Revenue"
              value={`R ${(stats?.total_revenue || 0).toLocaleString()}`}
              icon={<DollarSign className="w-5 h-5" />}
              change={stats?.revenue_change ? `${stats.revenue_change > 0 ? '+' : ''}${stats.revenue_change}%` : undefined}
              changeType={stats?.revenue_change && stats.revenue_change > 0 ? 'positive' : 'negative'}
            />
            <StatCard
              title="Total Orders"
              value={stats?.total_orders?.toLocaleString() || '0'}
              icon={<ShoppingCart className="w-5 h-5" />}
              change={stats?.orders_change ? `${stats.orders_change > 0 ? '+' : ''}${stats.orders_change}%` : undefined}
              changeType={stats?.orders_change && stats.orders_change > 0 ? 'positive' : 'negative'}
            />
            <StatCard
              title="Total Customers"
              value={stats?.total_customers?.toLocaleString() || '0'}
              icon={<Users className="w-5 h-5" />}
              change={stats?.customers_change ? `${stats.customers_change > 0 ? '+' : ''}${stats.customers_change}%` : undefined}
              changeType={stats?.customers_change && stats.customers_change > 0 ? 'positive' : 'negative'}
            />
            <StatCard
              title="Active Products"
              value={stats?.total_products?.toLocaleString() || '0'}
              icon={<Package className="w-5 h-5" />}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Revenue Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueTrend && <RevenueTrendChart {...revenueTrend} />}
              </CardContent>
            </Card>

            {/* Orders Chart */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Orders Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ordersTrend && <OrdersTrendChart {...ordersTrend} />}
              </CardContent>
            </Card>
          </div>

          {/* Top Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-400" />
                  Top Products
                </CardTitle>
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
                        <p className="text-sm font-medium text-white">
                          R {product.revenue.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  Top Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topCustomers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No customer data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topCustomers.map((customer, index) => (
                      <div key={customer.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-400 w-6">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-white">{customer.name}</p>
                            <p className="text-xs text-gray-400">{customer.orders} orders</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-white">
                          R {customer.total_spent.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
