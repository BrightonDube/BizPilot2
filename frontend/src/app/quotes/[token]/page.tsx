"use client";

/**
 * Customer portal for viewing and approving/rejecting a proforma quote.
 * Public route — no authentication required.
 * Accessed via the shareable link: /quotes/{approval_token}
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface QuoteData {
  quote_number: string;
  status: string;
  business_name?: string;
  customer_name?: string;
  issue_date?: string;
  expiry_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  notes?: string;
  terms?: string;
  items: QuoteItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function QuotePortalPage() {
  const params = useParams();
  const token = params?.token as string;

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [approverName, setApproverName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/v1/quotes/public/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Quote not found or link has expired.");
        return r.json();
      })
      .then(setQuote)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/quotes/public/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by_name: approverName || "Customer" }),
      });
      if (!res.ok) throw new Error("Approval failed. Please try again.");
      setDone("approved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/quotes/public/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error("Rejection failed. Please try again.");
      setDone("rejected");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setActionLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading quote…</p>
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Quote Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (done === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-semibold text-green-700 mb-2">Quote Approved</h1>
          <p className="text-gray-600">
            Thank you! We have received your approval for quote{" "}
            <strong>{quote?.quote_number}</strong>. We will be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  if (done === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-red-700 mb-2">Quote Declined</h1>
          <p className="text-gray-600">
            We have received your response for quote{" "}
            <strong>{quote?.quote_number}</strong>. We may be in touch to discuss alternatives.
          </p>
        </div>
      </div>
    );
  }

  const isExpired =
    quote?.status === "expired" ||
    (quote?.expiry_date && new Date(quote.expiry_date) < new Date());
  const canAct = quote?.status === "sent" && !isExpired;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Proforma Quote</p>
              <h1 className="text-2xl font-bold text-gray-900">{quote?.quote_number}</h1>
              {quote?.business_name && (
                <p className="text-gray-600 mt-1">{quote.business_name}</p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                quote?.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : quote?.status === "rejected"
                  ? "bg-red-100 text-red-800"
                  : isExpired
                  ? "bg-orange-100 text-orange-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {isExpired && quote?.status === "sent" ? "Expired" : quote?.status?.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Issued</p>
              <p className="font-medium">{formatDate(quote?.issue_date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Valid Until</p>
              <p className={`font-medium ${isExpired ? "text-red-600" : ""}`}>
                {formatDate(quote?.expiry_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Item</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Qty</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Unit Price</th>
                <th className="text-right px-6 py-3 text-gray-600 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote?.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium">
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t px-6 py-4 bg-gray-50">
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote?.subtotal ?? 0)}</span>
                </div>
                {(quote?.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span>
                    <span>−{formatCurrency(quote?.discount_amount ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>VAT</span>
                  <span>{formatCurrency(quote?.tax_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(quote?.total ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes / Terms */}
        {(quote?.notes || quote?.terms) && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 space-y-4">
            {quote?.notes && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{quote.notes}</p>
              </div>
            )}
            {quote?.terms && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Terms & Conditions</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{quote.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {canAct && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            {!showRejectForm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing…" : "Approve Quote"}
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 border border-red-300 text-red-600 py-2 px-4 rounded-lg font-medium hover:bg-red-50 transition-colors"
                  >
                    Decline Quote
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for declining *
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    rows={3}
                    placeholder="Please let us know why this quote doesn't work for you…"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Sending…" : "Send Decline"}
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setError(null);
                    }}
                    className="flex-1 border rounded-lg py-2 px-4 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!canAct && quote && (
          <div className="text-center py-6 text-gray-500 text-sm">
            {isExpired
              ? "This quote has expired. Please contact us for a new quote."
              : quote.status === "approved"
              ? "This quote has already been approved."
              : quote.status === "rejected"
              ? "This quote has been declined."
              : "This quote is not currently open for response."}
          </div>
        )}
      </div>
    </div>
  );
}
