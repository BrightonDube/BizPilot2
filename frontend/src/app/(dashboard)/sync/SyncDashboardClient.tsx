"use client";

/**
 * SyncDashboardClient — Monitoring page for the offline sync queue.
 *
 * Two sections:
 *  1. Sync Queue — pending/failed items with retry capability
 *  2. Sync Metadata — watermarks showing last sync per entity type
 *
 * Why a dedicated sync page?
 * Offline-first architecture needs visibility into sync health.
 * Operators need to see failed items, retry them, and confirm
 * that all entity types are syncing regularly.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from "@/components/ui";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Database,
} from "lucide-react";

/* ---------- types ---------- */

interface SyncQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

interface SyncMetadata {
  id: string;
  entity_type: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  records_synced: number;
}

/* ---------- status helper ---------- */

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="success">{status}</Badge>;
    case "pending":
      return <Badge variant="secondary">{status}</Badge>;
    case "processing":
      return <Badge variant="info">{status}</Badge>;
    case "failed":
      return <Badge variant="danger">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

/* ================================================================ */

export default function SyncDashboardClient() {
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [metadata, setMetadata] = useState<SyncMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [queueRes, metaRes] = await Promise.all([
        apiClient.get("/sync/queue"),
        apiClient.get("/sync/metadata"),
      ]);
      setQueueItems(
        Array.isArray(queueRes.data) ? queueRes.data : queueRes.data.items ?? []
      );
      setMetadata(Array.isArray(metaRes.data) ? metaRes.data : []);
    } catch {
      setError("Failed to load sync data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRetryAll = async () => {
    try {
      await apiClient.post("/sync/queue/retry-failed");
      fetchData();
    } catch {
      setError("Failed to retry failed items.");
    }
  };

  if (loading) return <LoadingSpinner />;

  const failedCount = queueItems.filter((i) => i.status === "failed").length;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sync Dashboard"
        description="Monitor offline sync queue and metadata watermarks."
      />

      {error && (
        <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
        {failedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={handleRetryAll}>
            <RotateCcw className="mr-1 h-3 w-3" /> Retry {failedCount} Failed
          </Button>
        )}
      </div>

      {/* Sync Metadata */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Database className="h-5 w-5" /> Sync Metadata
          </h3>
          {metadata.length === 0 ? (
            <p className="text-sm text-gray-500">No sync metadata yet. Sync will populate this after first run.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="px-3 py-2">Entity Type</th>
                    <th className="px-3 py-2">Last Sync</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Records Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {metadata.map((m) => (
                    <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2 font-medium">{m.entity_type}</td>
                      <td className="px-3 py-2">
                        {m.last_sync_at ? new Date(m.last_sync_at).toLocaleString() : "Never"}
                      </td>
                      <td className="px-3 py-2">
                        {m.last_sync_status ? statusBadge(m.last_sync_status) : "—"}
                      </td>
                      <td className="px-3 py-2">{m.records_synced.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Queue */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Clock className="h-5 w-5" /> Pending Queue ({queueItems.length})
          </h3>
          {queueItems.length === 0 ? (
            <p className="text-sm text-gray-500">No pending sync items. All caught up!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Error</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">{item.entity_type} / {item.entity_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{item.action}</td>
                      <td className="px-3 py-2">{statusBadge(item.status)}</td>
                      <td className="px-3 py-2">{item.attempts}</td>
                      <td className="px-3 py-2 text-red-400 max-w-xs truncate">{item.last_error ?? "—"}</td>
                      <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
