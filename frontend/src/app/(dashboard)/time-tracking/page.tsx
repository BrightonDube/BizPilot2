'use client';

/**
 * Time Tracking page - Clock in/out, view time entries, and payroll reports.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  Square,
  Coffee,
  Download,
  Calendar,
  Users,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

interface ClockStatus {
  is_clocked_in: boolean;
  entry_id?: string;
  clock_in?: string;
  is_on_break: boolean;
  break_start?: string;
}

interface TimeEntry {
  id: string;
  user_id: string;
  user_name?: string;
  clock_in?: string;
  clock_out?: string;
  hours_worked?: number;
  break_duration?: number;
  status: string;
  notes?: string;
  created_at?: string;
}

interface UserTimeSummary {
  user_id: string;
  date_from: string;
  date_to: string;
  total_hours: number;
  total_break_hours: number;
  days_worked: number;
  entries_count: number;
  average_hours_per_day: number;
}

interface PayrollReportItem {
  user_id: string;
  user_name: string;
  email: string;
  total_hours: number;
  total_break_hours: number;
  entries_count: number;
}

export default function TimeTrackingPage() {
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [mySummary, setMySummary] = useState<UserTimeSummary | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [payrollReport, setPayrollReport] = useState<PayrollReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState<'my-time' | 'all-entries' | 'payroll'>('my-time');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, summaryRes, entriesRes] = await Promise.all([
        apiClient.get('/time-entries/status'),
        apiClient.get('/time-entries/summary/me', { params: { date_from: getDateFrom(dateRange), date_to: new Date().toISOString().split('T')[0] } }),
        apiClient.get('/time-entries', { params: { per_page: 50 } }),
      ]);
      setClockStatus(statusRes.data);
      setMySummary(summaryRes.data);
      setEntries(entriesRes.data.items || []);
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const fetchPayrollReport = useCallback(async () => {
    try {
      const res = await apiClient.get('/time-entries/payroll-report', {
        params: { date_from: getDateFrom(dateRange), date_to: new Date().toISOString().split('T')[0] },
      });
      setPayrollReport(res.data.items || []);
    } catch {
      setPayrollReport([]);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'payroll') {
      fetchPayrollReport();
    }
  }, [activeTab, fetchPayrollReport]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    if (!clockStatus?.is_clocked_in || !clockStatus.clock_in) {
      setElapsedTime('00:00:00');
      return;
    }

    const updateElapsed = () => {
      const start = new Date(clockStatus.clock_in!).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [clockStatus?.is_clocked_in, clockStatus?.clock_in]);

  const getDateFrom = (range: string): string => {
    const now = new Date();
    switch (range) {
      case '7d': now.setDate(now.getDate() - 7); break;
      case '14d': now.setDate(now.getDate() - 14); break;
      case '30d': now.setDate(now.getDate() - 30); break;
      default: now.setDate(now.getDate() - 7);
    }
    return now.toISOString().split('T')[0];
  };

  const handleClockIn = async () => {
    setIsClocking(true);
    try {
      await apiClient.post('/time-entries/clock-in', {});
      await fetchData();
    } finally {
      setIsClocking(false);
    }
  };

  const handleClockOut = async () => {
    setIsClocking(true);
    try {
      await apiClient.post('/time-entries/clock-out', {});
      await fetchData();
    } finally {
      setIsClocking(false);
    }
  };

  const handleStartBreak = async () => {
    setIsClocking(true);
    try {
      await apiClient.post('/time-entries/break/start');
      await fetchData();
    } finally {
      setIsClocking(false);
    }
  };

  const handleEndBreak = async () => {
    setIsClocking(true);
    try {
      await apiClient.post('/time-entries/break/end');
      await fetchData();
    } finally {
      setIsClocking(false);
    }
  };

  const handleExportPayroll = async () => {
    setIsExporting(true);
    try {
      const res = await apiClient.get('/time-entries/payroll-report/export', {
        params: { date_from: getDateFrom(dateRange), date_to: new Date().toISOString().split('T')[0] },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_report_${getDateFrom(dateRange)}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const formatHours = (hours?: number) => {
    if (hours === undefined || hours === null) return '-';
    return `${hours.toFixed(2)} hrs`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      active: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <Play className="w-3 h-3" /> },
      completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <CheckCircle className="w-3 h-3" /> },
      approved: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <CheckCircle className="w-3 h-3" /> },
      pending_approval: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <AlertCircle className="w-3 h-3" /> },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <XCircle className="w-3 h-3" /> },
    };
    const style = styles[status] || styles.completed;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '14d', label: 'Last 14 days' },
    { value: '30d', label: 'Last 30 days' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Tracking"
        description="Track work hours and manage payroll"
        actions={
          <div className="flex items-center gap-3">
            <label htmlFor="date-range-select" className="sr-only">Select date range</label>
            <Select
              id="date-range-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-auto text-sm"
            >
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500" />
        </div>
      ) : (
        <>
          {/* Clock In/Out Card */}
          <Card className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-full ${clockStatus?.is_clocked_in ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                    <Clock className={`w-8 h-8 ${clockStatus?.is_clocked_in ? 'text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {clockStatus?.is_clocked_in ? 'Currently Working' : 'Not Clocked In'}
                    </h3>
                    {clockStatus?.is_clocked_in && (
                      <p className="text-3xl font-mono font-bold text-green-400">{elapsedTime}</p>
                    )}
                    {clockStatus?.is_on_break && (
                      <p className="text-sm text-yellow-400 flex items-center gap-1">
                        <Coffee className="w-4 h-4" /> On Break
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!clockStatus?.is_clocked_in ? (
                    <Button onClick={handleClockIn} disabled={isClocking} className="bg-green-600 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-2" />
                      Clock In
                    </Button>
                  ) : (
                    <>
                      {!clockStatus.is_on_break ? (
                        <Button onClick={handleStartBreak} disabled={isClocking} variant="outline" className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20">
                          <Coffee className="w-4 h-4 mr-2" />
                          Start Break
                        </Button>
                      ) : (
                        <Button onClick={handleEndBreak} disabled={isClocking} variant="outline" className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20">
                          <Coffee className="w-4 h-4 mr-2" />
                          End Break
                        </Button>
                      )}
                      <Button onClick={handleClockOut} disabled={isClocking} className="bg-red-600 hover:bg-red-700">
                        <Square className="w-4 h-4 mr-2" />
                        Clock Out
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {mySummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Timer className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-gray-400">Total Hours</p>
                      <p className="text-xl font-bold text-white">{mySummary.total_hours.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Coffee className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-sm text-gray-400">Break Hours</p>
                      <p className="text-xl font-bold text-white">{mySummary.total_break_hours.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm text-gray-400">Days Worked</p>
                      <p className="text-xl font-bold text-white">{mySummary.days_worked}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm text-gray-400">Avg Hours/Day</p>
                      <p className="text-xl font-bold text-white">{mySummary.average_hours_per_day.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-700 pb-2">
            <button
              onClick={() => setActiveTab('my-time')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'my-time' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              My Time Entries
            </button>
            <button
              onClick={() => setActiveTab('all-entries')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'all-entries' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All Entries
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'payroll' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Payroll Report
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'my-time' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  My Recent Time Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Clock In</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Clock Out</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Hours</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Break</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500">No time entries found</td>
                        </tr>
                      ) : (
                        entries.slice(0, 10).map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4 text-sm text-white">{entry.clock_in ? new Date(entry.clock_in).toLocaleDateString() : '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString() : '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : '-'}</td>
                            <td className="py-3 px-4 text-sm text-white font-medium">{formatHours(entry.hours_worked)}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{formatHours(entry.break_duration)}</td>
                            <td className="py-3 px-4">{getStatusBadge(entry.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'all-entries' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  All Team Time Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Employee</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Clock In</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Clock Out</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Hours</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500">No time entries found</td>
                        </tr>
                      ) : (
                        entries.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4 text-sm text-white">{entry.user_name || 'Unknown'}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{entry.clock_in ? new Date(entry.clock_in).toLocaleDateString() : '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString() : '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString() : '-'}</td>
                            <td className="py-3 px-4 text-sm text-white font-medium">{formatHours(entry.hours_worked)}</td>
                            <td className="py-3 px-4">{getStatusBadge(entry.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'payroll' && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  Payroll Report
                </CardTitle>
                <Button onClick={handleExportPayroll} disabled={isExporting} variant="outline" className="border-gray-600">
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export Excel'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Employee</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Total Hours</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Break Hours</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Net Hours</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollReport.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500">No payroll data for this period</td>
                        </tr>
                      ) : (
                        payrollReport.map((item) => (
                          <tr key={item.user_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4 text-sm text-white font-medium">{item.user_name}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{item.email}</td>
                            <td className="py-3 px-4 text-sm text-white">{item.total_hours.toFixed(2)}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{item.total_break_hours.toFixed(2)}</td>
                            <td className="py-3 px-4 text-sm text-green-400 font-medium">{(item.total_hours - item.total_break_hours).toFixed(2)}</td>
                            <td className="py-3 px-4 text-sm text-gray-300">{item.entries_count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
