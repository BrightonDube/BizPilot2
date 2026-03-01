'use client';

/**
 * Sales Reports page - Detailed sales analytics with multiple report views.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  Layers,
  CreditCard,
  Clock,
  Calendar,
  Percent,
  RotateCcw,
  Download,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import { FeatureGate } from '@/components/subscription/FeatureGate';

type TabKey = 'daily' | 'weekly' | 'monthly' | 'products' | 'categories' | 'payments' | 'time' | 'discounts' | 'refunds';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { key: 'daily', label: 'Daily', icon: <Calendar className="w-4 h-4" /> },
  { key: 'weekly', label: 'Weekly', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'monthly', label: 'Monthly', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
  { key: 'categories', label: 'Categories', icon: <Layers className="w-4 h-4" /> },
  { key: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { key: 'time', label: 'Time Analysis', icon: <Clock className="w-4 h-4" /> },
  { key: 'discounts', label: 'Discounts', icon: <Percent className="w-4 h-4" /> },
  { key: 'refunds', label: 'Refunds', icon: <RotateCcw className="w-4 h-4" /> },
];

function formatZAR(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  return {
    start: thirtyDaysAgo.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0],
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SalesReportsPage() {
  const defaults = getDefaultDates();
  const [activeTab, setActiveTab] = useState<TabKey>('daily');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let res;
      switch (activeTab) {
        case 'daily':
          res = await apiClient.get('/reports/sales/daily', {
            params: { date: endDate },
          });
          break;
        case 'weekly':
          res = await apiClient.get('/reports/sales/weekly', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'monthly': {
          const d = new Date(endDate);
          res = await apiClient.get('/reports/sales/monthly', {
            params: { year: d.getFullYear(), month: d.getMonth() + 1 },
          });
          break;
        }
        case 'products':
          res = await apiClient.get('/reports/sales/products', {
            params: { start_date: startDate, end_date: endDate, limit: 20 },
          });
          break;
        case 'categories':
          res = await apiClient.get('/reports/sales/categories', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'payments':
          res = await apiClient.get('/reports/sales/payments', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'time':
          res = await apiClient.get('/reports/sales/time-analysis', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'discounts':
          res = await apiClient.get('/reports/sales/discounts', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'refunds':
          res = await apiClient.get('/reports/sales/refunds', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
      }
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch report data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportableTypes = ['products', 'categories', 'payments', 'discounts', 'refunds'];

  const handleExportCSV = async () => {
    if (!exportableTypes.includes(activeTab)) return;
    try {
      const res = await apiClient.get('/reports/export/csv', {
        params: { report_type: activeTab, start_date: startDate, end_date: endDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTab}_report_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silently fail export
    }
  };

  return (
    <FeatureGate feature="reports">
    <div className="space-y-6">
      <PageHeader
        title="Sales Reports"
        description="Detailed sales analytics and breakdowns"
      />

      {/* Date Range Selector */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm text-gray-400">
                From
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm text-gray-400">
                To
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {exportableTypes.includes(activeTab) && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-800/50 border border-gray-700 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-red-400">{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          {activeTab === 'daily' && <DailyReport data={data} />}
          {activeTab === 'weekly' && <WeeklyReport data={data} />}
          {activeTab === 'monthly' && <MonthlyReport data={data} />}
          {activeTab === 'products' && <ProductsReport data={data} />}
          {activeTab === 'categories' && <CategoriesReport data={data} />}
          {activeTab === 'payments' && <PaymentsReport data={data} />}
          {activeTab === 'time' && <TimeAnalysisReport data={data} />}
          {activeTab === 'discounts' && <DiscountsReport data={data} />}
          {activeTab === 'refunds' && <RefundsReport data={data} />}
        </div>
      ) : null}
    </div>
    </FeatureGate>
  );
}

// --- Sub-components for each tab ---

