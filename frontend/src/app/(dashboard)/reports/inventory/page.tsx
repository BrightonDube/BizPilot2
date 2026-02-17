'use client';

/**
 * Inventory Reports page - Detailed inventory analytics with multiple report views.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  ArrowDownUp,
  Warehouse,
  AlertTriangle,
  Truck,
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

type TabKey = 'stock-levels' | 'movements' | 'valuation' | 'turnover' | 'supplier-performance';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { key: 'stock-levels', label: 'Stock Levels', icon: <Warehouse className="w-4 h-4" /> },
  { key: 'movements', label: 'Movements', icon: <ArrowDownUp className="w-4 h-4" /> },
  { key: 'valuation', label: 'Valuation', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'turnover', label: 'Turnover', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'supplier-performance', label: 'Supplier Performance', icon: <Truck className="w-4 h-4" /> },
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

export default function InventoryReportsPage() {
  const defaults = getDefaultDates();
  const [activeTab, setActiveTab] = useState<TabKey>('stock-levels');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stock Levels filters
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);

  // Valuation method
  const [valuationMethod, setValuationMethod] = useState<string>('average_cost');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let res;
      switch (activeTab) {
        case 'stock-levels':
          res = await apiClient.get('/reports/inventory/stock-levels', {
            params: {
              ...(lowStockOnly ? { low_stock_only: true } : {}),
              ...(outOfStockOnly ? { out_of_stock_only: true } : {}),
            },
          });
          break;
        case 'movements':
          res = await apiClient.get('/reports/inventory/movements', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'valuation':
          res = await apiClient.get('/reports/inventory/valuation', {
            params: { method: valuationMethod },
          });
          break;
        case 'turnover':
          res = await apiClient.get('/reports/inventory/turnover', {
            params: { start_date: startDate, end_date: endDate },
          });
          break;
        case 'supplier-performance':
          res = await apiClient.get('/reports/inventory/supplier-performance', {
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
  }, [activeTab, startDate, endDate, lowStockOnly, outOfStockOnly, valuationMethod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showDateRange = activeTab !== 'stock-levels' && activeTab !== 'valuation';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Reports"
        description="Detailed inventory analytics and stock insights"
      />

      {/* Controls */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            {showDateRange && (
              <>
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
              </>
            )}

            {activeTab === 'stock-levels' && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  Low Stock Only
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outOfStockOnly}
                    onChange={(e) => setOutOfStockOnly(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  Out of Stock Only
                </label>
              </>
            )}

            {activeTab === 'valuation' && (
              <div className="flex items-center gap-2">
                <label htmlFor="valuation-method" className="text-sm text-gray-400">
                  Method
                </label>
                <select
                  id="valuation-method"
                  value={valuationMethod}
                  onChange={(e) => setValuationMethod(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="average_cost">Average Cost</option>
                  <option value="fifo">FIFO</option>
                  <option value="lifo">LIFO</option>
                </select>
              </div>
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
          {activeTab === 'stock-levels' && <StockLevelsReport data={data} />}
          {activeTab === 'movements' && <MovementsReport data={data} />}
          {activeTab === 'valuation' && <ValuationReport data={data} />}
          {activeTab === 'turnover' && <TurnoverReport data={data} />}
          {activeTab === 'supplier-performance' && <SupplierPerformanceReport data={data} />}
        </div>
      ) : null}
    </div>
  );
}

// --- Sub-components for each tab ---

