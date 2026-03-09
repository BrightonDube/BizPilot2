'use client';

/**
 * Extended Reports page — tabbed view for COGS, Profit Margins,
 * User Activity (admin), and Login History (admin).
 *
 * Backend endpoints:
 *   GET /reports/user-activity
 *   GET /reports/login-history
 *   GET /reports/export/excel
 *   GET /inventory-reports/valuation   (COGS / profit margin data)
 *   GET /inventory-reports/turnover    (turnover analysis)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  Shield,
  Download,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  StatCard,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

/* ═══════════════════════════════════════════════════════════════════ */
/*  Types                                                             */
/* ═══════════════════════════════════════════════════════════════════ */

interface UserActivityItem {
  user_id: string;
  user_name: string;
  email: string;
  total_hours: number;
  total_entries: number;
  avg_hours_per_day: number;
  last_active: string | null;
}

interface LoginHistoryItem {
  session_id: string;
  user_name: string;
  email: string;
  login_at: string;
  logout_at: string | null;
  ip_address: string;
  user_agent: string;
  is_suspicious: boolean;
  reason: string | null;
}

interface ValuationItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  selling_price: number;
  profit_margin: number;
}

interface TurnoverItem {
  product_id: string;
  product_name: string;
  sku: string;
  sold_quantity: number;
  current_stock: number;
  turnover_rate: number;
  days_of_stock: number;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Tab definitions                                                   */
/* ═══════════════════════════════════════════════════════════════════ */

type TabKey = 'cogs' | 'margins' | 'activity' | 'logins';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { key: 'cogs', label: 'COGS & Valuation', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'margins', label: 'Profit Margins', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'activity', label: 'User Activity', icon: <Users className="w-4 h-4" />, adminOnly: true },
  { key: 'logins', label: 'Login History', icon: <Shield className="w-4 h-4" />, adminOnly: true },
];

/* ═══════════════════════════════════════════════════════════════════ */
/*  Formatting helpers                                                */
/* ═══════════════════════════════════════════════════════════════════ */

const fmt = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

/* ═══════════════════════════════════════════════════════════════════ */
/*  Component                                                         */
/* ═══════════════════════════════════════════════════════════════════ */

