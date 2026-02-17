'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  selling_price: number | string;
}

interface LineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default function NewLaybyPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, productsRes] = await Promise.all([
          apiClient.get<{ items: Customer[] }>('/customers?per_page=100'),
          apiClient.get<{ items: Product[] }>('/products?per_page=100'),
        ]);
        setCustomers(customersRes.data.items);
        setProducts(productsRes.data.items);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load customers or products');
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, []);

  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value as string,
        product_name: product?.name || '',
        unit_price: toNumber(product?.selling_price),
      };
    } else if (field === 'quantity') {
      updated[index] = { ...updated[index], quantity: Math.max(1, Number(value)) };
    }
    setItems(updated);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const deposit = toNumber(depositAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select a customer');
      return;
    }
    if (items.length === 0 || items.some(i => !i.product_id)) {
      setError('Please add at least one product');
      return;
    }
    if (deposit <= 0 || deposit >= totalAmount) {
      setError('Deposit must be greater than 0 and less than the total');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.post('/laybys', {
        customer_id: customerId,
        deposit_amount: deposit,
        payment_frequency: paymentFrequency,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      router.push(`/laybys/${response.data.id}`);
    } catch (err: unknown) {
      console.error('Failed to create layby:', err);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Failed to create layby');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Layby"
        description="Set up a new layby order for a customer"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Customer & Payment</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer" className="block text-sm font-medium text-gray-300 mb-1">
                  Customer *
                </label>
                <select
                  id="customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="frequency" className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Frequency *
                </label>
                <select
                  id="frequency"
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Items</h2>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">No items added yet. Click &quot;Add Item&quot; to begin.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex-1">
                      <label htmlFor={`product-${index}`} className="sr-only">Product</label>
                      <select
                        id={`product-${index}`}
                        value={item.product_id}
                        onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                      >
                        <option value="">Select product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} - {formatCurrency(toNumber(p.selling_price))}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label htmlFor={`qty-${index}`} className="sr-only">Quantity</label>
                      <Input
                        id={`qty-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-sm"
                      />
                    </div>
                    <div className="w-32 text-right text-white text-sm">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Summary</h2>

            <div className="space-y-2">
              <div className="flex justify-between text-gray-300">
                <span>Total</span>
                <span className="text-white font-semibold">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label htmlFor="deposit" className="text-gray-300">Deposit Amount *</label>
                <div className="w-48">
                  <Input
                    id="deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-right"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between text-gray-300 border-t border-gray-700 pt-2">
                <span>Balance Remaining</span>
                <span className="text-white font-semibold">
                  {formatCurrency(Math.max(0, totalAmount - deposit))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Layby
          </Button>
        </div>
      </form>
    </div>
  );
}
