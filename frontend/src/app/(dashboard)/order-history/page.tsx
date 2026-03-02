'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Search, Filter, Calendar, Loader2, ChevronLeft, ChevronRight, Eye, RotateCcw, Clock } from 'lucide-react';

interface OrderHistoryItem {
  id: string;
  order_number: string;
  status: string;
  order_type: string | null;
  total: number;
  item_count: number;
  customer_name: string | null;
  order_date: string | null;
  is_tab: boolean;
  tab_name: string | null;
}

const STATUS_BADGES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  received: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
};

const TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
  collection: 'Collection',
  standard: 'Standard',
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, per_page: perPage };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.order_type = typeFilter;
      if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
      if (dateTo) params.date_to = new Date(dateTo).toISOString();
      const res = await apiClient.get('/order-management/history', { params });
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, statusFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / perPage);

  const viewStatusHistory = async (orderId: string) => {
    try {
      const res = await apiClient.get(`/order-management/${orderId}/status-history`);
      setStatusHistory(res.data);
      setSelectedOrder(orderId);
      setShowHistory(true);
    } catch (err) {
      console.error('Failed to fetch status history:', err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
        <p className="text-gray-600">Search and review past orders</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search order #..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-3 py-2 border rounded-lg" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2">
            <option value="">All Statuses</option>
            {Object.keys(STATUS_BADGES).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2">
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2" placeholder="From" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2" placeholder="To" />
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600">
        {total} orders found
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
          <p className="text-gray-600">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Order #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{order.order_number}</div>
                    {order.is_tab && <span className="text-xs text-blue-600">Tab: {order.tab_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-sm">{order.order_type ? TYPE_LABELS[order.order_type] || order.order_type : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[order.status] || 'bg-gray-100'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{order.item_count}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">R {order.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString('en-ZA') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => window.location.href = `/orders/${order.id}`} className="p-1 hover:bg-gray-100 rounded" title="View order">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => viewStatusHistory(order.id)} className="p-1 hover:bg-gray-100 rounded" title="Status history">
                        <Clock className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Status History</h2>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-100 rounded">✕</button>
            </div>
            {statusHistory.length === 0 ? (
              <p className="text-gray-600 text-sm">No status changes recorded.</p>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 border-l-2 border-blue-300 pl-3 pb-3">
                    <div>
                      <div className="text-sm font-medium">
                        {h.old_status ? `${h.old_status} → ${h.new_status}` : `Set to ${h.new_status}`}
                      </div>
                      {h.reason && <div className="text-xs text-gray-500">{h.reason}</div>}
                      <div className="text-xs text-gray-400">{new Date(h.changed_at).toLocaleString('en-ZA')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
