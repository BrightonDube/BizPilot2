"use client";

/**
 * CommissionsPageClient — Staff commission management.
 *
 * Three main actions:
 * 1. View/filter commission records (pending/approved/rejected)
 * 2. Generate commissions from sales data for a date range
 * 3. Approve/reject pending records, export for payroll
 *
 * Why a dedicated commissions page?
 * Commission management is a distinct financial workflow that managers
 * perform periodically (weekly/monthly). It needs its own UI with
 * bulk actions and clear status visibility.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  PageHeader,
  LoadingSpinner,
} from "@/components/ui";
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Play,
} from "lucide-react";

/* ---------- types ---------- */

interface CommissionRecord {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  commission_amount: number;
  status: string;
  created_at: string;
}

/* ---------- helpers ---------- */

const formatZAR = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge variant="success">{status}</Badge>;
    case "pending":
      return <Badge variant="warning">{status}</Badge>;
    case "rejected":
      return <Badge variant="danger">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

/* ================================================================ */

export default function CommissionsPageClient() {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Generate form
  const [showGenerate, setShowGenerate] = useState(false);
  const [genStart, setGenStart] = useState("");
  const [genEnd, setGenEnd] = useState("");
  const [generating, setGenerating] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page: 1, per_page: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await apiClient.get("/commissions", { params });
      setRecords(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setError("Failed to load commission records.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleGenerate = async () => {
    if (!genStart || !genEnd) return;
    setGenerating(true);
    try {
      await apiClient.post("/commissions/generate", {
        period_start: genStart,
        period_end: genEnd,
      });
      setShowGenerate(false);
      fetchRecords();
    } catch {
      setError("Failed to generate commissions.");
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selected.size === 0) return;
    try {
      await apiClient.post(`/commissions/${action}`, {
        record_ids: Array.from(selected),
      });
      setSelected(new Set());
      fetchRecords();
    } catch {
      setError(`Failed to ${action} records.`);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  };

  const pendingTotal = records
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.commission_amount, 0);
  const approvedTotal = records
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + r.commission_amount, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Commissions"
        description="Generate, review, and approve staff commission records."
      />

      {error && (
        <div className="rounded bg-red-900/40 p-3 text-sm text-red-300">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Total Records</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Pending Amount</p>
            <p className="text-2xl font-bold text-yellow-400">{formatZAR(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Approved Amount</p>
            <p className="text-2xl font-bold text-green-400">{formatZAR(approvedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowGenerate(!showGenerate)}>
          <Play className="mr-1 h-3 w-3" /> Generate
        </Button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {selected.size > 0 && (
          <>
            <Button variant="default" size="sm" onClick={() => handleBulkAction("approve")}>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Approve ({selected.size})
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleBulkAction("reject")}>
              <XCircle className="mr-1 h-3 w-3" /> Reject ({selected.size})
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={fetchRecords}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Generate form */}
      {showGenerate && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h4 className="text-sm font-semibold text-white">Generate Commissions</h4>
            <div className="flex gap-3">
              <Input
                type="date"
                value={genStart}
                onChange={(e) => setGenStart(e.target.value)}
                placeholder="Period Start"
              />
              <Input
                type="date"
                value={genEnd}
                onChange={(e) => setGenEnd(e.target.value)}
                placeholder="Period End"
              />
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records table */}
      <Card>
        <CardContent className="p-4">
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No commission records. Use &quot;Generate&quot; to create records from sales data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="border-b border-gray-700 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.size === records.length}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{r.user_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{r.period_start} → {r.period_end}</td>
                      <td className="px-3 py-2">{formatZAR(r.commission_amount)}</td>
                      <td className="px-3 py-2">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
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
