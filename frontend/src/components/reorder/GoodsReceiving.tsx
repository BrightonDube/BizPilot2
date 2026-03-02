'use client';

/**
 * GoodsReceiving — Goods Received Note (GRN) management component.
 *
 * Displays a list of GRNs and provides a form to receive goods against
 * a purchase order.  Each GRN captures which items were received, in
 * what quantities, and any variances (damage, shortfall, etc.).
 *
 * Why a separate component instead of adding to the reorder page directly?
 * The GRN workflow has its own state (PO selection, line-item quantities,
 * variance notes) that would clutter the already-large reorder page.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, LoadingSpinner, EmptyState } from '@/components/ui/bizpilot';
import { Package, ClipboardCheck, AlertTriangle, Plus } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GRNItem {
  id: string;
  po_item_id: string;
  quantity_received: number;
  variance: number;
  variance_reason?: string;
}

interface GRN {
  id: string;
  purchase_order_id: string;
  business_id: string;
  grn_number: string;
  received_by?: string;
  received_at?: string;
  notes?: string;
  items: GRNItem[];
  created_at: string;
}

interface POItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  supplier_name?: string;
  status: string;
  items: POItem[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function GoodsReceiving() {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [receivablePOs, setReceivablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [variances, setVariances] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val);

  const fetchGRNs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/reorder/grn');
      setGrns(res.data.items || []);
    } catch {
      console.error('Failed to fetch GRNs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReceivablePOs = useCallback(async () => {
    try {
      const res = await apiClient.get('/reorder/purchase-requests', {
        params: { per_page: 100 },
      });
      const all: PurchaseOrder[] = res.data.items || [];
      // Only show POs in receivable states
      setReceivablePOs(
        all.filter((po) =>
          ['approved', 'ordered', 'partially_received'].includes(po.status)
        )
      );
    } catch {
      console.error('Failed to fetch POs');
    }
  }, []);

  useEffect(() => {
    fetchGRNs();
  }, [fetchGRNs]);

  const handleStartReceive = async () => {
    await fetchReceivablePOs();
    setShowForm(true);
  };

  const handleSelectPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    // Pre-fill with remaining quantities
    const qtys: Record<string, number> = {};
    for (const item of po.items) {
      const remaining = item.quantity - (item.received_quantity || 0);
      qtys[item.id] = remaining > 0 ? remaining : 0;
    }
    setReceiveQtys(qtys);
    setVariances({});
  };

  const handleSubmitGRN = async () => {
    if (!selectedPO) return;
    setSubmitting(true);
    try {
      const items = selectedPO.items
        .filter((item) => (receiveQtys[item.id] || 0) > 0)
        .map((item) => {
          const qty = receiveQtys[item.id] || 0;
          const expected = item.quantity - (item.received_quantity || 0);
          return {
            po_item_id: item.id,
            quantity_received: qty,
            variance: qty - expected,
            variance_reason: variances[item.id] || undefined,
          };
        });

      if (items.length === 0) {
        alert('Please enter quantities for at least one item.');
        return;
      }

      await apiClient.post('/reorder/grn', {
        purchase_order_id: selectedPO.id,
        items,
      });

      setShowForm(false);
      setSelectedPO(null);
      fetchGRNs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create GRN';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-emerald-400" />
          Goods Receiving
        </h3>
        <Button onClick={handleStartReceive} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Receive Goods
        </Button>
      </div>

      {/* Receive Form */}
      {showForm && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-300">
              {selectedPO ? `Receiving: ${selectedPO.reference}` : 'Select a Purchase Order'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPO ? (
              <div className="space-y-2">
                {receivablePOs.length === 0 ? (
                  <p className="text-sm text-gray-400">No purchase orders available for receiving.</p>
                ) : (
                  receivablePOs.map((po) => (
                    <button
                      key={po.id}
                      onClick={() => handleSelectPO(po)}
                      className="w-full text-left px-4 py-3 rounded bg-gray-900/50 hover:bg-gray-900 border border-gray-700 hover:border-emerald-500/50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{po.reference}</span>
                        <Badge variant="secondary">{po.status}</Badge>
                      </div>
                      <span className="text-xs text-gray-400">
                        {po.supplier_name || 'No supplier'} · {po.items.length} items
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-700">
                    <tr>
                      <th className="text-left px-2 py-1 text-gray-400">Item</th>
                      <th className="text-right px-2 py-1 text-gray-400">Ordered</th>
                      <th className="text-right px-2 py-1 text-gray-400">Already Rcvd</th>
                      <th className="text-right px-2 py-1 text-gray-400">Receiving</th>
                      <th className="text-left px-2 py-1 text-gray-400">Variance Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {selectedPO.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2 text-white">
                          {item.product_name || item.product_id}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-300">{item.quantity}</td>
                        <td className="px-2 py-2 text-right text-gray-300">
                          {item.received_quantity || 0}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={item.quantity - (item.received_quantity || 0)}
                            value={receiveQtys[item.id] || 0}
                            onChange={(e) =>
                              setReceiveQtys({
                                ...receiveQtys,
                                [item.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-right"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            placeholder="Reason if variance"
                            value={variances[item.id] || ''}
                            onChange={(e) =>
                              setVariances({ ...variances, [item.id]: e.target.value })
                            }
                            className="text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPO(null);
                      setShowForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSubmitGRN} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Confirm Receipt'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* GRN List */}
      {grns.length === 0 ? (
        <EmptyState title="No receipts" description="No goods have been received yet." />
      ) : (
        <div className="space-y-3">
          {grns.map((grn) => (
            <Card key={grn.id} className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium">{grn.grn_number}</p>
                    <p className="text-xs text-gray-400">
                      {grn.received_at
                        ? new Date(grn.received_at).toLocaleDateString()
                        : 'Unknown date'}
                      {' · '}
                      {grn.items.length} items received
                    </p>
                    {grn.notes && (
                      <p className="text-xs text-gray-500 mt-1">{grn.notes}</p>
                    )}
                  </div>
                  <Badge variant="secondary">
                    <Package className="w-3 h-3 mr-1" />
                    GRN
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
