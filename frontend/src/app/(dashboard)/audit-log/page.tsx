'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Shield, LogIn, Download, BarChart3 } from 'lucide-react';

type Tab = 'activity' | 'logins' | 'summary';

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string | null;
  ip_address: string | null;
  created_at: string;
  user?: { full_name?: string; email?: string };
}

interface ActivitySummary {
  by_action: Record<string, number>;
  by_resource: Record<string, number>;
  by_user: { user_id: string; name: string; count: number }[];
  total: number;
}

export default function AuditLogPage() {
  const [tab, setTab] = useState<Tab>('activity');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 20 };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource_type = resourceFilter;
      const res = await apiClient.get('/audit/activity', { params });
      setEntries(res.data.items || res.data);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, actionFilter, resourceFilter]);

  const fetchLogins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/audit/login-history', { params: { page, per_page: 20 } });
      setEntries(res.data.items || res.data);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/audit/summary');
      setSummary(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'activity') fetchActivity();
    else if (tab === 'logins') fetchLogins();
    else fetchSummary();
  }, [tab, fetchActivity, fetchLogins, fetchSummary]);

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/audit/export');
      const data = res.data;
      if (!data.length) return;
      const headers = Object.keys(data[0]);
      const csv = [headers.join(','), ...data.map((r: Record<string, unknown>) => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'audit_log.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-ZA');
  const totalPages = Math.ceil(total / 20);

  const ACTION_COLORS: Record<string, string> = {
    login: 'bg-green-100 text-green-800', logout: 'bg-gray-100 text-gray-800',
    create: 'bg-blue-100 text-blue-800', update: 'bg-yellow-100 text-yellow-800',
    delete: 'bg-red-100 text-red-800', export: 'bg-purple-100 text-purple-800',
    void: 'bg-red-200 text-red-900', refund: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> Audit Log</h1>
        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {([['activity', 'Activity', <Shield key="a" className="w-4 h-4" />], ['logins', 'Login History', <LogIn key="l" className="w-4 h-4" />], ['summary', 'Summary', <BarChart3 key="s" className="w-4 h-4" />]] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => { setTab(key); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : tab === 'summary' && summary ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">By Action ({summary.total} total)</h3>
            {Object.entries(summary.by_action).map(([action, count]) => (
              <div key={action} className="flex justify-between py-1 text-sm"><span className="capitalize">{action}</span><span className="font-medium">{count}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">By Resource</h3>
            {Object.entries(summary.by_resource).map(([resource, count]) => (
              <div key={resource} className="flex justify-between py-1 text-sm"><span className="capitalize">{resource}</span><span className="font-medium">{count}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">Top Users</h3>
            {summary.by_user.slice(0, 10).map((u) => (
              <div key={u.user_id} className="flex justify-between py-1 text-sm"><span>{u.name}</span><span className="font-medium">{u.count}</span></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {tab === 'activity' && (
            <div className="flex gap-2 mb-4">
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} className="border rounded-lg p-2 text-sm">
                <option value="">All Actions</option>
                {['login','logout','create','update','delete','export','import','view','print','void','refund'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input type="text" placeholder="Resource type..." value={resourceFilter} onChange={e => { setResourceFilter(e.target.value); setPage(1); }} className="border rounded-lg p-2 text-sm" />
            </div>
          )}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-3">Time</th><th className="text-left p-3">User</th>
                <th className="text-left p-3">Action</th><th className="text-left p-3">Resource</th>
                <th className="text-left p-3">Description</th><th className="text-left p-3">IP</th>
              </tr></thead>
              <tbody>{entries.map(e => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{formatDate(e.created_at)}</td>
                  <td className="p-3">{e.user?.full_name || e.user?.email || '—'}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${ACTION_COLORS[e.action] || 'bg-gray-100'}`}>{e.action}</span></td>
                  <td className="p-3 capitalize">{e.resource_type}</td>
                  <td className="p-3 text-gray-500 max-w-xs truncate">{e.description || '—'}</td>
                  <td className="p-3 text-gray-400">{e.ip_address || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
