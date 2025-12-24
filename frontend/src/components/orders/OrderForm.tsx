'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { apiClient } from '@/lib/api';

type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'failed';

interface OrderFormProps {
  onCreated?: (orderId: string) => void;
}

interface Item {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
  notes?: string;
}

export function OrderForm({ onCreated }: OrderFormProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), name: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_percent: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const discount = items.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price * item.discount_percent) / 100,
      0,
    );
    const taxable = subtotal - discount;
    const tax = items.reduce(
      (sum, item) =>
        sum + ((item.quantity * item.unit_price - (item.quantity * item.unit_price * item.discount_percent) / 100) * item.tax_rate) / 100,
      0,
    );
    const total = taxable + tax;
    return { subtotal, discount, tax, total };
  }, [items]);

  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_percent: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const handleSubmit = async () => {
    if (items.some((item) => item.name.trim() === '')) {
      setError('Each item needs a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        customer_id: customerId ? customerId : null,
        status,
        payment_status: paymentStatus,
        payment_method: paymentMethod || undefined,
        notes: notes || undefined,
        items: items.map((item) => ({
          name: item.name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          tax_rate: item.tax_rate,
          discount_percent: item.discount_percent,
          notes: item.notes || undefined,
        })),
      };
      const resp = await apiClient.post('/orders', payload);
      const orderId = resp.data?.id;
      if (onCreated) onCreated(orderId);
      router.push(`/orders/${orderId}`);
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Failed to create order';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-300">Customer ID (optional)</label>
              <Input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Customer ID"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Payment Method</label>
              <Input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g. card, cash"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Order Status</label>
              <select
                value={status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatus(e.target.value as OrderStatus)
                }
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2"
              >
                {['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(
                  (s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-300">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setPaymentStatus(e.target.value as PaymentStatus)
                }
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2"
              >
                {['pending', 'partial', 'paid', 'refunded', 'failed'].map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-300">Notes</label>
            <textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Internal notes"
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 min-h-[96px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Items</h3>
            <Button variant="outline" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-7 gap-3 p-4 rounded-lg border border-gray-800 bg-gray-950/60">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400">Name</label>
                  <Input
                    value={item.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateItem(item.id, 'name', e.target.value)
                    }
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateItem(item.id, 'quantity', Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Unit Price</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateItem(item.id, 'unit_price', Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Tax %</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.tax_rate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateItem(item.id, 'tax_rate', Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Discount %</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.discount_percent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateItem(item.id, 'discount_percent', Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove item ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 justify-end text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Subtotal:</span>
              <span className="font-semibold">ZAR {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Discount:</span>
              <span className="font-semibold text-amber-300">-ZAR {totals.discount.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Tax:</span>
              <span className="font-semibold">ZAR {totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Total:</span>
              <span className="font-semibold text-green-300">ZAR {totals.total.toFixed(2)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Order'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
