'use client';

/**
 * ReorderReports — Reporting dashboard for automated reordering.
 *
 * Displays PO history, stockout risk projections, and inventory turnover
 * metrics.  Data is fetched from the /reorder/reports/* endpoints.
 *
 * Why a component instead of a separate page?
 * Reporting is contextual to the reorder workflow.  Showing it
 * inline (as a tab) keeps the user in the same mental context rather
 * than forcing navigation to a separate reports section.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, LoadingSpinner, EmptyState } from '@/components/ui/bizpilot';
import { BarChart3, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────────────────────────────

interface POHistoryItem {
  id: string;
  reference: string;
  supplier_name?: string;
  status: string;
  total_amount: number;
  items_count: number;
  created_at: string;
}

interface StockoutItem {
  product_id: string;
  product_name: string;
  current_stock: number;
  days_until_stockout?: number;
  avg_daily_sales?: number;
}

interface TurnoverItem {
  product_id: string;
  product_name: string;
  turnover_ratio: number;
  avg_inventory: number;
  total_sold: number;
  period_days: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val);

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    draft: 'bg-gray-600',
    submitted: 'bg-blue-600',
    approved: 'bg-emerald-600',
    ordered: 'bg-indigo-600',
    partially_received: 'bg-amber-600',
    received: 'bg-green-600',
    cancelled: 'bg-red-600',
  };
  return map[status] || 'bg-gray-600';
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ReorderReports() {
  const [activeReport, setActiveReport] = useState<'history' | 'stockouts' | 'turnover'>('history');
  const [poHistory, setPOHistory] = useState<POHistoryItem[]>([]);
  const [stockouts, setStockouts] = useState<StockoutItem[]>([]);
  const [turnover, setTurnover] = useState<TurnoverItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async (report: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/reorder/reports/${report}`);
      const items = res.data.items || [];
      if (report === 'history') setPOHistory(items);
      else if (report === 'stockouts') setStockouts(items);
      else if (report === 'turnover') setTurnover(items);
    } catch {
      console.error(`Failed to fetch ${report} report`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport, fetchReport]);

  const reports = [
    { key: 'history' as const, label: 'PO History', icon: BarChart3 },
    { key: 'stockouts' as const, label: 'Stockout Risk', icon: AlertTriangle },
    { key: 'turnover' as const, label: 'Turnover', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Report selector */}
      <div className="flex items-center gap-2">
        {reports.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveReport(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeReport === key
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchReport(activeReport)}
          className="ml-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* PO History */}
          {activeReport === 'history' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300">Purchase Order History</CardTitle>
              </CardHeader>
              <CardContent>
                {poHistory.length === 0 ? (
                  <EmptyState title="No history" description="No purchase orders found." />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-700">
                      <tr>
                        <th className="text-left px-2 py-2 text-gray-400">Reference</th>
                        <th className="text-left px-2 py-2 text-gray-400">Supplier</th>
                        <th className="text-center px-2 py-2 text-gray-400">Status</th>
                        <th className="text-right px-2 py-2 text-gray-400">Total</th>
                        <th className="text-right px-2 py-2 text-gray-400">Items</th>
                        <th className="text-right px-2 py-2 text-gray-400">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {poHistory.map((po) => (
                        <tr key={po.id} className="hover:bg-gray-900/40">
                          <td className="px-2 py-2 text-white">{po.reference}</td>
                          <td className="px-2 py-2 text-gray-300">{po.supplier_name || '—'}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs text-white ${statusColor(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-gray-300">
                            {formatCurrency(po.total_amount)}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-300">{po.items_count}</td>
                          <td className="px-2 py-2 text-right text-gray-400 text-xs">
                            {new Date(po.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stockout Risk */}
          {activeReport === 'stockouts' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300">Stockout Risk Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {stockouts.length === 0 ? (
                  <EmptyState title="No data" description="No products with stock data found." />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-700">
                      <tr>
                        <th className="text-left px-2 py-2 text-gray-400">Product</th>
                        <th className="text-right px-2 py-2 text-gray-400">Stock</th>
                        <th className="text-right px-2 py-2 text-gray-400">Avg Daily Sales</th>
                        <th className="text-right px-2 py-2 text-gray-400">Days Until Stockout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {stockouts.map((item) => (
                        <tr key={item.product_id} className="hover:bg-gray-900/40">
                          <td className="px-2 py-2 text-white">{item.product_name}</td>
                          <td className="px-2 py-2 text-right text-gray-300">{item.current_stock}</td>
                          <td className="px-2 py-2 text-right text-gray-300">
                            {item.avg_daily_sales?.toFixed(1) || '0'}
                          </td>
                          <td className="px-2 py-2 text-right">
                            {item.days_until_stockout != null ? (
                              <span
                                className={
                                  item.days_until_stockout <= 7
                                    ? 'text-red-400 font-semibold'
                                    : item.days_until_stockout <= 14
                                    ? 'text-amber-400'
                                    : 'text-gray-300'
                                }
                              >
                                {item.days_until_stockout} days
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Inventory Turnover */}
          {activeReport === 'turnover' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300">Inventory Turnover (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {turnover.length === 0 ? (
                  <EmptyState title="No data" description="No products found." />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-700">
                      <tr>
                        <th className="text-left px-2 py-2 text-gray-400">Product</th>
                        <th className="text-right px-2 py-2 text-gray-400">Turnover Ratio</th>
                        <th className="text-right px-2 py-2 text-gray-400">Avg Inventory</th>
                        <th className="text-right px-2 py-2 text-gray-400">Total Sold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {turnover.map((item) => (
                        <tr key={item.product_id} className="hover:bg-gray-900/40">
                          <td className="px-2 py-2 text-white">{item.product_name}</td>
                          <td className="px-2 py-2 text-right text-emerald-400 font-semibold">
                            {item.turnover_ratio.toFixed(2)}×
                          </td>
                          <td className="px-2 py-2 text-right text-gray-300">
                            {item.avg_inventory.toFixed(0)}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-300">{item.total_sold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
