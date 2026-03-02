'use client';

/**
 * PMS Integration management page.
 *
 * Provides connection management, charge history, and reconciliation
 * for hotel/lodge PMS integrations (Opera, Protel, Mews, Cloudbeds).
 *
 * Why tabs?
 * PMS operations span connections, charges, and reconciliation —
 * all tightly related.  Tabs keep the full context visible.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from '@/components/ui';
import {
  Plus,
  Hotel,
  CreditCard,
  ClipboardCheck,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PMSConnection {
  id: string;
  adapter_type: string;
  connection_name: string;
  host_url: string;
  is_active: boolean;
  health_status: string;
  last_health_check_at: string | null;
  created_at: string;
}

interface PMSCharge {
  id: string;
  room_number: string;
  guest_name: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created_at: string;
}

type Tab = 'connections' | 'charges' | 'reconciliation';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PMSPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('connections');
  const [connections, setConnections] = useState<PMSConnection[]>([]);
  const [charges, setCharges] = useState<PMSCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create connection form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('opera');
  const [formUrl, setFormUrl] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [connRes, chargeRes] = await Promise.all([
        apiClient.get('/api/v1/pms/connections'),
        apiClient.get('/api/v1/pms/charges'),
      ]);
      setConnections(connRes.data.items || []);
      setCharges(chargeRes.data.items || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load PMS data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateConnection = async () => {
    if (!formName.trim() || !formUrl.trim()) return;
    try {
      await apiClient.post('/api/v1/pms/connections', {
        connection_name: formName,
        adapter_type: formType,
        host_url: formUrl,
      });
      setFormName('');
      setFormUrl('');
      setShowCreateForm(false);
      fetchData();
    } catch {
      setError('Failed to create connection');
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/pms/connections/${id}`);
      fetchData();
    } catch {
      setError('Failed to delete connection');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount);
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'secondary' | 'info'> = {
      posted: 'success',
      pending: 'warning',
      failed: 'danger',
      reversed: 'secondary',
      healthy: 'success',
      unhealthy: 'danger',
      unknown: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const adapterIcon = (type: string) => {
    // All PMS types use the hotel icon
    return <Hotel className="h-4 w-4" />;
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'connections', label: 'Connections', icon: <Wifi className="h-4 w-4" /> },
    { key: 'charges', label: 'Charges', icon: <CreditCard className="h-4 w-4" /> },
    { key: 'reconciliation', label: 'Reconciliation', icon: <ClipboardCheck className="h-4 w-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="PMS Integration"
        description="Manage hotel property management system connections and room charges"
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setShowCreateForm(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {activeTab === 'connections' && `${connections.length} connection(s)`}
          {activeTab === 'charges' && `${charges.length} charge(s)`}
          {activeTab === 'reconciliation' && 'End-of-day reconciliation'}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {activeTab === 'connections' && (
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Connection
            </Button>
          )}
        </div>
      </div>

      {/* Create connection form */}
      {showCreateForm && activeTab === 'connections' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Add PMS Connection
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Connection Name
                </label>
                <Input
                  value={formName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                  placeholder="Main Hotel PMS"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  PMS Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
                >
                  <option value="opera">Oracle Opera</option>
                  <option value="protel">Protel</option>
                  <option value="mews">Mews</option>
                  <option value="cloudbeds">Cloudbeds</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Host URL
                </label>
                <Input
                  value={formUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormUrl(e.target.value)}
                  placeholder="https://pms.hotel.com/api"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateConnection}>
                Create Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connections tab */}
      {activeTab === 'connections' && (
        <div className="grid gap-4 md:grid-cols-2">
          {connections.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {adapterIcon(c.adapter_type)}
                    <span className="font-medium text-white">
                      {c.connection_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(c.health_status)}
                    {c.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>
                    <span className="text-gray-500">Type:</span>{' '}
                    {c.adapter_type.charAt(0).toUpperCase() + c.adapter_type.slice(1)}
                  </p>
                  <p>
                    <span className="text-gray-500">URL:</span>{' '}
                    <span className="font-mono text-xs">{c.host_url}</span>
                  </p>
                  {c.last_health_check_at && (
                    <p className="text-xs text-gray-500">
                      Last check: {new Date(c.last_health_check_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400"
                    onClick={() => handleDeleteConnection(c.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {connections.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No PMS connections configured. Click &quot;New Connection&quot; to add one.
            </p>
          )}
        </div>
      )}

      {/* Charges tab */}
      {activeTab === 'charges' && (
        <div className="space-y-2">
          {charges.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-3">Room</th>
                    <th className="text-left py-2 px-3">Guest</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((ch) => (
                    <tr
                      key={ch.id}
                      className="border-b border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="py-2 px-3 font-mono text-white">
                        {ch.room_number}
                      </td>
                      <td className="py-2 px-3 text-gray-300">
                        {ch.guest_name || '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-white font-medium">
                        {formatCurrency(ch.amount, ch.currency)}
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        {ch.description || '—'}
                      </td>
                      <td className="py-2 px-3">
                        {statusBadge(ch.status)}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {new Date(ch.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No charges recorded yet.
            </p>
          )}
        </div>
      )}

      {/* Reconciliation tab */}
      {activeTab === 'reconciliation' && (
        <Card>
          <CardContent className="p-6 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              End-of-Day Reconciliation
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Compare POS charges against PMS folio records to identify
              discrepancies. Select a connection and date to begin.
            </p>
            {connections.length > 0 ? (
              <Button size="sm">
                Start Reconciliation
              </Button>
            ) : (
              <p className="text-sm text-gray-500">
                Configure a PMS connection first to enable reconciliation.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
