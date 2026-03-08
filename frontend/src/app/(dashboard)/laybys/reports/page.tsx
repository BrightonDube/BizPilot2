'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  Download,
  BarChart3,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ActiveReport {
  total_count: number;
  total_value: number;
  total_paid: number;
  total_outstanding: number;
}

interface OverdueLayby {
  layby_id: string;
  reference_number: string;
  customer_id: string;
  balance_due: number;
  next_payment_date: string | null;
  days_overdue: number;
}

interface OverdueReport {
  count: number;
  total_overdue_amount: number;
  laybys: OverdueLayby[];
}

interface AgingBucket {
  count: number;
  total_value: number;
  total_outstanding: number;
}

interface AgingReport {
  as_of: string;
  buckets: Record<string, AgingBucket>;
  total_active: number;
}

interface SummaryReport {
  start_date: string;
  end_date: string;
  created: { count: number; total_value: number };
  completed: { count: number };
  cancelled: { count: number };
  payments: { count: number; total: number };
  refunds: { total: number };
  active_snapshot: { count: number };
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/* ── Main component ────────────────────────────────────────────────────── */

export default function LaybyReportsPage() {
  const [activeReport, setActiveReport] = useState<ActiveReport | null>(null);
  const [overdueReport, setOverdueReport] = useState<OverdueReport | null>(null);
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const [active, overdue, aging, summary] = await Promise.all([
          apiClient.get<ActiveReport>('/laybys/reports/active'),
          apiClient.get<OverdueReport>('/laybys/reports/overdue'),
          apiClient.get<AgingReport>('/laybys/reports/aging'),
          apiClient.get<SummaryReport>('/laybys/reports/summary'),
        ]);
        setActiveReport(active.data);
        setOverdueReport(overdue.data);
        setAgingReport(aging.data);
        setSummaryReport(summary.data);
      } catch (err) {
        console.error('Error fetching layby reports:', err);
        setError('Failed to load reports. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleExport = useCallback(async (reportType: string) => {
    try {
      const response = await apiClient.get(`/laybys/reports/export`, {
        params: { report_type: reportType },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `layby_${reportType}_report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <AlertTriangle className="mx-auto h-10 w-10 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Layby Reports"
          description="View analytics, aging, overdue, and summary reports for laybys."
        />
        <Link href="/laybys">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Laybys
          </Button>
        </Link>
      </div>

      {/* ── Active Summary ──────────────────────────────────────────── */}
      {activeReport && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Active Laybys Summary
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('active')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatItem label="Total Active" value={activeReport.total_count.toString()} />
              <StatItem label="Total Value" value={formatCurrency(activeReport.total_value)} />
              <StatItem label="Total Paid" value={formatCurrency(activeReport.total_paid)} />
              <StatItem
                label="Outstanding"
                value={formatCurrency(activeReport.total_outstanding)}
                highlight
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Overdue ─────────────────────────────────────────────────── */}
      {overdueReport && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Overdue Laybys ({overdueReport.count})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('overdue')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Total overdue: {formatCurrency(overdueReport.total_overdue_amount)}
            </p>
            {overdueReport.laybys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue laybys 🎉</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Reference</th>
                      <th className="pb-2 pr-4">Balance Due</th>
                      <th className="pb-2 pr-4">Next Payment</th>
                      <th className="pb-2">Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueReport.laybys.map((lb) => (
                      <tr key={lb.layby_id} className="border-b">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/laybys/${lb.layby_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {lb.reference_number}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{formatCurrency(lb.balance_due)}</td>
                        <td className="py-2 pr-4">{lb.next_payment_date ?? '—'}</td>
                        <td className="py-2 text-red-600 font-medium">{lb.days_overdue}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Aging Report ────────────────────────────────────────────── */}
      {agingReport && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Aging Report
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('aging')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              As of {agingReport.as_of} · {agingReport.total_active} active laybys
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(agingReport.buckets).map(([name, bucket]) => (
                <div
                  key={name}
                  className="rounded-lg border p-4 text-center"
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {name.replace(/_/g, '–').replace('plus', '+')} days
                  </p>
                  <p className="text-xl font-bold">{bucket.count}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(bucket.total_outstanding)} outstanding
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Period Summary ──────────────────────────────────────────── */}
      {summaryReport && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Period Summary
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('summary')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {summaryReport.start_date} → {summaryReport.end_date}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatItem label="Created" value={summaryReport.created.count.toString()} sub={formatCurrency(summaryReport.created.total_value)} />
              <StatItem label="Completed" value={summaryReport.completed.count.toString()} />
              <StatItem label="Cancelled" value={summaryReport.cancelled.count.toString()} />
              <StatItem label="Payments" value={summaryReport.payments.count.toString()} sub={formatCurrency(summaryReport.payments.total)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <StatItem label="Refunds" value={formatCurrency(summaryReport.refunds.total)} />
              <StatItem label="Currently Active" value={summaryReport.active_snapshot.count.toString()} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Stat helper component ─────────────────────────────────────────────── */

function StatItem({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-red-600' : ''}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
