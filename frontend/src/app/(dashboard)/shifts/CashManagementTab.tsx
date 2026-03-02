"use client";

/**
 * CashManagementTab — Cash movement tracking for active shifts.
 *
 * Displays cash drops, paid-outs, and pay-ins for the current shift.
 * Operators can record new movements with amounts and reasons.
 *
 * Why a separate component?
 * The shift page is already ~190 lines. Cash management is a distinct
 * concern with its own state and API calls. Separating it keeps both
 * components maintainable and testable.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  LoadingSpinner,
} from "@/components/ui";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  DollarSign,
  Plus,
  RefreshCw,
} from "lucide-react";

/* ---------- types ---------- */

interface CashMovement {
  id: string;
  shift_id: string;
  movement_type: string; // "drop" | "paid_out" | "pay_in"
  amount: number;
  reason: string | null;
  created_at: string;
  user?: { full_name?: string };
}

interface ActiveShift {
  id: string;
  user_id: string;
  opening_float: number;
  cash_sales: number;
  expected_cash: number;
  status: string;
}

/* ---------- movement type config ---------- */

const MOVEMENT_TYPES = [
  {
    value: "drop",
    label: "Cash Drop",
    icon: ArrowDownCircle,
    color: "text-blue-400",
    description: "Remove cash from the register to a safe",
  },
  {
    value: "paid_out",
    label: "Paid Out",
    icon: ArrowUpCircle,
    color: "text-red-400",
    description: "Cash paid out for expenses (e.g., delivery, supplies)",
  },
  {
    value: "pay_in",
    label: "Pay In",
    icon: DollarSign,
    color: "text-green-400",
    description: "Additional cash added to the register",
  },
] as const;

function movementBadge(type: string) {
  switch (type) {
    case "drop":
      return <Badge variant="info">Drop</Badge>;
    case "paid_out":
      return <Badge variant="danger">Paid Out</Badge>;
    case "pay_in":
      return <Badge variant="success">Pay In</Badge>;
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
}

/* ================================================================ */

export default function CashManagementTab() {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formType, setFormType] = useState<string>("drop");
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Try to fetch active shift and its cash movements
      const shiftRes = await apiClient.get("/shifts/active");
      const shift = shiftRes.data;
      setActiveShift(shift);

      if (shift?.id) {
        const movRes = await apiClient.get(`/shifts/${shift.id}/cash-movements`);
        setMovements(Array.isArray(movRes.data) ? movRes.data : movRes.data.items ?? []);
      }
    } catch {
      // No active shift is a normal state
      setActiveShift(null);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!formAmount || !activeShift) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/shifts/${activeShift.id}/cash-movements`, {
        movement_type: formType,
        amount: parseFloat(formAmount),
        reason: formReason || null,
      });
      setShowForm(false);
      setFormAmount("");
      setFormReason("");
      fetchData();
    } catch {
      setError("Failed to record cash movement.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- formatting helpers ---------- */

  const formatZAR = (amount: number) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);

  /* ---------- computed totals ---------- */

  const totalDrops = movements
    .filter((m) => m.movement_type === "drop")
    .reduce((s, m) => s + m.amount, 0);
  const totalPaidOut = movements
    .filter((m) => m.movement_type === "paid_out")
    .reduce((s, m) => s + m.amount, 0);
  const totalPayIns = movements
    .filter((m) => m.movement_type === "pay_in")
    .reduce((s, m) => s + m.amount, 0);

  /* ---------- render ---------- */

  if (loading) return <LoadingSpinner />;

  if (!activeShift) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Banknote className="mb-3 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">No Active Shift</p>
        <p className="text-sm">Clock in to a shift to manage cash movements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded bg-red-900/40 p-3 text-sm text-red-300">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Opening Float</p>
            <p className="text-lg font-bold text-white">
              {formatZAR(activeShift.opening_float ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Cash Drops</p>
            <p className="text-lg font-bold text-blue-400">{formatZAR(totalDrops)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Paid Out</p>
            <p className="text-lg font-bold text-red-400">{formatZAR(totalPaidOut)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Pay Ins</p>
            <p className="text-lg font-bold text-green-400">{formatZAR(totalPayIns)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Record Movement
        </Button>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* New movement form */}
      {showForm && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h4 className="text-sm font-semibold text-white">Record Cash Movement</h4>
            <div className="flex flex-wrap gap-2">
              {MOVEMENT_TYPES.map((mt) => (
                <button
                  key={mt.value}
                  onClick={() => setFormType(mt.value)}
                  className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition ${
                    formType === mt.value
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  <mt.icon className={`h-3.5 w-3.5 ${mt.color}`} />
                  {mt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {MOVEMENT_TYPES.find((t) => t.value === formType)?.description}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount (ZAR)"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
              <Input
                placeholder="Reason (optional)"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !formAmount}>
                {submitting ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movements table */}
      <Card>
        <CardContent className="p-4">
          <h4 className="mb-3 text-sm font-semibold text-white">
            Cash Movements ({movements.length})
          </h4>
          {movements.length === 0 ? (
            <p className="text-sm text-gray-500">No cash movements recorded for this shift.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="border-b border-gray-700 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">{movementBadge(m.movement_type)}</td>
                      <td className="px-3 py-2 font-medium">{formatZAR(m.amount)}</td>
                      <td className="px-3 py-2">{m.reason ?? "—"}</td>
                      <td className="px-3 py-2">{new Date(m.created_at).toLocaleTimeString()}</td>
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
