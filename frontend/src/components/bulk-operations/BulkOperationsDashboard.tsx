'use client';

/**
 * BulkOperationsDashboard — lists tracked bulk operations with real-time
 * progress, status badges, and actions (cancel, rollback, view items).
 *
 * Why a separate component? The existing page.tsx handles "fire-and-forget"
 * operations.  Tracked operations have a lifecycle (pending → processing →
 * completed/failed/cancelled) and need polling + richer UI, so they live
 * in their own component to keep the page manageable.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Loader2,
  RefreshCw,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface BulkOperationSummary {
  id: string;
  operation_type: string;
  status: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  created_at: string;
  completed_at: string | null;
  parameters: Record<string, unknown>;
}

interface OperationItem {
  id: string;
  record_id: string;
  status: string;
  error_message: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Map operation status to a colour-coded badge. */
function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-3 h-3" /> },
    validating: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    processing: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Play className="w-3 h-3" /> },
    completed: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="w-3 h-3" /> },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <XCircle className="w-3 h-3" /> },
    rolling_back: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <RotateCcw className="w-3 h-3 animate-spin" /> },
  };
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.icon}
      {status}
    </span>
  );
}

/** Format a date string into a readable locale string. */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

/** Calculate progress percentage safely. */
function progressPct(op: BulkOperationSummary): number {
  if (op.total_records === 0) return 0;
  return Math.min(100, Math.round((op.processed_records / op.total_records) * 100));
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function BulkOperationsDashboard() {
  const [operations, setOperations] = useState<BulkOperationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<OperationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch the list of tracked operations. */
  const fetchOperations = useCallback(async () => {
    try {
      const res = await apiClient.get('/bulk/operations', { params: { page: 1, per_page: 50 } });
      setOperations(res.data.items ?? res.data ?? []);
      setError(null);
    } catch {
      setError('Failed to load operations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperations();
    // Poll every 10 seconds for live progress updates
    const interval = setInterval(fetchOperations, 10_000);
    return () => clearInterval(interval);
  }, [fetchOperations]);

  /* Fetch items for an expanded operation. */
  const toggleExpand = async (opId: string) => {
    if (expandedId === opId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(opId);
    setItemsLoading(true);
    try {
      const res = await apiClient.get(`/bulk/operations/${opId}/items`);
      setItems(res.data.items ?? res.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  /* Cancel a running operation. */
  const handleCancel = async (opId: string) => {
    try {
      await apiClient.post(`/bulk/operations/${opId}/cancel`);
      fetchOperations();
    } catch {
      setError('Failed to cancel operation');
    }
  };

  /* Rollback a completed operation. */
  const handleRollback = async (opId: string) => {
    try {
      await apiClient.post(`/bulk/operations/${opId}/rollback`);
      fetchOperations();
    } catch {
      setError('Failed to rollback operation');
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading operations…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tracked Operations</h2>
        <button
          onClick={fetchOperations}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>
      )}

      {operations.length === 0 ? (
        <p className="text-gray-500 text-sm">No tracked operations yet.</p>
      ) : (
        <div className="space-y-3">
          {operations.map((op) => (
            <div key={op.id} className="bg-white border rounded-lg shadow-sm">
              {/* Summary row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(op.id)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">
                        {op.operation_type.replace(/_/g, ' ')}
                      </span>
                      {statusBadge(op.status)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{fmtDate(op.created_at)}</div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 max-w-xs">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{op.processed_records}/{op.total_records}</span>
                      <span>{progressPct(op)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          op.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progressPct(op)}%` }}
                      />
                    </div>
                    {op.failed_records > 0 && (
                      <div className="text-xs text-red-600 mt-0.5">
                        {op.failed_records} failed
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {['pending', 'processing', 'validating'].includes(op.status) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(op.id); }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Cancel"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  {op.status === 'completed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRollback(op.id); }}
                      className="text-orange-500 hover:text-orange-700 p-1"
                      title="Rollback"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {expandedId === op.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded items detail */}
              {expandedId === op.id && (
                <div className="border-t px-4 py-3 bg-gray-50">
                  {itemsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading items…
                    </div>
                  ) : items.length === 0 ? (
                    <p className="text-sm text-gray-500">No item details available.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-4">Record ID</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 pr-4">Before</th>
                            <th className="pb-2 pr-4">After</th>
                            <th className="pb-2">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-4 font-mono text-gray-700 truncate max-w-[120px]">
                                {item.record_id?.slice(0, 8)}…
                              </td>
                              <td className="py-1.5 pr-4">{statusBadge(item.status)}</td>
                              <td className="py-1.5 pr-4 text-gray-600 truncate max-w-[150px]">
                                {item.before_data ? JSON.stringify(item.before_data) : '—'}
                              </td>
                              <td className="py-1.5 pr-4 text-gray-600 truncate max-w-[150px]">
                                {item.after_data ? JSON.stringify(item.after_data) : '—'}
                              </td>
                              <td className="py-1.5 text-red-600 truncate max-w-[200px]">
                                {item.error_message ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
