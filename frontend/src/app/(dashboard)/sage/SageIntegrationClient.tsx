"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Sage Business Cloud Accounting Integration Client.
 *
 * Three-tab interface:
 * 1. Connection — OAuth status, connect/disconnect, toggle sync
 * 2. Mappings — BizPilot → Sage account mapping management
 * 3. Sync — History, errors, retry queue
 *
 * Why not embed in the existing /integrations page?
 * Sage has significantly more configuration surface (mappings, queue
 * management, error reports) than Xero/WooCommerce. A dedicated page
 * prevents the integrations page from becoming unwieldy.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import {
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from "@/components/ui";
import {
  Link2,
  Unlink,
  RefreshCw,
  Settings,
  History,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import axios from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionStatus {
  connected: boolean;
  status: string;
  company_id?: string;
  company_name?: string;
  last_sync_at?: string;
  sync_enabled: boolean;
}

interface Mapping {
  id: string;
  bizpilot_account_type: string;
  bizpilot_account_id?: string;
  sage_account_id: string;
  sage_account_name?: string;
  tax_code?: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  entity_type?: string;
  entity_id?: string;
  status: string;
  error_message?: string;
  created_at?: string;
}

interface QueueItem {
  id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string;
  priority: number;
  retry_count: number;
  status: string;
  error_message?: string;
  next_retry_at?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusBadge = (status: string): React.ReactElement => {
  const map: Record<string, "success" | "danger" | "warning" | "secondary"> = {
    connected: "success",
    disconnected: "secondary",
    expired: "warning",
    error: "danger",
    completed: "success",
    failed: "danger",
    pending: "warning",
    in_progress: "info" as any,
  };
  return <Badge variant={map[status] ?? "secondary"}>{status}</Badge>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SageIntegrationClient(): React.ReactElement {
  const [tab, setTab] = useState<"connection" | "mappings" | "sync">(
    "connection"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Connection tab
  const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null);

  // Mappings tab
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    bizpilot_account_type: "",
    sage_account_id: "",
    sage_account_name: "",
    tax_code: "",
  });

  // Sync tab
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const loadConnection = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/sage/status");
      setConnStatus(res.data);
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to load connection status"); }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMappings = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/sage/mappings");
      setMappings(res.data);
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to load mappings"); }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSync = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [historyRes, queueRes] = await Promise.all([
        apiClient.get("/api/sage/sync/history"),
        apiClient.get("/api/sage/sync/queue"),
      ]);
      setSyncHistory(historyRes.data.items ?? []);
      setQueue(queueRes.data);
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to load sync data"); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    if (tab === "connection") loadConnection();
    else if (tab === "mappings") loadMappings();
    else if (tab === "sync") loadSync();
  }, [tab, loadConnection, loadMappings, loadSync]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleDisconnect = async (): Promise<void> => {
    try {
      await apiClient.post("/api/sage/disconnect");
      loadConnection();
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to disconnect"); }
    }
  };

  const handleToggleSync = async (): Promise<void> => {
    if (!connStatus) return;
    try {
      await apiClient.post("/api/sage/toggle-sync", {
        enabled: !connStatus.sync_enabled,
      });
      loadConnection();
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to toggle sync"); }
    }
  };

  const handleSaveMapping = async (): Promise<void> => {
    try {
      await apiClient.post("/api/sage/mappings", mappingForm);
      setShowAddMapping(false);
      setMappingForm({
        bizpilot_account_type: "",
        sage_account_id: "",
        sage_account_name: "",
        tax_code: "",
      });
      loadMappings();
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to save mapping"); }
    }
  };

  const handleRetryQueueItem = async (id: string): Promise<void> => {
    try {
      await apiClient.post(`/api/sage/sync/queue/${id}/retry`);
      loadSync();
    } catch (err: any) {
      if (axios.isAxiosError(err)) { setError(err.response?.data?.detail || err.message); } else if (err instanceof Error) { setError(err.message); } else { setError("Failed to retry item"); }
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const tabs = [
    { key: "connection" as const, label: "Connection", icon: Link2 },
    { key: "mappings" as const, label: "Mappings", icon: Settings },
    { key: "sync" as const, label: "Sync History", icon: History },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Sage Integration" />

      {/* Tab navigation */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* ============== CONNECTION TAB ============== */}
          {tab === "connection" && connStatus && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Connection Status
                      </h3>
                      <p className="text-sm text-gray-400">
                        {connStatus.company_name ?? "Not connected"}
                      </p>
                    </div>
                    {statusBadge(connStatus.status)}
                  </div>

                  {connStatus.last_sync_at && (
                    <p className="text-sm text-gray-400 mb-4">
                      Last synced:{" "}
                      {new Date(connStatus.last_sync_at).toLocaleString()}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {connStatus.connected ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleToggleSync}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          {connStatus.sync_enabled
                            ? "Disable Auto-Sync"
                            : "Enable Auto-Sync"}
                        </Button>
                        <Button variant="destructive" onClick={handleDisconnect}>
                          <Unlink className="h-4 w-4 mr-1" /> Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button>
                        <Link2 className="h-4 w-4 mr-1" /> Connect to Sage
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============== MAPPINGS TAB ============== */}
          {tab === "mappings" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">
                  Account Mappings ({mappings.length})
                </h2>
                <Button onClick={() => setShowAddMapping(!showAddMapping)}>
                  + Add Mapping
                </Button>
              </div>

              {showAddMapping && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-gray-400">
                          BizPilot Account Type
                        </label>
                        <select
                          className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
                          value={mappingForm.bizpilot_account_type}
                          onChange={(e) =>
                            setMappingForm({
                              ...mappingForm,
                              bizpilot_account_type: e.target.value,
                            })
                          }
                        >
                          <option value="">Select...</option>
                          <option value="sales">Sales</option>
                          <option value="cogs">COGS</option>
                          <option value="expense">Expense</option>
                          <option value="inventory">Inventory</option>
                          <option value="receivable">Accounts Receivable</option>
                          <option value="payable">Accounts Payable</option>
                          <option value="cash">Cash</option>
                          <option value="vat">VAT</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">
                          Sage Account ID
                        </label>
                        <Input
                          placeholder="e.g. 4000"
                          value={mappingForm.sage_account_id}
                          onChange={(e) =>
                            setMappingForm({
                              ...mappingForm,
                              sage_account_id: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">
                          Sage Account Name
                        </label>
                        <Input
                          placeholder="e.g. Sales Revenue"
                          value={mappingForm.sage_account_name}
                          onChange={(e) =>
                            setMappingForm({
                              ...mappingForm,
                              sage_account_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Tax Code</label>
                        <Input
                          placeholder="e.g. T1"
                          value={mappingForm.tax_code}
                          onChange={(e) =>
                            setMappingForm({
                              ...mappingForm,
                              tax_code: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveMapping}>Save</Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddMapping(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {mappings.length === 0 ? (
                <p className="text-gray-400">
                  No mappings configured. Add mappings to start syncing.
                </p>
              ) : (
                <div className="space-y-2">
                  {mappings.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white capitalize">
                            {m.bizpilot_account_type}
                          </p>
                          <p className="text-sm text-gray-400">
                            → {m.sage_account_name ?? m.sage_account_id}
                            {m.tax_code && ` (Tax: ${m.tax_code})`}
                          </p>
                        </div>
                        <Badge variant="info">{m.sage_account_id}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============== SYNC TAB ============== */}
          {tab === "sync" && (
            <div className="space-y-6">
              {/* Queue section */}
              {queue.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">
                    Retry Queue ({queue.length})
                  </h3>
                  {queue.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {item.operation_type}
                            </span>
                            <Badge variant="secondary">
                              {item.entity_type}
                            </Badge>
                            {statusBadge(item.status)}
                          </div>
                          <p className="text-sm text-gray-400 mt-1">
                            Entity: {item.entity_id} · Retries:{" "}
                            {item.retry_count} · Priority: {item.priority}
                          </p>
                          {item.error_message && (
                            <p className="text-sm text-red-400 mt-1">
                              {item.error_message}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryQueueItem(item.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* History section */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">
                  Sync History
                </h3>
                {syncHistory.length === 0 ? (
                  <p className="text-gray-400">No sync operations yet.</p>
                ) : (
                  <div className="space-y-2">
                    {syncHistory.map((log) => (
                      <Card key={log.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {log.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : log.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            )}
                            <div>
                              <p className="text-sm text-white">
                                {log.sync_type}
                                {log.entity_type && ` · ${log.entity_type}`}
                              </p>
                              {log.error_message && (
                                <p className="text-xs text-red-400">
                                  {log.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString()
                              : ""}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
