"use client";

/**
 * Staff Targets Management Client
 *
 * Four-tab interface covering the full performance management lifecycle:
 * 1. Targets — CRUD for individual/team goals
 * 2. Leaderboard — ranked staff performance with metric selector
 * 3. Incentives — bonus/reward programs
 * 4. Performance — per-staff snapshot trends
 *
 * Why client component?
 * Targets require interactive features (create modal, progress bars,
 * metric toggling) that need browser-side state and event handling.
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
  Target,
  Trophy,
  TrendingUp,
  Users,
  Plus,
  Trash2,
  BarChart3,
  Award,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffTarget {
  id: string;
  user_id: string | null;
  team_id: string | null;
  target_type: string;
  period_type: string;
  period_start: string;
  period_end: string;
  target_value: number;
  achieved_value: number;
  status: string;
  notes: string | null;
}

interface TargetTemplate {
  id: string;
  name: string;
  target_type: string;
  period_type: string;
  default_value: number;
}

interface IncentiveProgram {
  id: string;
  name: string;
  incentive_type: string;
  target_type: string;
  target_value: number;
  reward_value: number | null;
  reward_description: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

interface LeaderboardEntry {
  user_id: string;
  metric_value: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    val
  );

const statusBadge = (status: string) => {
  const map: Record<string, "success" | "warning" | "danger" | "secondary"> = {
    active: "warning",
    achieved: "success",
    missed: "danger",
    cancelled: "secondary",
  };
  return <Badge variant={map[status] ?? "secondary"}>{status}</Badge>;
};

const progressPct = (achieved: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StaffTargetsClient() {
  // Tab state
  const [tab, setTab] = useState<
    "targets" | "leaderboard" | "incentives" | "performance"
  >("targets");

  // Targets tab
  const [targets, setTargets] = useState<StaffTarget[]>([]);
  const [templates, setTemplates] = useState<TargetTemplate[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Leaderboard tab
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [metric, setMetric] = useState("total_sales");

  // Incentives tab
  const [incentives, setIncentives] = useState<IncentiveProgram[]>([]);

  // Shared
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    target_type: "sales",
    period_type: "monthly",
    period_start: "",
    period_end: "",
    target_value: "",
    notes: "",
  });

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const loadTargets = useCallback(async () => {
    setLoading(true);
    try {
      const [targetsRes, templatesRes] = await Promise.all([
        apiClient.get("/api/staff-targets"),
        apiClient.get("/api/staff-targets/templates"),
      ]);
      setTargets(targetsRes.data.items ?? targetsRes.data);
      setTemplates(templatesRes.data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load targets");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/staff-targets/leaderboard", {
        params: { metric },
      });
      setLeaderboard(res.data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [metric]);

  const loadIncentives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/staff-targets/incentives");
      setIncentives(res.data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load incentives");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    setError(null);
    if (tab === "targets") loadTargets();
    else if (tab === "leaderboard") loadLeaderboard();
    else if (tab === "incentives") loadIncentives();
    else setLoading(false);
  }, [tab, loadTargets, loadLeaderboard, loadIncentives]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleCreateTarget = async () => {
    try {
      await apiClient.post("/api/staff-targets", {
        ...form,
        target_value: parseFloat(form.target_value) || 0,
      });
      setShowCreate(false);
      setForm({
        target_type: "sales",
        period_type: "monthly",
        period_start: "",
        period_end: "",
        target_value: "",
        notes: "",
      });
      loadTargets();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create target");
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await apiClient.delete(`/api/staff-targets/${id}`);
      loadTargets();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete target");
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const tabs = [
    { key: "targets" as const, label: "Targets", icon: Target },
    { key: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
    { key: "incentives" as const, label: "Incentives", icon: Award },
    { key: "performance" as const, label: "Performance", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Targets" />

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
          {/* ============== TARGETS TAB ============== */}
          {tab === "targets" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">
                  Active Targets ({targets.length})
                </h2>
                <Button onClick={() => setShowCreate(!showCreate)}>
                  <Plus className="h-4 w-4 mr-1" /> New Target
                </Button>
              </div>

              {/* Create form */}
              {showCreate && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-gray-400">Type</label>
                        <select
                          className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
                          value={form.target_type}
                          onChange={(e) =>
                            setForm({ ...form, target_type: e.target.value })
                          }
                        >
                          <option value="sales">Sales</option>
                          <option value="transactions">Transactions</option>
                          <option value="items">Items Sold</option>
                          <option value="revenue">Revenue</option>
                          <option value="customers">Customers</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Period</label>
                        <select
                          className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
                          value={form.period_type}
                          onChange={(e) =>
                            setForm({ ...form, period_type: e.target.value })
                          }
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Start</label>
                        <Input
                          type="date"
                          value={form.period_start}
                          onChange={(e) =>
                            setForm({ ...form, period_start: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">End</label>
                        <Input
                          type="date"
                          value={form.period_end}
                          onChange={(e) =>
                            setForm({ ...form, period_end: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">
                          Target Value
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g. 50000"
                          value={form.target_value}
                          onChange={(e) =>
                            setForm({ ...form, target_value: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Notes</label>
                        <Input
                          placeholder="Optional notes"
                          value={form.notes}
                          onChange={(e) =>
                            setForm({ ...form, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateTarget}>Create</Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowCreate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Templates quick-apply */}
              {templates.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">
                      Quick Apply Template
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {templates.map((t) => (
                        <Badge key={t.id} variant="info">
                          {t.name} — {t.target_type} ({t.period_type},{" "}
                          {formatCurrency(t.default_value)})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Target list */}
              {targets.length === 0 ? (
                <p className="text-gray-400">No targets found.</p>
              ) : (
                <div className="space-y-3">
                  {targets.map((t) => {
                    const pct = progressPct(t.achieved_value, t.target_value);
                    return (
                      <Card key={t.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white capitalize">
                                  {t.target_type}
                                </span>
                                {statusBadge(t.status)}
                                <Badge variant="secondary">
                                  {t.period_type}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-400">
                                {t.period_start} → {t.period_end}
                                {t.notes && ` · ${t.notes}`}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteTarget(t.id)}
                              className="text-gray-500 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">
                                {formatCurrency(t.achieved_value)} /{" "}
                                {formatCurrency(t.target_value)}
                              </span>
                              <span className="text-white font-medium">
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  pct >= 100
                                    ? "bg-green-500"
                                    : pct >= 75
                                    ? "bg-blue-500"
                                    : pct >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============== LEADERBOARD TAB ============== */}
          {tab === "leaderboard" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">
                  Leaderboard
                </h2>
                <select
                  className="bg-gray-700 text-white border border-gray-600 rounded p-1 text-sm"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  <option value="total_sales">Total Sales</option>
                  <option value="transaction_count">Transactions</option>
                  <option value="items_sold">Items Sold</option>
                  <option value="customers_served">Customers Served</option>
                </select>
              </div>

              {leaderboard.length === 0 ? (
                <p className="text-gray-400">
                  No performance data available yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <Card key={entry.user_id}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            entry.rank === 1
                              ? "bg-yellow-500 text-black"
                              : entry.rank === 2
                              ? "bg-gray-300 text-black"
                              : entry.rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-gray-600 text-white"
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            Staff {entry.user_id.slice(0, 8)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">
                            {metric === "total_sales"
                              ? formatCurrency(entry.metric_value)
                              : entry.metric_value.toLocaleString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============== INCENTIVES TAB ============== */}
          {tab === "incentives" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">
                Incentive Programs ({incentives.length})
              </h2>

              {incentives.length === 0 ? (
                <p className="text-gray-400">No incentive programs found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {incentives.map((inc) => (
                    <Card key={inc.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-white">{inc.name}</h3>
                          <Badge
                            variant={inc.is_active ? "success" : "secondary"}
                          >
                            {inc.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400 space-y-1">
                          <p className="capitalize">
                            Type: {inc.incentive_type} · Target:{" "}
                            {inc.target_type}
                          </p>
                          <p>
                            Goal: {formatCurrency(inc.target_value)}
                            {inc.reward_value &&
                              ` → Reward: ${formatCurrency(inc.reward_value)}`}
                          </p>
                          <p>
                            {inc.start_date}
                            {inc.end_date ? ` → ${inc.end_date}` : " (ongoing)"}
                          </p>
                          {inc.reward_description && (
                            <p className="italic">{inc.reward_description}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============== PERFORMANCE TAB ============== */}
          {tab === "performance" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">
                Performance Overview
              </h2>
              <Card>
                <CardContent className="p-6 text-center">
                  <BarChart3 className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">
                    Performance trends are generated from daily snapshots.
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    View individual staff performance via Leaderboard or Staff
                    Reports.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
