'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, ShoppingBag, Clock, CheckCircle, XCircle, Truck, Store, RefreshCw } from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OnlineOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfillment_type: 'delivery' | 'collection';
  delivery_address: string | null;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  estimated_ready_at: string | null;
  is_paid: boolean;
  items: OrderItem[];
  created_at: string;
}

interface StoreConfig {
  store_name: string;
  is_active: boolean;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_threshold: number | null;
  estimated_prep_minutes: number;
  accepts_delivery: boolean;
  accepts_collection: boolean;
}

interface OrderStats {
  total_orders: number;
  pending_orders: number;
  preparing_orders: number;
  completed_today: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  out_for_delivery: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-200 text-green-900',
  collected: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'collected'],
  out_for_delivery: ['delivered'],
};

export default function OnlineOrdersPage() {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<OnlineOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'all' | 'settings'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, activeRes, statsRes, storeRes] = await Promise.all([
        apiClient.get('/online-orders/orders', { params: { per_page: 50 } }),
        apiClient.get('/online-orders/orders/active'),
        apiClient.get('/online-orders/stats'),
        apiClient.get('/online-orders/store').catch(() => ({ data: null })),
      ]);
      setOrders(ordersRes.data.items || ordersRes.data);
      setActiveOrders(activeRes.data);
      setStats(statsRes.data);
      if (storeRes.data) setStoreConfig(storeRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiClient.patch(`/online-orders/orders/${orderId}/status`, { status: newStatus });
      fetchData();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch {
      // ignore
    }
  };

  const updateStore = async (updates: Partial<StoreConfig>) => {
    try {
      const res = await apiClient.put('/online-orders/store', { ...storeConfig, ...updates });
      setStoreConfig(res.data);
    } catch {
      // ignore
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val);

  const formatDate = (d: string) => new Date(d).toLocaleString('en-ZA');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" />
          Online Orders
        </h1>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="text-gray-500 hover:text-gray-700 p-2"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Orders', value: stats.total_orders, icon: <ShoppingBag className="w-5 h-5 text-blue-600" /> },
            { label: 'Pending', value: stats.pending_orders, icon: <Clock className="w-5 h-5 text-yellow-600" /> },
            { label: 'Preparing', value: stats.preparing_orders, icon: <Store className="w-5 h-5 text-orange-600" /> },
            { label: 'Completed Today', value: stats.completed_today, icon: <CheckCircle className="w-5 h-5 text-green-600" /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b">
        {(['active', 'all', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-b-2 capitalize transition-colors ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'active' ? `Active (${activeOrders.length})` : tab}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && storeConfig && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4 max-w-2xl">
          <h2 className="text-lg font-semibold">Store Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
              <input
                type="text"
                value={storeConfig.store_name}
                onChange={(e) => updateStore({ store_name: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (min)</label>
              <input
                type="number"
                value={storeConfig.estimated_prep_minutes}
                onChange={(e) => updateStore({ estimated_prep_minutes: parseInt(e.target.value) || 30 })}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Fee</label>
              <input
                type="number"
                value={storeConfig.delivery_fee}
                onChange={(e) => updateStore({ delivery_fee: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount</label>
              <input
                type="number"
                value={storeConfig.min_order_amount}
                onChange={(e) => updateStore({ min_order_amount: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={storeConfig.is_active}
                onChange={(e) => updateStore({ is_active: e.target.checked })}
              />
              Store Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={storeConfig.accepts_delivery}
                onChange={(e) => updateStore({ accepts_delivery: e.target.checked })}
              />
              Accept Delivery
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={storeConfig.accepts_collection}
                onChange={(e) => updateStore({ accepts_collection: e.target.checked })}
              />
              Accept Collection
            </label>
          </div>
        </div>
      )}

      {(activeTab === 'active' || activeTab === 'all') && (
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {activeTab === 'all' && (
              <div className="flex gap-2 mb-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded-lg p-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}
            {(activeTab === 'active' ? activeOrders : orders)
              .filter((o) => !statusFilter || o.status === statusFilter)
              .map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 transition ${
                    selectedOrder?.id === order.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-semibold">{order.order_number}</span>
                      <span className="text-sm text-gray-500 ml-2">{order.customer_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      {order.fulfillment_type === 'delivery' ? <Truck className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                      {order.fulfillment_type}
                    </span>
                    <span className="font-medium">{formatCurrency(order.total)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(order.created_at)}</p>
                </div>
              ))}
            {(activeTab === 'active' ? activeOrders : orders).length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No orders</p>
              </div>
            )}
          </div>

          {selectedOrder && (
            <div className="w-96 bg-white rounded-lg shadow p-5 sticky top-6 self-start">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{selectedOrder.order_number}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[selectedOrder.status] || 'bg-gray-100'}`}>
                    {selectedOrder.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                  <p className="text-gray-500">{selectedOrder.customer_phone}</p>
                  {selectedOrder.customer_email && <p className="text-gray-500">{selectedOrder.customer_email}</p>}
                </div>

                <div className="flex items-center gap-2">
                  {selectedOrder.fulfillment_type === 'delivery' ? <Truck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                  <span className="capitalize">{selectedOrder.fulfillment_type}</span>
                </div>

                {selectedOrder.delivery_address && (
                  <p className="text-gray-600 text-xs">{selectedOrder.delivery_address}</p>
                )}

                <div className="border-t pt-3">
                  <h4 className="font-medium mb-2">Items</h4>
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between py-1">
                      <span>{item.quantity}x {item.name}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    {selectedOrder.delivery_fee > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Delivery</span>
                        <span>{formatCurrency(selectedOrder.delivery_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="bg-yellow-50 p-2 rounded text-xs">
                    <span className="font-medium">Notes:</span> {selectedOrder.notes}
                  </div>
                )}

                {STATUS_FLOW[selectedOrder.status] && (
                  <div className="border-t pt-3">
                    <p className="font-medium mb-2">Update Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {STATUS_FLOW[selectedOrder.status].map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => updateStatus(selectedOrder.id, nextStatus)}
                          className={`px-3 py-1 rounded-lg text-xs capitalize ${
                            nextStatus === 'cancelled' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {nextStatus.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
