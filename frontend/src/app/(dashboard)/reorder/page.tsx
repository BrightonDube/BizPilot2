'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader, Badge, LoadingSpinner, EmptyState } from '@/components/ui/bizpilot';
import {
  Settings, AlertTriangle, ShoppingCart, Plus, Power, RefreshCw,
  ChevronDown, ChevronUp, Check, Package,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReorderRule {
  id: string;
  product_id: string;
  product_name: string;
  supplier_id: string;
  supplier_name: string;
  min_stock: number;
  reorder_qty: number;
  max_stock: number;
  lead_time_days: number;
  is_active: boolean;
}

interface StockAlert {
  product_id: string;
  product_name: string;
  current_stock: number;
  min_level: number;
  reorder_qty: number;
  supplier_name: string;
}

interface PurchaseRequestLine {
  id: string;
  product_name: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  total: number;
}

interface PurchaseRequest {
  id: string;
  reference: string;
  supplier_name: string;
  status: string;
  total: number;
  created_at: string;
  lines: PurchaseRequestLine[];
}

interface Product {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

type TabKey = 'rules' | 'alerts' | 'requests';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'rules', label: 'Rules', icon: <Settings className="w-4 h-4" /> },
  { key: 'alerts', label: 'Stock Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
  { key: 'requests', label: 'Purchase Requests', icon: <ShoppingCart className="w-4 h-4" /> },
];

const PR_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  ordered: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  received: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ReorderPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('rules');
  const [loading, setLoading] = useState(true);

  // Rules state
  const [rules, setRules] = useState<ReorderRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ruleForm, setRuleForm] = useState({
    product_id: '', supplier_id: '', min_stock: '', reorder_qty: '', max_stock: '', lead_time_days: '',
  });

  // Alerts state
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);

  // Purchase requests state
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, prodRes, suppRes] = await Promise.all([
        apiClient.get<{ items: ReorderRule[] }>('/reorder/rules'),
        apiClient.get<{ items: Product[] }>('/products?per_page=200'),
        apiClient.get<{ items: Supplier[] }>('/suppliers?per_page=200'),
      ]);
      setRules(rulesRes.data.items || []);
      setProducts(prodRes.data.items || []);
      setSuppliers(suppRes.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: StockAlert[] }>('/reorder/check-stock');
      setStockAlerts(res.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchPurchaseRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: PurchaseRequest[] }>('/reorder/purchase-requests');
      setPurchaseRequests(res.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'rules') fetchRules();
    else if (activeTab === 'alerts') fetchAlerts();
    else if (activeTab === 'requests') fetchPurchaseRequests();
  }, [activeTab, fetchRules, fetchAlerts, fetchPurchaseRequests]);

  const handleAddRule = async () => {
    if (!ruleForm.product_id || !ruleForm.supplier_id) return;
    try {
      await apiClient.post('/reorder/rules', {
        product_id: ruleForm.product_id,
        supplier_id: ruleForm.supplier_id,
        min_stock: parseInt(ruleForm.min_stock) || 0,
        reorder_qty: parseInt(ruleForm.reorder_qty) || 0,
        max_stock: parseInt(ruleForm.max_stock) || 0,
        lead_time_days: parseInt(ruleForm.lead_time_days) || 0,
      });
      setRuleForm({ product_id: '', supplier_id: '', min_stock: '', reorder_qty: '', max_stock: '', lead_time_days: '' });
      fetchRules();
    } catch { /* empty */ }
  };

  const handleToggleRule = async (id: string) => {
    try {
      await apiClient.patch(`/reorder/rules/${id}/toggle`);
      fetchRules();
    } catch { /* empty */ }
  };

  const handleAutoReorder = async () => {
    try {
      await apiClient.post('/reorder/auto-reorder');
      fetchAlerts();
    } catch { /* empty */ }
  };

  const handleGeneratePO = async (alert: StockAlert) => {
    try {
      await apiClient.post('/reorder/purchase-requests', {
        product_id: alert.product_id,
        quantity: alert.reorder_qty,
      });
      fetchAlerts();
    } catch { /* empty */ }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      await apiClient.patch(`/reorder/purchase-requests/${id}/approve`);
      fetchPurchaseRequests();
    } catch { /* empty */ }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automated Reordering"
        description="Manage reorder rules, stock alerts, and purchase requests"
        actions={
          <Button onClick={handleAutoReorder} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Auto-Reorder
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors
              ${activeTab === tab.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* ── Rules Tab ─────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'rules' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Add Reorder Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={ruleForm.product_id}
                onChange={(e) => setRuleForm({ ...ruleForm, product_id: e.target.value })}
                className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={ruleForm.supplier_id}
                onChange={(e) => setRuleForm({ ...ruleForm, supplier_id: e.target.value })}
                className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Min stock"
                value={ruleForm.min_stock}
                onChange={(e) => setRuleForm({ ...ruleForm, min_stock: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Input
                type="number"
                placeholder="Reorder qty"
                value={ruleForm.reorder_qty}
                onChange={(e) => setRuleForm({ ...ruleForm, reorder_qty: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Input
                type="number"
                placeholder="Max stock"
                value={ruleForm.max_stock}
                onChange={(e) => setRuleForm({ ...ruleForm, max_stock: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Input
                type="number"
                placeholder="Lead time (days)"
                value={ruleForm.lead_time_days}
                onChange={(e) => setRuleForm({ ...ruleForm, lead_time_days: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div className="mt-3">
              <Button onClick={handleAddRule} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Rule
              </Button>
            </div>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium px-6 py-3">Product</th>
                  <th className="text-left text-gray-400 font-medium px-6 py-3">Supplier</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Min Stock</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Reorder Qty</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Max Stock</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Lead Time</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-8">No reorder rules configured.</td></tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-6 py-3 text-white">{rule.product_name}</td>
                      <td className="px-6 py-3 text-gray-300">{rule.supplier_name}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{rule.min_stock}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{rule.reorder_qty}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{rule.max_stock}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{rule.lead_time_days}d</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            rule.is_active
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Stock Alerts Tab ──────────────────────────────────────────────── */}
      {!loading && activeTab === 'alerts' && (
        <div className="space-y-6">
          {stockAlerts.length === 0 ? (
            <EmptyState icon={Package} title="No Stock Alerts" description="All products are above minimum stock levels." />
          ) : (
            <Card className="bg-gray-800/50 border-gray-700 p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 font-medium px-6 py-3">Product</th>
                    <th className="text-right text-gray-400 font-medium px-4 py-3">Current Stock</th>
                    <th className="text-right text-gray-400 font-medium px-4 py-3">Min Level</th>
                    <th className="text-right text-gray-400 font-medium px-4 py-3">Reorder Qty</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Supplier</th>
                    <th className="text-center text-gray-400 font-medium px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAlerts.map((alert) => (
                    <tr key={alert.product_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-6 py-3 text-white font-medium">{alert.product_name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-red-400 font-mono font-medium">{alert.current_stock}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">{alert.min_level}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{alert.reorder_qty}</td>
                      <td className="px-4 py-3 text-gray-300">{alert.supplier_name}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          onClick={() => handleGeneratePO(alert)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" /> Generate PO
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ── Purchase Requests Tab ─────────────────────────────────────────── */}
      {!loading && activeTab === 'requests' && (
        <div className="space-y-6">
          {purchaseRequests.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No Purchase Requests" description="Purchase requests will appear here when generated." />
          ) : (
            <div className="space-y-3">
              {purchaseRequests.map((pr) => (
                <Card key={pr.id} className="bg-gray-800/50 border-gray-700 p-0 overflow-hidden">
                  <button
                    onClick={() => setExpandedRequest(expandedRequest === pr.id ? null : pr.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-white font-mono text-sm">{pr.reference}</span>
                      <span className="text-gray-400 text-sm">{pr.supplier_name}</span>
                      <span className="text-gray-400 text-sm">{formatDate(pr.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${PR_STATUS_COLORS[pr.status] || ''}`}>
                        {pr.status.charAt(0).toUpperCase() + pr.status.slice(1)}
                      </span>
                      <span className="text-white font-mono text-sm">{formatCurrency(pr.total)}</span>
                      {pr.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleApproveRequest(pr.id); }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                      {expandedRequest === pr.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedRequest === pr.id && pr.lines && (
                    <div className="border-t border-gray-700 px-4 pb-4">
                      <table className="w-full text-sm mt-2">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left py-2 font-medium">Product</th>
                            <th className="text-right py-2 font-medium">Quantity</th>
                            <th className="text-right py-2 font-medium">Received</th>
                            <th className="text-right py-2 font-medium">Unit Price</th>
                            <th className="text-right py-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pr.lines.map((line) => (
                            <tr key={line.id} className="border-t border-gray-700/50">
                              <td className="py-2 text-white">{line.product_name}</td>
                              <td className="py-2 text-right text-white font-mono">{line.quantity}</td>
                              <td className="py-2 text-right font-mono">
                                <span className={line.received_quantity >= line.quantity ? 'text-green-400' : 'text-yellow-400'}>
                                  {line.received_quantity}
                                </span>
                              </td>
                              <td className="py-2 text-right text-gray-300 font-mono">{formatCurrency(line.unit_price)}</td>
                              <td className="py-2 text-right text-white font-mono">{formatCurrency(line.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
