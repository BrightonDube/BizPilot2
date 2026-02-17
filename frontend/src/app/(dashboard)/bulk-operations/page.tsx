'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Upload, Download, DollarSign, Package, Trash2, Tag } from 'lucide-react';

type Tab = 'price' | 'stock' | 'category' | 'import-export';

interface StockAdjustment {
  product_id: string;
  quantity_change: number;
  reason: string;
}

export default function BulkOperationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('price');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Price update state
  const [productIds, setProductIds] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed' | 'increment'>('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState('');

  // Stock adjust state
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([
    { product_id: '', quantity_change: 0, reason: '' },
  ]);

  // Category assign state
  const [categoryProductIds, setCategoryProductIds] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handlePriceUpdate = async () => {
    setLoading(true);
    try {
      const ids = productIds.split(',').map((id) => id.trim()).filter(Boolean);
      const res = await apiClient.post('/bulk/price-update', {
        product_ids: ids,
        adjustment_type: adjustmentType,
        adjustment_value: parseFloat(adjustmentValue),
      });
      showMessage('success', `Updated prices for ${res.data.updated_count} products`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      showMessage('error', error.response?.data?.detail || 'Failed to update prices');
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjust = async () => {
    setLoading(true);
    try {
      const adjustments = stockAdjustments.filter((a) => a.product_id);
      const res = await apiClient.post('/bulk/stock-adjust', { adjustments });
      showMessage('success', `Adjusted stock for ${res.data.adjusted_count} items`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      showMessage('error', error.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryAssign = async () => {
    setLoading(true);
    try {
      const ids = categoryProductIds.split(',').map((id) => id.trim()).filter(Boolean);
      const res = await apiClient.post('/bulk/category-assign', {
        product_ids: ids,
        category_id: categoryId,
      });
      showMessage('success', `Assigned category to ${res.data.updated_count} products`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      showMessage('error', error.response?.data?.detail || 'Failed to assign category');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'products' | 'customers') => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/bulk/export/${type}`);
      const data = res.data;
      if (!data.length) {
        showMessage('error', 'No data to export');
        return;
      }
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map((row: Record<string, unknown>) => headers.map((h) => `"${row[h] ?? ''}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('success', `Exported ${data.length} ${type}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      showMessage('error', error.response?.data?.detail || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (type: 'products' | 'customers') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setLoading(true);
      try {
        const text = await file.text();
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) throw new Error('CSV must have header + data rows');
        const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((h, i) => {
            row[h] = values[i] || '';
          });
          return row;
        });
        const res = await apiClient.post(`/bulk/import/${type}`, { rows });
        showMessage('success', `Imported ${res.data.imported_count} ${type}`);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }; message?: string };
        showMessage('error', error.response?.data?.detail || (error as Error).message || 'Import failed');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'price', label: 'Price Update', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'stock', label: 'Stock Adjust', icon: <Package className="w-4 h-4" /> },
    { key: 'category', label: 'Category Assign', icon: <Tag className="w-4 h-4" /> },
    { key: 'import-export', label: 'Import/Export', icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Bulk Operations</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'price' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">Bulk Price Update</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product IDs (comma-separated)</label>
            <textarea
              value={productIds}
              onChange={(e) => setProductIds(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
              rows={3}
              placeholder="product-uuid-1, product-uuid-2, ..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as 'percentage' | 'fixed' | 'increment')}
                className="w-full border rounded-lg p-2 text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Price</option>
                <option value="increment">Increment (+/-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input
                type="number"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
                placeholder={adjustmentType === 'percentage' ? '10 for 10%' : '100.00'}
              />
            </div>
          </div>
          <button
            onClick={handlePriceUpdate}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Prices
          </button>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">Bulk Stock Adjustment</h2>
          {stockAdjustments.map((adj, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                <input
                  type="text"
                  value={adj.product_id}
                  onChange={(e) => {
                    const updated = [...stockAdjustments];
                    updated[i].product_id = e.target.value;
                    setStockAdjustments(updated);
                  }}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty Change</label>
                <input
                  type="number"
                  value={adj.quantity_change}
                  onChange={(e) => {
                    const updated = [...stockAdjustments];
                    updated[i].quantity_change = parseInt(e.target.value) || 0;
                    setStockAdjustments(updated);
                  }}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <input
                    type="text"
                    value={adj.reason}
                    onChange={(e) => {
                      const updated = [...stockAdjustments];
                      updated[i].reason = e.target.value;
                      setStockAdjustments(updated);
                    }}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => setStockAdjustments(stockAdjustments.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setStockAdjustments([...stockAdjustments, { product_id: '', quantity_change: 0, reason: '' }])}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + Add Row
          </button>
          <div>
            <button
              onClick={handleStockAdjust}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Adjust Stock
            </button>
          </div>
        </div>
      )}

      {activeTab === 'category' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">Bulk Category Assignment</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product IDs (comma-separated)</label>
            <textarea
              value={categoryProductIds}
              onChange={(e) => setCategoryProductIds(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category ID</label>
            <input
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>
          <button
            onClick={handleCategoryAssign}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Assign Category
          </button>
        </div>
      )}

      {activeTab === 'import-export' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold">Import / Export</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Products</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('products')}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleImport('products')}
                  disabled={loading}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
              </div>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Customers</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('customers')}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleImport('customers')}
                  disabled={loading}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