export default function ExtendedReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('cogs');
  const [dateRange, setDateRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);

  // COGS & valuation data
  const [valuation, setValuation] = useState<ValuationItem[]>([]);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationMethod, setValuationMethod] = useState('average');

  // Turnover / margin data
  const [turnover, setTurnover] = useState<TurnoverItem[]>([]);
  const [turnoverLoading, setTurnoverLoading] = useState(false);

  // User activity
  const [activity, setActivity] = useState<UserActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Login history
  const [logins, setLogins] = useState<LoginHistoryItem[]>([]);
  const [loginsLoading, setLoginsLoading] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /* ---- data fetchers ---- */

  const fetchValuation = useCallback(async () => {
    setValuationLoading(true);
    try {
      const { data } = await apiClient.get('/inventory-reports/valuation', {
        params: { method: valuationMethod },
      });
      setValuation(data?.items || data?.products || []);
    } catch {
      setValuation([]);
    } finally {
      setValuationLoading(false);
    }
  }, [valuationMethod]);

  const fetchTurnover = useCallback(async () => {
    setTurnoverLoading(true);
    try {
      const { data } = await apiClient.get('/inventory-reports/turnover', {
        params: { range: dateRange },
      });
      setTurnover(data?.items || data?.products || []);
    } catch {
      setTurnover([]);
    } finally {
      setTurnoverLoading(false);
    }
  }, [dateRange]);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const { data } = await apiClient.get('/reports/user-activity', {
        params: { range: dateRange },
      });
      setActivity(data?.items || []);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [dateRange]);

  const fetchLogins = useCallback(async () => {
    setLoginsLoading(true);
    try {
      const { data } = await apiClient.get('/reports/login-history', {
        params: { range: dateRange },
      });
      setLogins(data?.items || []);
    } catch {
      setLogins([]);
    } finally {
      setLoginsLoading(false);
    }
  }, [dateRange]);

  // Lazy-load data when tab changes
  useEffect(() => {
    if (activeTab === 'cogs') fetchValuation();
    else if (activeTab === 'margins') fetchTurnover();
    else if (activeTab === 'activity') fetchActivity();
    else if (activeTab === 'logins') fetchLogins();
  }, [activeTab, fetchValuation, fetchTurnover, fetchActivity, fetchLogins]);

  /* ---- export ---- */

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiClient.get('/reports/export/excel', {
        params: { range: dateRange, report_type: activeTab },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extended_report_${activeTab}_${dateRange}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silently fail — export not critical
    } finally {
      setIsExporting(false);
    }
  };

  /* ---- sort helper ---- */

  function sortedBy<T>(items: T[], field: string): T[] {
    if (!field) return items;
    return [...items].sort((a, b) => {
      const va = (a as Record<string, unknown>)[field];
      const vb = (b as Record<string, unknown>)[field];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va ?? '').localeCompare(String(vb ?? ''))
        : String(vb ?? '').localeCompare(String(va ?? ''));
    });
  }

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /*  Tab content renderers                                         */
  /* ═══════════════════════════════════════════════════════════════ */

  const renderCOGS = () => {
    if (valuationLoading) return <Spinner />;
    if (valuation.length === 0) return <EmptyState message="No valuation data" />;

    const totalValue = valuation.reduce((s, v) => s + (v.total_value || 0), 0);
    const totalCost = valuation.reduce((s, v) => s + (v.unit_cost || 0) * (v.quantity || 0), 0);

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Total Inventory Value"
            value={fmt.format(totalValue)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="Total COGS"
            value={fmt.format(totalCost)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="Products Tracked"
            value={String(valuation.length)}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Valuation method selector */}
        <div className="flex items-center gap-2 mb-4">
          <label htmlFor="val-method" className="text-sm text-gray-400">
            Valuation Method
          </label>
          <Select
            id="val-method"
            value={valuationMethod}
            onChange={(e) => setValuationMethod(e.target.value)}
            className="w-auto text-sm"
          >
            <option value="average">Weighted Average</option>
            <option value="fifo">FIFO</option>
            <option value="lifo">LIFO</option>
          </Select>
        </div>

        <ReportTable>
          <thead>
            <tr className="border-b border-gray-700">
              <SortHeader field="product_name">Product</SortHeader>
              <SortHeader field="sku">SKU</SortHeader>
              <SortHeader field="quantity">Qty</SortHeader>
              <SortHeader field="unit_cost">Unit Cost</SortHeader>
              <SortHeader field="total_value">Total Value</SortHeader>
              <SortHeader field="selling_price">Selling Price</SortHeader>
              <SortHeader field="profit_margin">Margin</SortHeader>
            </tr>
          </thead>
          <tbody>
            {sortedBy(valuation, sortField).map((item) => (
              <tr key={item.product_id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                <td className="px-4 py-3 text-sm text-white">{item.product_name}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{item.sku || '—'}</td>
                <td className="px-4 py-3 text-sm text-white">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-white">{fmt.format(item.unit_cost || 0)}</td>
                <td className="px-4 py-3 text-sm text-white">{fmt.format(item.total_value || 0)}</td>
                <td className="px-4 py-3 text-sm text-white">{fmt.format(item.selling_price || 0)}</td>
                <td className="px-4 py-3 text-sm">
                  <MarginBadge value={item.profit_margin} />
                </td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </>
    );
  };

  const renderMargins = () => {
    if (turnoverLoading) return <Spinner />;
    if (turnover.length === 0) return <EmptyState message="No turnover data" />;

    const avgTurnover = turnover.reduce((s, t) => s + (t.turnover_rate || 0), 0) / turnover.length;
    const lowStock = turnover.filter((t) => t.days_of_stock < 7).length;

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Avg Turnover Rate"
            value={avgTurnover.toFixed(2)}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            title="Low Stock Items"
            value={String(lowStock)}
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <StatCard
            title="Products Analyzed"
            value={String(turnover.length)}
            icon={<DollarSign className="w-5 h-5" />}
          />
        </div>

        <ReportTable>
          <thead>
            <tr className="border-b border-gray-700">
              <SortHeader field="product_name">Product</SortHeader>
              <SortHeader field="sku">SKU</SortHeader>
              <SortHeader field="sold_quantity">Sold</SortHeader>
              <SortHeader field="current_stock">Stock</SortHeader>
              <SortHeader field="turnover_rate">Turnover Rate</SortHeader>
              <SortHeader field="days_of_stock">Days of Stock</SortHeader>
            </tr>
          </thead>
          <tbody>
            {sortedBy(turnover, sortField).map((item) => (
              <tr key={item.product_id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                <td className="px-4 py-3 text-sm text-white">{item.product_name}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{item.sku || '—'}</td>
                <td className="px-4 py-3 text-sm text-white">{item.sold_quantity}</td>
                <td className="px-4 py-3 text-sm text-white">{item.current_stock}</td>
                <td className="px-4 py-3 text-sm text-white">{item.turnover_rate.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.days_of_stock < 7
                        ? 'bg-red-500/20 text-red-400'
                        : item.days_of_stock < 30
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {item.days_of_stock} days
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </>
    );
  };

  const renderActivity = () => {
    if (activityLoading) return <Spinner />;
    if (activity.length === 0) return <EmptyState message="No activity data" />;

    const totalHours = activity.reduce((s, a) => s + (a.total_hours || 0), 0);
    const avgHours = activity.length > 0 ? totalHours / activity.length : 0;

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Total Hours Logged"
            value={totalHours.toFixed(1)}
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard
            title="Avg Hours / Staff"
            value={avgHours.toFixed(1)}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Active Staff"
            value={String(activity.length)}
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        <ReportTable>
          <thead>
            <tr className="border-b border-gray-700">
              <SortHeader field="user_name">Staff Member</SortHeader>
              <SortHeader field="email">Email</SortHeader>
              <SortHeader field="total_hours">Total Hours</SortHeader>
              <SortHeader field="total_entries">Entries</SortHeader>
              <SortHeader field="avg_hours_per_day">Avg Hours/Day</SortHeader>
              <SortHeader field="last_active">Last Active</SortHeader>
            </tr>
          </thead>
          <tbody>
            {sortedBy(activity, sortField).map((item) => (
              <tr key={item.user_id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                <td className="px-4 py-3 text-sm text-white font-medium">{item.user_name}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{item.email}</td>
                <td className="px-4 py-3 text-sm text-white">{item.total_hours.toFixed(1)}h</td>
                <td className="px-4 py-3 text-sm text-white">{item.total_entries}</td>
                <td className="px-4 py-3 text-sm text-white">{item.avg_hours_per_day.toFixed(1)}h</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {item.last_active ? new Date(item.last_active).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </>
    );
  };

  const renderLogins = () => {
    if (loginsLoading) return <Spinner />;
    if (logins.length === 0) return <EmptyState message="No login history" />;

    const suspicious = logins.filter((l) => l.is_suspicious).length;

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Total Sessions"
            value={String(logins.length)}
            icon={<Shield className="w-5 h-5" />}
          />
          <StatCard
            title="Suspicious Logins"
            value={String(suspicious)}
            icon={<AlertTriangle className="w-5 h-5" />}
            changeType={suspicious > 0 ? 'negative' : 'positive'}
          />
          <StatCard
            title="Active Now"
            value={String(logins.filter((l) => !l.logout_at).length)}
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        <ReportTable>
          <thead>
            <tr className="border-b border-gray-700">
              <SortHeader field="user_name">User</SortHeader>
              <SortHeader field="login_at">Login</SortHeader>
              <SortHeader field="logout_at">Logout</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedBy(logins, sortField).map((item) => (
              <tr
                key={item.session_id}
                className={`border-b border-gray-700/50 hover:bg-gray-800/50 ${
                  item.is_suspicious ? 'bg-red-900/10' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-white">{item.user_name}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(item.login_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {item.logout_at ? new Date(item.logout_at).toLocaleString() : (
                    <span className="text-green-400">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{item.ip_address}</td>
                <td className="px-4 py-3 text-sm">
                  {item.is_suspicious ? (
                    <span className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      {item.reason || 'Suspicious'}
                    </span>
                  ) : (
                    <span className="text-green-400 text-xs">Normal</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      </>
    );
  };

  /* ═══════════════════════════════════════════════════════════════ */
  /*  Page layout                                                   */
  /* ═══════════════════════════════════════════════════════════════ */

  const renderTabContent = () => {
    switch (activeTab) {
      case 'cogs':
        return renderCOGS();
      case 'margins':
        return renderMargins();
      case 'activity':
        return renderActivity();
      case 'logins':
        return renderLogins();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extended Reports"
        description="COGS, profit margins, user activity, and login audit"
        actions={
          <div className="flex items-center gap-3">
            <label htmlFor="ext-date-range" className="sr-only">Date range</label>
            <Select
              id="ext-date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-auto text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </Select>
            <Button
              variant="outline"
              className="border-gray-700"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSortField(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.adminOnly && (
              <span className="text-[10px] bg-yellow-600/30 text-yellow-400 px-1.5 rounded">
                Admin
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">{renderTabContent()}</CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Shared UI helpers                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <p>{message}</p>
    </div>
  );
}

function ReportTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">{children}</table>
    </div>
  );
}

function MarginBadge({ value }: { value: number }) {
  const pct = (value * 100).toFixed(1);
  const color =
    value >= 0.3
      ? 'bg-green-500/20 text-green-400'
      : value >= 0.15
      ? 'bg-yellow-500/20 text-yellow-400'
      : 'bg-red-500/20 text-red-400';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{pct}%</span>;
}
