'use client';

/**
 * Stock Take Management page - Create, manage, and review stock take sessions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Play,
  Eye,
  CheckCircle,
  XCircle,
  Package,
  AlertTriangle,
  ArrowUpDown,
  Loader2,
  X,
  Save,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

// --- Interfaces ---

interface StockTakeSession {
  id: string;
  reference: string;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  item_count: number;
  notes?: string;
}

interface StockTakeCount {
  id: string;
  product_id: string;
  product_name: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number;
}

interface VarianceSummary {
  total_items: number;
  counted_items: number;
  items_with_variance: number;
  total_positive_variance: number;
  total_negative_variance: number;
  net_variance: number;
  variance_value: number;
}

// --- Status helpers ---

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Draft' },
  in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Progress' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// --- Main Page ---

export default function StockTakesPage() {
  const [sessions, setSessions] = useState<StockTakeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Count modal state
  const [countModalOpen, setCountModalOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<StockTakeSession | null>(null);
  const [counts, setCounts] = useState<StockTakeCount[]>([]);
  const [countsLoading, setCountsLoading] = useState(false);
  const [editedCounts, setEditedCounts] = useState<Record<string, number | null>>({});

  // Variance summary state
  const [varianceSummary, setVarianceSummary] = useState<VarianceSummary | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/stock-takes');
      setSessions(res.data.items || res.data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateDraft = async () => {
    try {
      setActionLoading('create');
      await apiClient.post('/stock-takes');
      await fetchSessions();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.post(`/stock-takes/${id}/start`);
      await fetchSessions();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.post(`/stock-takes/${id}/complete`);
      await fetchSessions();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.post(`/stock-takes/${id}/cancel`);
      await fetchSessions();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewCounts = async (session: StockTakeSession) => {
    setActiveSession(session);
    setCountModalOpen(true);
    setCountsLoading(true);
    setVarianceSummary(null);
    setEditedCounts({});
    try {
      const [countsRes, varianceRes] = await Promise.allSettled([
        apiClient.get(`/stock-takes/${session.id}/counts`),
        session.status === 'completed'
          ? apiClient.get(`/stock-takes/${session.id}/variance-summary`)
          : Promise.reject('not completed'),
      ]);
      if (countsRes.status === 'fulfilled') {
        setCounts(countsRes.value.data.items || countsRes.value.data);
      }
      if (varianceRes.status === 'fulfilled') {
        setVarianceSummary(varianceRes.value.data);
      }
    } catch {
      // silent
    } finally {
      setCountsLoading(false);
    }
  };

  const handleCountChange = (productId: string, value: string) => {
    const num = value === '' ? null : parseInt(value, 10);
    setEditedCounts((prev) => ({ ...prev, [productId]: num }));
  };

  const handleSaveCounts = async () => {
    if (!activeSession) return;
    try {
      setActionLoading('save-counts');
      const payload = Object.entries(editedCounts)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([product_id, counted_qty]) => ({ product_id, counted_qty }));
      if (payload.length > 0) {
        await apiClient.post(`/stock-takes/${activeSession.id}/counts`, { counts: payload });
      }
      await handleViewCounts(activeSession);
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Takes"
        description="Manage physical stock counts and reconcile inventory."
      />

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          onClick={handleCreateDraft}
          disabled={actionLoading === 'create'}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {actionLoading === 'create' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          New Stock Take
        </Button>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No stock take sessions yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4 text-white font-medium">{session.reference}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="px-6 py-4 text-gray-300">{formatDate(session.created_at)}</td>
                      <td className="px-6 py-4 text-gray-300">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {session.item_count}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {session.status === 'draft' && (
                            <button
                              onClick={() => handleStart(session.id)}
                              disabled={actionLoading === session.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors disabled:opacity-50"
                            >
                              <Play className="h-3.5 w-3.5" /> Start
                            </button>
                          )}
                          <button
                            onClick={() => handleViewCounts(session)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-md transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> Counts
                          </button>
                          {session.status === 'in_progress' && (
                            <button
                              onClick={() => handleComplete(session.id)}
                              disabled={actionLoading === session.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-md transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Complete
                            </button>
                          )}
                          {(session.status === 'draft' || session.status === 'in_progress') && (
                            <button
                              onClick={() => handleCancel(session.id)}
                              disabled={actionLoading === session.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Count Entry Modal */}
      {countModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Stock Counts — {activeSession.reference}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  <StatusBadge status={activeSession.status} />
                </p>
              </div>
              <button onClick={() => setCountModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Variance Summary (completed sessions) */}
            {varianceSummary && (
              <div className="px-6 pt-4">
                <Card className="bg-gray-700/40 border-gray-600">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4" /> Variance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Total Items</p>
                        <p className="text-white font-semibold">{varianceSummary.total_items}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Counted</p>
                        <p className="text-white font-semibold">{varianceSummary.counted_items}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">With Variance</p>
                        <p className="text-yellow-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {varianceSummary.items_with_variance}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Variance Value</p>
                        <p className={`font-semibold ${varianceSummary.variance_value < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {formatCurrency(varianceSummary.variance_value)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Counts table */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {countsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : counts.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No count items found.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-400 uppercase border-b border-gray-700 sticky top-0 bg-gray-800">
                    <tr>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 text-right">System Qty</th>
                      <th className="px-4 py-2 text-right">Counted Qty</th>
                      <th className="px-4 py-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {counts.map((item) => {
                      const currentCounted = editedCounts[item.product_id] !== undefined
                        ? editedCounts[item.product_id]
                        : item.counted_qty;
                      const variance = currentCounted !== null && currentCounted !== undefined
                        ? currentCounted - item.system_qty
                        : 0;
                      return (
                        <tr key={item.id} className="hover:bg-gray-700/20">
                          <td className="px-4 py-2.5 text-white">{item.product_name}</td>
                          <td className="px-4 py-2.5 text-gray-300 text-right">{item.system_qty}</td>
                          <td className="px-4 py-2.5 text-right">
                            {activeSession.status === 'in_progress' ? (
                              <input
                                type="number"
                                min="0"
                                value={currentCounted ?? ''}
                                onChange={(e) => handleCountChange(item.product_id, e.target.value)}
                                className="w-20 ml-auto bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-right text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            ) : (
                              <span className="text-gray-300">{item.counted_qty ?? '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className={`font-medium ${
                                variance > 0
                                  ? 'text-green-400'
                                  : variance < 0
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                              }`}
                            >
                              {variance > 0 ? '+' : ''}
                              {variance}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {activeSession.status === 'in_progress' && (
              <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
                <Button
                  onClick={() => setCountModalOpen(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCounts}
                  disabled={actionLoading === 'save-counts' || Object.keys(editedCounts).length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  {actionLoading === 'save-counts' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Counts
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
