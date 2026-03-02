"use client";

/**
 * IntegrationsPageClient — Unified management page for third-party integrations.
 *
 * Two tabs:
 *  1. Xero Accounting — OAuth2-based connection, sync log viewer
 *  2. WooCommerce — REST API credentials, sync map viewer
 *
 * Why a single page?
 * Integrations share the same UX pattern (connect → configure → monitor sync).
 * Keeping them in one page reduces navigation overhead and makes it easy to
 * see which integrations are active at a glance.
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
  ShoppingCart,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

/* ---------- types ---------- */

interface XeroConnection {
  id: string;
  business_id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

interface XeroSyncLog {
  id: string;
  entity_type: string;
  entity_id: string;
  direction: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface WooConnection {
  id: string;
  business_id: string;
  store_url: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

interface WooSyncMap {
  id: string;
  entity_type: string;
  local_entity_id: string;
  external_entity_id: string;
  direction: string;
  status: string;
  last_synced_at: string | null;
}

type Tab = "xero" | "woocommerce";

/* ---------- status badge helper ---------- */

function statusBadge(status: string) {
  switch (status) {
    case "active":
    case "synced":
      return <Badge variant="success">{status}</Badge>;
    case "pending":
    case "idle":
      return <Badge variant="secondary">{status}</Badge>;
    case "failed":
    case "disconnected":
    case "revoked":
      return <Badge variant="danger">{status}</Badge>;
    default:
      return <Badge variant="info">{status}</Badge>;
  }
}

/* ================================================================
 * MAIN COMPONENT
 * ================================================================ */

export default function IntegrationsPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>("xero");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "xero", label: "Xero Accounting", icon: <FileSpreadsheet className="h-4 w-4" /> },
    { key: "woocommerce", label: "WooCommerce", icon: <ShoppingCart className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Integrations"
        description="Connect and manage third-party services."
      />

      {/* Tab bar */}
      <div className="flex space-x-1 rounded-lg bg-gray-800 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "xero" && <XeroTab />}
      {activeTab === "woocommerce" && <WooCommerceTab />}
    </div>
  );
}

/* ================================================================
 * XERO TAB
 * ================================================================ */

function XeroTab() {
  const [connection, setConnection] = useState<XeroConnection | null>(null);
  const [syncLogs, setSyncLogs] = useState<XeroSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Form state for creating a new connection */
  const [showForm, setShowForm] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const connRes = await apiClient.get("/xero/connection");
      setConnection(connRes.data);

      const logsRes = await apiClient.get("/xero/sync-logs");
      setSyncLogs(Array.isArray(logsRes.data) ? logsRes.data : logsRes.data.items ?? []);
    } catch (err: any) {
      /* 404 means no connection yet — not an error */
      if (err?.response?.status === 404) {
        setConnection(null);
      } else {
        setError("Failed to load Xero data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConnect = async () => {
    try {
      await apiClient.post("/xero/connection", {
        tenant_id: tenantId || null,
        tenant_name: tenantName || null,
      });
      setShowForm(false);
      setTenantId("");
      setTenantName("");
      fetchData();
    } catch {
      setError("Failed to create Xero connection.");
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    try {
      await apiClient.delete("/xero/connection");
      setConnection(null);
      setSyncLogs([]);
    } catch {
      setError("Failed to disconnect Xero.");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Connection card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Xero Connection</h3>
              {connection ? (
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-400">
                  <span>Tenant: {connection.tenant_name ?? "—"}</span>
                  {statusBadge(connection.status)}
                  {connection.last_synced_at && (
                    <span>Last sync: {new Date(connection.last_synced_at).toLocaleString()}</span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-500">Not connected.</p>
              )}
            </div>

            <div className="flex gap-2">
              {connection ? (
                <>
                  <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Refresh
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                    <Unlink className="mr-1 h-3 w-3" /> Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                  <Link2 className="mr-1 h-3 w-3" /> Connect Xero
                </Button>
              )}
            </div>
          </div>

          {/* New connection form */}
          {showForm && !connection && (
            <div className="mt-4 space-y-3 rounded bg-gray-800 p-4">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Tenant ID (optional)</label>
                <Input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Xero organisation tenant ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Tenant Name (optional)</label>
                <Input
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="My Company"
                />
              </div>
              <Button size="sm" onClick={handleConnect}>Save Connection</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync logs table */}
      {syncLogs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-lg font-semibold text-white">Sync Logs</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Error</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">{log.entity_type} / {log.entity_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{log.direction}</td>
                      <td className="px-3 py-2">{statusBadge(log.status)}</td>
                      <td className="px-3 py-2 text-red-400">{log.error_message ?? "—"}</td>
                      <td className="px-3 py-2">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
 * WOOCOMMERCE TAB
 * ================================================================ */

function WooCommerceTab() {
  const [connection, setConnection] = useState<WooConnection | null>(null);
  const [syncMaps, setSyncMaps] = useState<WooSyncMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Form state */
  const [showForm, setShowForm] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const connRes = await apiClient.get("/woocommerce/connection");
      setConnection(connRes.data);

      const mapsRes = await apiClient.get("/woocommerce/sync-maps");
      setSyncMaps(Array.isArray(mapsRes.data) ? mapsRes.data : mapsRes.data.items ?? []);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setConnection(null);
      } else {
        setError("Failed to load WooCommerce data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConnect = async () => {
    if (!storeUrl) { setError("Store URL is required."); return; }
    try {
      await apiClient.post("/woocommerce/connection", {
        store_url: storeUrl,
        consumer_key: consumerKey || undefined,
        consumer_secret: consumerSecret || undefined,
      });
      setShowForm(false);
      setStoreUrl("");
      setConsumerKey("");
      setConsumerSecret("");
      fetchData();
    } catch {
      setError("Failed to create WooCommerce connection.");
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    try {
      await apiClient.delete("/woocommerce/connection");
      setConnection(null);
      setSyncMaps([]);
    } catch {
      setError("Failed to disconnect WooCommerce.");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Connection card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">WooCommerce Connection</h3>
              {connection ? (
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-400">
                  <span>{connection.store_url}</span>
                  {statusBadge(connection.status)}
                  {connection.last_synced_at && (
                    <span>Last sync: {new Date(connection.last_synced_at).toLocaleString()}</span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-500">Not connected.</p>
              )}
            </div>

            <div className="flex gap-2">
              {connection ? (
                <>
                  <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Refresh
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                    <Unlink className="mr-1 h-3 w-3" /> Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                  <Link2 className="mr-1 h-3 w-3" /> Connect Store
                </Button>
              )}
            </div>
          </div>

          {/* New connection form */}
          {showForm && !connection && (
            <div className="mt-4 space-y-3 rounded bg-gray-800 p-4">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Store URL *</label>
                <Input
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://mystore.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Consumer Key</label>
                <Input
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="ck_..."
                  type="password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Consumer Secret</label>
                <Input
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="cs_..."
                  type="password"
                />
              </div>
              <Button size="sm" onClick={handleConnect}>Save Connection</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync maps table */}
      {syncMaps.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-lg font-semibold text-white">Sync Maps</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="px-3 py-2">Entity Type</th>
                    <th className="px-3 py-2">Local ID</th>
                    <th className="px-3 py-2">External ID</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Last Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {syncMaps.map((m) => (
                    <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">{m.entity_type}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.local_entity_id.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.external_entity_id}</td>
                      <td className="px-3 py-2">{m.direction}</td>
                      <td className="px-3 py-2">{statusBadge(m.status)}</td>
                      <td className="px-3 py-2">
                        {m.last_synced_at ? new Date(m.last_synced_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
