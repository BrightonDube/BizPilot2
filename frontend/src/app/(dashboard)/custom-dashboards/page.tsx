'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Plus, LayoutDashboard, Trash2, Settings, BarChart3, Users, ShoppingCart, Package, TrendingUp, List, AlertTriangle } from 'lucide-react';

interface Widget {
  id: string;
  widget_type: string;
  title: string;
  config: Record<string, unknown> | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_shared: boolean;
  widgets: Widget[];
}

const WIDGET_TYPES = [
  { type: 'kpi_total_sales', label: 'Total Sales', icon: <TrendingUp className="w-4 h-4" /> },
  { type: 'kpi_total_orders', label: 'Total Orders', icon: <ShoppingCart className="w-4 h-4" /> },
  { type: 'kpi_total_customers', label: 'Total Customers', icon: <Users className="w-4 h-4" /> },
  { type: 'kpi_total_products', label: 'Total Products', icon: <Package className="w-4 h-4" /> },
  { type: 'chart_sales_trend', label: 'Sales Trend', icon: <BarChart3 className="w-4 h-4" /> },
  { type: 'chart_top_products', label: 'Top Products', icon: <BarChart3 className="w-4 h-4" /> },
  { type: 'list_recent_orders', label: 'Recent Orders', icon: <List className="w-4 h-4" /> },
  { type: 'list_low_stock', label: 'Low Stock Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
];

export default function CustomDashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [newDashName, setNewDashName] = useState('');
  const [newDashDesc, setNewDashDesc] = useState('');

  const fetchDashboards = useCallback(async () => {
    try {
      const res = await apiClient.get('/dashboards/');
      setDashboards(res.data);
      if (res.data.length > 0 && !activeDashboard) {
        setActiveDashboard(res.data[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeDashboard]);

  const fetchWidgetData = useCallback(async (widgets: Widget[]) => {
    const data: Record<string, unknown> = {};
    await Promise.all(
      widgets.map(async (w) => {
        try {
          const res = await apiClient.post('/dashboards/widgets/data', {
            widget_type: w.widget_type,
            config: w.config || {},
          });
          data[w.id] = res.data;
        } catch {
          data[w.id] = null;
        }
      })
    );
    setWidgetData(data);
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  useEffect(() => {
    if (activeDashboard?.widgets?.length) {
      fetchWidgetData(activeDashboard.widgets);
    }
  }, [activeDashboard, fetchWidgetData]);

  const createDashboard = async () => {
    try {
      const res = await apiClient.post('/dashboards/', { name: newDashName, description: newDashDesc || null });
      setDashboards([...dashboards, res.data]);
      setActiveDashboard(res.data);
      setShowCreateForm(false);
      setNewDashName('');
      setNewDashDesc('');
    } catch {
      // ignore
    }
  };

  const deleteDashboard = async (id: string) => {
    try {
      await apiClient.delete(`/dashboards/${id}`);
      const updated = dashboards.filter((d) => d.id !== id);
      setDashboards(updated);
      if (activeDashboard?.id === id) {
        setActiveDashboard(updated[0] || null);
      }
    } catch {
      // ignore
    }
  };

  const addWidget = async (widgetType: string, title: string) => {
    if (!activeDashboard) return;
    try {
      const res = await apiClient.post(`/dashboards/${activeDashboard.id}/widgets`, {
        widget_type: widgetType,
        title,
        config: {},
        position_x: 0,
        position_y: (activeDashboard.widgets?.length || 0) * 3,
        width: 4,
        height: 3,
      });
      const updatedDash = { ...activeDashboard, widgets: [...(activeDashboard.widgets || []), res.data] };
      setActiveDashboard(updatedDash);
      setDashboards(dashboards.map((d) => (d.id === updatedDash.id ? updatedDash : d)));
      setShowAddWidget(false);
      // Fetch data for the new widget
      const dataRes = await apiClient.post('/dashboards/widgets/data', {
        widget_type: widgetType,
        config: {},
      });
      setWidgetData({ ...widgetData, [res.data.id]: dataRes.data });
    } catch {
      // ignore
    }
  };

  const removeWidget = async (widgetId: string) => {
    if (!activeDashboard) return;
    try {
      await apiClient.delete(`/dashboards/widgets/${widgetId}`);
      const updatedWidgets = activeDashboard.widgets.filter((w) => w.id !== widgetId);
      const updatedDash = { ...activeDashboard, widgets: updatedWidgets };
      setActiveDashboard(updatedDash);
      setDashboards(dashboards.map((d) => (d.id === updatedDash.id ? updatedDash : d)));
    } catch {
      // ignore
    }
  };

  const renderWidgetContent = (widget: Widget) => {
    const data = widgetData[widget.id];
    if (data === undefined) return <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />;
    if (data === null) return <p className="text-gray-400 text-sm">Failed to load</p>;

    const d = data as Record<string, unknown>;

    if (widget.widget_type.startsWith('kpi_')) {
      return (
        <div className="text-center">
          <p className="text-3xl font-bold text-blue-600">
            {typeof d.value === 'number' ? d.value.toLocaleString('en-ZA', widget.widget_type.includes('sales') || widget.widget_type.includes('revenue') ? { style: 'currency', currency: 'ZAR' } : {}) : String(d.value ?? 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{d.label as string || widget.title}</p>
        </div>
      );
    }

    if (widget.widget_type.startsWith('chart_')) {
      const items = (d.data || d.items || []) as { label: string; value: number }[];
      if (!items.length) return <p className="text-gray-400 text-sm">No data</p>;
      const maxVal = Math.max(...items.map((i) => i.value), 1);
      return (
        <div className="space-y-1">
          {items.slice(0, 8).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-24 truncate text-gray-600">{item.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${(item.value / maxVal) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-gray-700">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }

    if (widget.widget_type.startsWith('list_')) {
      const items = (d.data || d.items || []) as Record<string, unknown>[];
      if (!items.length) return <p className="text-gray-400 text-sm">No items</p>;
      return (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex justify-between text-sm border-b pb-1">
              <span className="text-gray-700">{String(item.name || item.order_number || item.label || `Item ${i + 1}`)}</span>
              <span className="text-gray-500">{String(item.total || item.quantity || item.value || '')}</span>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-gray-400 text-sm">Unknown widget type</p>;
  };

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
          <LayoutDashboard className="w-6 h-6" />
          Custom Dashboards
        </h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Dashboard
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-medium mb-3">Create Dashboard</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Dashboard name"
              value={newDashName}
              onChange={(e) => setNewDashName(e.target.value)}
              className="border rounded-lg p-2 text-sm"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDashDesc}
              onChange={(e) => setNewDashDesc(e.target.value)}
              className="border rounded-lg p-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={createDashboard} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button>
            <button onClick={() => setShowCreateForm(false)} className="text-gray-500 px-4 py-1.5 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {dashboards.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {dashboards.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDashboard(d)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm ${
                activeDashboard?.id === d.id ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {d.name}
            </button>
          ))}
        </div>
      )}

      {activeDashboard ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">{activeDashboard.name}</h2>
              {activeDashboard.description && <p className="text-sm text-gray-500">{activeDashboard.description}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddWidget(true)}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Widget
              </button>
              <button
                onClick={() => deleteDashboard(activeDashboard.id)}
                className="text-red-500 hover:text-red-700 p-1.5"
                title="Delete dashboard"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showAddWidget && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h3 className="font-medium mb-3">Add Widget</h3>
              <div className="grid grid-cols-4 gap-3">
                {WIDGET_TYPES.map((wt) => (
                  <button
                    key={wt.type}
                    onClick={() => addWidget(wt.type, wt.label)}
                    className="border rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2 text-sm"
                  >
                    {wt.icon}
                    {wt.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddWidget(false)} className="text-gray-500 text-sm mt-3">Cancel</button>
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            {activeDashboard.widgets?.map((widget) => (
              <div
                key={widget.id}
                className="bg-white rounded-lg shadow p-4 col-span-4"
                style={{ gridColumn: `span ${Math.min(widget.width, 12)}` }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-medium text-gray-700">{widget.title}</h3>
                  <div className="flex gap-1">
                    <button className="text-gray-400 hover:text-gray-600">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeWidget(widget.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {renderWidgetContent(widget)}
              </div>
            ))}
          </div>

          {(!activeDashboard.widgets || activeDashboard.widgets.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No widgets yet. Click &quot;Add Widget&quot; to get started.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No dashboards yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