function DailyReport({ data }: { data: any }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sales"
          value={formatZAR(data.total_sales ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Order Count"
          value={data.order_count ?? 0}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Average Order"
          value={formatZAR(data.average_order_value ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Items Sold"
          value={data.items_sold ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
      </div>
      {data.orders && data.orders.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Order #', 'Customer', 'Items', 'Total', 'Status', 'Time']}
              rows={data.orders.map((o: any) => [
                o.order_number ?? o.id?.slice(0, 8) ?? '-',
                o.customer_name ?? '-',
                o.item_count ?? '-',
                formatZAR(o.total ?? 0),
                o.status ?? '-',
                o.created_at ? new Date(o.created_at).toLocaleTimeString() : '-',
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function WeeklyReport({ data }: { data: any }) {
  const days = data.daily_breakdown ?? data.days ?? [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Weekly Sales"
          value={formatZAR(data.total_sales ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Total Orders"
          value={data.total_orders ?? data.order_count ?? 0}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Daily Average"
          value={formatZAR(data.daily_average ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Items Sold"
          value={data.items_sold ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
      </div>
      {days.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Date', 'Orders', 'Sales', 'Avg Order']}
              rows={days.map((d: any) => [
                d.date ?? '-',
                d.order_count ?? d.orders ?? 0,
                formatZAR(d.total_sales ?? d.sales ?? 0),
                formatZAR(d.average_order ?? d.avg_order ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function MonthlyReport({ data }: { data: any }) {
  const weeks = data.weekly_breakdown ?? data.weeks ?? [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Sales"
          value={formatZAR(data.total_sales ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Total Orders"
          value={data.total_orders ?? data.order_count ?? 0}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Weekly Average"
          value={formatZAR(data.weekly_average ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Items Sold"
          value={data.items_sold ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
      </div>
      {weeks.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Weekly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Week', 'Orders', 'Sales', 'Avg Order']}
              rows={weeks.map((w: any) => [
                w.week ?? w.label ?? '-',
                w.order_count ?? w.orders ?? 0,
                formatZAR(w.total_sales ?? w.sales ?? 0),
                formatZAR(w.average_order ?? w.avg_order ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ProductsReport({ data }: { data: any }) {
  const products = data.products ?? data.items ?? data ?? [];
  const list = Array.isArray(products) ? products : [];
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          Top Products by Sales
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No product data available</p>
        ) : (
          <DataTable
            columns={['#', 'Product', 'Qty Sold', 'Revenue', 'Avg Price']}
            rows={list.map((p: any, i: number) => [
              i + 1,
              p.name ?? p.product_name ?? '-',
              p.quantity_sold ?? p.qty ?? p.sales ?? 0,
              formatZAR(p.total_revenue ?? p.revenue ?? 0),
              formatZAR(p.average_price ?? p.avg_price ?? 0),
            ])}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CategoriesReport({ data }: { data: any }) {
  const categories = data.categories ?? data.items ?? data ?? [];
  const list = Array.isArray(categories) ? categories : [];
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Sales by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No category data available</p>
        ) : (
          <DataTable
            columns={['Category', 'Orders', 'Items Sold', 'Revenue', '% of Total']}
            rows={list.map((c: any) => [
              c.name ?? c.category_name ?? '-',
              c.order_count ?? c.orders ?? 0,
              c.items_sold ?? c.quantity ?? 0,
              formatZAR(c.total_revenue ?? c.revenue ?? 0),
              c.percentage != null ? `${c.percentage.toFixed(1)}%` : '-',
            ])}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsReport({ data }: { data: any }) {
  const methods = data.payment_methods ?? data.methods ?? data ?? [];
  const list = Array.isArray(methods) ? methods : [];
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-green-400" />
          Sales by Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No payment data available</p>
        ) : (
          <DataTable
            columns={['Payment Method', 'Transactions', 'Total Amount', '% of Total']}
            rows={list.map((m: any) => [
              m.method ?? m.payment_method ?? m.name ?? '-',
              m.transaction_count ?? m.count ?? 0,
              formatZAR(m.total_amount ?? m.amount ?? 0),
              m.percentage != null ? `${m.percentage.toFixed(1)}%` : '-',
            ])}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TimeAnalysisReport({ data }: { data: any }) {
  const hourly = data.hourly_breakdown ?? data.hours ?? [];
  const hourlyList = Array.isArray(hourly) ? hourly : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Peak Hour"
          value={data.peak_hour != null ? `${data.peak_hour}:00` : '-'}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Peak Day"
          value={data.peak_day ?? '-'}
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Orders/Hour"
          value={data.avg_orders_per_hour?.toFixed(1) ?? '-'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>
      {hourlyList.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Hourly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Hour', 'Orders', 'Sales']}
              rows={hourlyList.map((h: any) => [
                `${h.hour ?? h.time ?? '-'}:00`,
                h.order_count ?? h.orders ?? 0,
                formatZAR(h.total_sales ?? h.sales ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function DiscountsReport({ data }: { data: any }) {
  const byProduct = data.by_product ?? [];
  const byCategory = data.by_category ?? [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Discounts"
          value={formatZAR(data.total_discounts ?? 0)}
          icon={<Percent className="w-5 h-5" />}
        />
        <StatCard
          title="Discount % of Sales"
          value={`${data.discount_percentage ?? 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Discounted Orders"
          value={data.discounted_order_count ?? 0}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Gross Sales"
          value={formatZAR(data.gross_sales ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>
      {byProduct.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-400" />
              Discounts by Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Product', 'Discount Total', 'Revenue', 'Discount %', 'Items']}
              rows={byProduct.map((p: any) => [
                p.product_name ?? '-',
                formatZAR(p.discount_total ?? 0),
                formatZAR(p.revenue ?? 0),
                `${p.discount_percentage ?? 0}%`,
                p.item_count ?? 0,
              ])}
            />
          </CardContent>
        </Card>
      )}
      {byCategory.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-yellow-400" />
              Discounts by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Category', 'Discount Total', 'Revenue', 'Discount %']}
              rows={byCategory.map((c: any) => [
                c.category_name ?? '-',
                formatZAR(c.discount_total ?? 0),
                formatZAR(c.revenue ?? 0),
                `${c.discount_percentage ?? 0}%`,
              ])}
            />
          </CardContent>
        </Card>
      )}
      {byProduct.length === 0 && byCategory.length === 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No discount data for this period</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function RefundsReport({ data }: { data: any }) {
  const byProduct = data.by_product ?? [];
  const dailyTrend = data.daily_trend ?? [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Refunds"
          value={formatZAR(data.total_refunds ?? 0)}
          icon={<RotateCcw className="w-5 h-5" />}
        />
        <StatCard
          title="Refund Count"
          value={data.refund_count ?? 0}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Refund Rate"
          value={`${data.refund_rate ?? 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Gross Sales"
          value={formatZAR(data.gross_sales ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>
      {byProduct.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-red-400" />
              Refunds by Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Product', 'Refund Total', 'Quantity', 'Refund Count', '% of Refunds']}
              rows={byProduct.map((p: any) => [
                p.product_name ?? '-',
                formatZAR(p.refund_total ?? 0),
                p.quantity ?? 0,
                p.refund_count ?? 0,
                `${p.percentage_of_refunds ?? 0}%`,
              ])}
            />
          </CardContent>
        </Card>
      )}
      {dailyTrend.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-400" />
              Refund Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Date', 'Count', 'Amount']}
              rows={dailyTrend.map((d: any) => [
                d.date ?? '-',
                d.count ?? 0,
                formatZAR(d.amount ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      )}
      {byProduct.length === 0 && dailyTrend.length === 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No refund data for this period</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// --- Reusable table component ---

function DataTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-700/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-200 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
