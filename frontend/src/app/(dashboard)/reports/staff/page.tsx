'use client';

/**
 * Staff Reports page - Staff analytics with performance, attendance, department, and productivity views.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Users,
  Clock,
  CalendarCheck,
  Building2,
  TrendingUp,
  Timer,
  Coffee,
  AlertTriangle,
  UserCheck,
  UserX,
  BarChart3,
  Target,
  Search,
  DollarSign,
  FileText,
  Activity,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import { FeatureGate } from '@/components/subscription/FeatureGate';

type TabKey= 'performance' | 'attendance' | 'departments' | 'productivity' | 'commissions' | 'activity';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { key: 'performance', label: 'Performance', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-4 h-4" /> },
  { key: 'departments', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
  { key: 'productivity', label: 'Productivity', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'commissions', label: 'Commissions', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'activity', label: 'Activity Log', icon: <Activity className="w-4 h-4" /> },
];

function formatHours(value: number): string {
  return `${value.toLocaleString('en-ZA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  return {
    start: thirtyDaysAgo.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0],
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StaffReportsPage() {
  const defaults = getDefaultDates();
  const [activeTab, setActiveTab] = useState<TabKey>('performance');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [userId, setUserId] = useState('');
  const [commissionRate, setCommissionRate] = useState('5');
  const [actionType, setActionType] = useState('');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let res;
      const dateParams = { start_date: startDate, end_date: endDate };
      switch (activeTab) {
        case 'performance':
          res = await apiClient.get('/reports/staff/performance', {
            params: dateParams,
          });
          break;
        case 'attendance':
          res = await apiClient.get('/reports/staff/attendance', {
            params: { ...dateParams, ...(userId ? { user_id: userId } : {}) },
          });
          break;
        case 'departments':
          res = await apiClient.get('/reports/staff/departments', {
            params: dateParams,
          });
          break;
        case 'productivity':
          res = await apiClient.get('/reports/staff/productivity', {
            params: dateParams,
          });
          break;
        case 'commissions':
          res = await apiClient.get('/reports/staff/commissions', {
            params: { ...dateParams, commission_rate: parseFloat(commissionRate) || 5 },
          });
          break;
        case 'activity':
          res = await apiClient.get('/reports/staff/activity', {
            params: {
              ...dateParams,
              ...(userId ? { user_id: userId } : {}),
              ...(actionType ? { action_type: actionType } : {}),
            },
          });
          break;
      }
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch report data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, startDate, endDate, userId, commissionRate, actionType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <FeatureGate feature="reports">
    <div className="space-y-6">
      <PageHeader
        title="Staff Reports"
        description="Staff performance, attendance, and productivity analytics"
      />

      {/* Date Range Selector & Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm text-gray-400">
                From
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm text-gray-400">
                To
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {activeTab === 'attendance' && (
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
            {activeTab === 'commissions' && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="Commission %"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-28 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            )}
            {activeTab === 'activity' && (
              <>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter by User ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Actions</option>
                    <option value="login">Login</option>
                    <option value="logout">Logout</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="void">Void</option>
                    <option value="refund">Refund</option>
                    <option value="export">Export</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-800/50 border border-gray-700 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-red-400">{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          {activeTab === 'performance' && <PerformanceReport data={data} />}
          {activeTab === 'attendance' && <AttendanceReport data={data} />}
          {activeTab === 'departments' && <DepartmentsReport data={data} />}
          {activeTab === 'productivity' && <ProductivityReport data={data} />}
          {activeTab === 'commissions' && <CommissionsReport data={data} />}
          {activeTab === 'activity' && <ActivityLogReport data={data} />}
        </div>
      ) : null}
    </div>
    </FeatureGate>
  );
}

// --- Sub-components for each tab ---

function PerformanceReport({ data }: { data: any }) {
  const staff = data.staff ?? data.items ?? data ?? [];
  const list = Array.isArray(staff) ? staff : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Staff"
          value={data.total_staff ?? list.length ?? 0}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Hours Worked"
          value={formatHours(data.avg_hours_worked ?? 0)}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Total Overtime"
          value={formatHours(data.total_overtime ?? 0)}
          icon={<Timer className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Breaks"
          value={formatHours(data.avg_breaks ?? 0)}
          icon={<Coffee className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Staff Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Name', 'Hours Worked', 'Breaks', 'Overtime', 'Days Present']}
              rows={list.map((s: any) => [
                s.name ?? s.staff_name ?? s.full_name ?? '-',
                formatHours(s.hours_worked ?? 0),
                formatHours(s.breaks ?? s.break_hours ?? 0),
                formatHours(s.overtime ?? s.overtime_hours ?? 0),
                s.days_present ?? s.days_worked ?? 0,
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function AttendanceReport({ data }: { data: any }) {
  const records = data.records ?? data.attendance ?? data.items ?? data ?? [];
  const list = Array.isArray(records) ? records : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Records"
          value={data.total_records ?? list.length ?? 0}
          icon={<CalendarCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Present"
          value={data.total_present ?? 0}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Absent"
          value={data.total_absent ?? 0}
          icon={<UserX className="w-5 h-5" />}
        />
        <StatCard
          title="Late Arrivals"
          value={data.total_late ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-400" />
              Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Date', 'Name', 'Check In', 'Check Out', 'Hours', 'Status']}
              rows={list.map((r: any) => [
                r.date ?? '-',
                r.name ?? r.staff_name ?? r.full_name ?? '-',
                r.check_in ?? r.clock_in ?? '-',
                r.check_out ?? r.clock_out ?? '-',
                r.hours_worked != null ? formatHours(r.hours_worked) : '-',
                r.status ?? '-',
              ])}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No attendance records found</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function DepartmentsReport({ data }: { data: any }) {
  const departments = data.departments ?? data.items ?? data ?? [];
  const list = Array.isArray(departments) ? departments : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Departments"
          value={data.total_departments ?? list.length ?? 0}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          title="Total Staff"
          value={data.total_staff ?? 0}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Attendance"
          value={data.avg_attendance != null ? formatPercent(data.avg_attendance) : '-'}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Hours/Dept"
          value={data.avg_hours_per_department != null ? formatHours(data.avg_hours_per_department) : '-'}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-400" />
              Department Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Department', 'Staff Count', 'Total Hours', 'Avg Hours', 'Overtime', 'Attendance %']}
              rows={list.map((d: any) => [
                d.name ?? d.department_name ?? '-',
                d.staff_count ?? d.member_count ?? 0,
                formatHours(d.total_hours ?? 0),
                formatHours(d.avg_hours ?? d.average_hours ?? 0),
                formatHours(d.overtime ?? d.total_overtime ?? 0),
                d.attendance_rate != null ? formatPercent(d.attendance_rate) : '-',
              ])}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No department data available</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ProductivityReport({ data }: { data: any }) {
  const staff = data.staff ?? data.items ?? data ?? [];
  const list = Array.isArray(staff) ? staff : [];
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Avg Efficiency"
          value={data.avg_efficiency != null ? formatPercent(data.avg_efficiency) : '-'}
          icon={<Target className="w-5 h-5" />}
        />
        <StatCard
          title="Top Performer"
          value={data.top_performer ?? '-'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Avg Tasks/Day"
          value={data.avg_tasks_per_day?.toFixed(1) ?? '-'}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <StatCard
          title="Total Staff"
          value={data.total_staff ?? list.length ?? 0}
          icon={<Users className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-yellow-400" />
              Staff Productivity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Name', 'Tasks Completed', 'Efficiency', 'Hours Worked', 'Output/Hour']}
              rows={list.map((s: any) => [
                s.name ?? s.staff_name ?? s.full_name ?? '-',
                s.tasks_completed ?? s.tasks ?? 0,
                s.efficiency != null ? formatPercent(s.efficiency) : '-',
                formatHours(s.hours_worked ?? 0),
                s.output_per_hour?.toFixed(1) ?? s.tasks_per_hour?.toFixed(1) ?? '-',
              ])}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No productivity data available</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function CommissionsReport({ data }: { data: any }) {
  const staff = data.staff ?? [];
  const list = Array.isArray(staff) ? staff : [];

  function formatCurrency(value: number): string {
    return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Staff"
          value={data.total_staff ?? list.length ?? 0}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Total Sales"
          value={formatCurrency(data.total_sales ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Total Commissions"
          value={formatCurrency(data.total_commissions ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Commission Rate"
          value={`${data.commission_rate ?? 0}%`}
          icon={<Target className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Commission Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Rank', 'Name', 'Orders', 'Total Sales', 'Commission']}
              rows={list.map((s: any) => [
                s.rank ?? '-',
                s.staff_name ?? '-',
                s.order_count ?? 0,
                formatCurrency(s.total_sales ?? 0),
                formatCurrency(s.commission_amount ?? 0),
              ])}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No commission data available for this period</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ActivityLogReport({ data }: { data: any }) {
  const entries = data.entries ?? [];
  const list = Array.isArray(entries) ? entries : [];
  const summary = data.action_summary ?? {};

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events"
          value={data.total ?? list.length ?? 0}
          icon={<Activity className="w-5 h-5" />}
        />
        <StatCard
          title="Creates"
          value={summary.create ?? 0}
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          title="Logins"
          value={summary.login ?? 0}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          title="Voids/Refunds"
          value={(summary.void ?? 0) + (summary.refund ?? 0)}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>
      {list.length > 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Activity Log (Page {data.page ?? 1} of {data.pages ?? 1})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['Timestamp', 'Staff', 'Action', 'Resource', 'Description']}
              rows={list.map((e: any) => [
                e.timestamp ? new Date(e.timestamp).toLocaleString() : '-',
                e.staff_name ?? '-',
                e.action ?? '-',
                e.resource_type ?? '-',
                e.description ?? '-',
              ])}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No activity log entries found</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// --- Reusable table component ---

function DataTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-700/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-200 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