function StockLevelsReport({ data }: { data: any }) {
  const items = data.items ?? data.products ?? data ?? [];
  const list = Array.isArray(items) ? items : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Products"
          value={data.total_products ?? list.length ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Total Stock Value"
          value={formatZAR(data.total_stock_value ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Low Stock Items"
          value={data.low_stock_count ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard
          title="Out of Stock"
          value={data.out_of_stock_count ?? 0}
          icon={<Warehouse className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Product', 'SKU', 'Category', 'In Stock', 'Reorder Level', 'Unit Cost', 'Stock Value']}
              rows={list.map((p: any) => [
                p.name ?? p.product_name ?? '-',
                p.sku ?? '-',
                p.category_name ?? p.category ?? '-',
                p.quantity_in_stock ?? p.stock ?? 0,
                p.reorder_level ?? p.reorder_point ?? '-',
                formatZAR(p.unit_cost ?? p.cost_price ?? 0),
                formatZAR(p.stock_value ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function MovementsReport({ data }: { data: any }) {
  const movements = data.movements ?? data.items ?? data ?? [];
  const list = Array.isArray(movements) ? movements : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Movements"
          value={data.total_movements ?? list.length ?? 0}
          icon={<ArrowDownUp className="w-5 h-5" />}
        />
        <StatCard
          title="Stock In"
          value={data.total_stock_in ?? 0}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Stock Out"
          value={data.total_stock_out ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Net Movement"
          value={data.net_movement ?? 0}
          icon={<Layers className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-blue-400" />
              Stock Movements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Date', 'Product', 'Type', 'Quantity', 'Reference', 'Notes']}
              rows={list.map((m: any) => [
                m.date ?? (m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'),
                m.product_name ?? m.name ?? '-',
                m.movement_type ?? m.type ?? '-',
                m.quantity ?? 0,
                m.reference ?? m.reference_number ?? '-',
                m.notes ?? '-',
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ValuationReport({ data }: { data: any }) {
  const items = data.items ?? data.products ?? data ?? [];
  const list = Array.isArray(items) ? items : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Valuation"
          value={formatZAR(data.total_valuation ?? data.total_value ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Total Items"
          value={data.total_items ?? list.length ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Unit Cost"
          value={formatZAR(data.average_unit_cost ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Method"
          value={(data.method ?? 'average_cost').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          icon={<Layers className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Inventory Valuation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Product', 'SKU', 'Quantity', 'Unit Cost', 'Total Value', '% of Total']}
              rows={list.map((p: any) => [
                p.name ?? p.product_name ?? '-',
                p.sku ?? '-',
                p.quantity ?? p.quantity_in_stock ?? 0,
                formatZAR(p.unit_cost ?? p.cost_price ?? 0),
                formatZAR(p.total_value ?? p.stock_value ?? 0),
                p.percentage != null ? `${p.percentage.toFixed(1)}%` : '-',
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function TurnoverReport({ data }: { data: any }) {
  const items = data.items ?? data.products ?? data ?? [];
  const list = Array.isArray(items) ? items : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Avg Turnover Rate"
          value={data.average_turnover_rate?.toFixed(2) ?? '-'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Days to Sell"
          value={data.average_days_to_sell?.toFixed(1) ?? '-'}
          icon={<ArrowDownUp className="w-5 h-5" />}
        />
        <StatCard
          title="Fast Moving"
          value={data.fast_moving_count ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Slow Moving"
          value={data.slow_moving_count ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              Inventory Turnover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Product', 'Units Sold', 'Avg Stock', 'Turnover Rate', 'Days to Sell', 'Revenue']}
              rows={list.map((p: any) => [
                p.name ?? p.product_name ?? '-',
                p.units_sold ?? p.quantity_sold ?? 0,
                p.average_stock ?? p.avg_inventory ?? 0,
                p.turnover_rate?.toFixed(2) ?? '-',
                p.days_to_sell?.toFixed(1) ?? '-',
                formatZAR(p.revenue ?? p.total_revenue ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SupplierPerformanceReport({ data }: { data: any }) {
  const suppliers = data.suppliers ?? data.items ?? data ?? [];
  const list = Array.isArray(suppliers) ? suppliers : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Suppliers"
          value={data.total_suppliers ?? list.length ?? 0}
          icon={<Truck className="w-5 h-5" />}
        />
        <StatCard
          title="Total Orders"
          value={data.total_orders ?? 0}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Total Spend"
          value={formatZAR(data.total_spend ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Lead Time"
          value={data.average_lead_time != null ? `${data.average_lead_time.toFixed(1)} days` : '-'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" />
              Supplier Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Supplier', 'Orders', 'Items Supplied', 'Total Spend', 'Avg Lead Time', 'On-Time %']}
              rows={list.map((s: any) => [
                s.name ?? s.supplier_name ?? '-',
                s.order_count ?? s.orders ?? 0,
                s.items_supplied ?? s.total_items ?? 0,
                formatZAR(s.total_spend ?? s.amount ?? 0),
                s.avg_lead_time != null ? `${s.avg_lead_time.toFixed(1)} days` : '-',
                s.on_time_percentage != null ? `${s.on_time_percentage.toFixed(1)}%` : '-',
              ])}
            />
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
