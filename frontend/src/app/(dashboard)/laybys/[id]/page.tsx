'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  DollarSign,
  CreditCard,
  XCircle,
  Package,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface LaybyItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  total: number | string;
}

interface ScheduleEntry {
  id: string;
  due_date: string;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
}

interface PaymentRecord {
  id: string;
  amount: number | string;
  payment_method: string;
  created_at: string;
  note?: string;
}

interface LaybyDetail {
  id: string;
  reference_number: string;
  customer_name?: string;
  customer_id: string | null;
  status: string;
  total_amount: number | string;
  deposit_amount: number | string;
  balance_remaining: number | string;
  amount_paid: number | string;
  payment_frequency: string;
  created_at: string;
  updated_at: string;
  items: LaybyItem[];
  payment_schedule: ScheduleEntry[];
  payments: PaymentRecord[];
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type BadgeVariant = 'info' | 'danger' | 'success' | 'secondary' | 'warning';

const statusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  ACTIVE: { variant: 'info', label: 'Active' },
  OVERDUE: { variant: 'danger', label: 'Overdue' },
  READY_FOR_COLLECTION: { variant: 'success', label: 'Ready for Collection' },
  COMPLETED: { variant: 'secondary', label: 'Completed' },
  CANCELLED: { variant: 'secondary', label: 'Cancelled' },
};

const scheduleStatusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  paid: { variant: 'success', label: 'Paid' },
  overdue: { variant: 'danger', label: 'Overdue' },
  partial: { variant: 'info', label: 'Partial' },
};

export default function LaybyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [layby, setLayby] = useState<LaybyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLayby = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<LaybyDetail>(`/laybys/${id}`);
      setLayby(response.data);
    } catch (err) {
      console.error('Failed to fetch layby:', err);
      setError('Failed to load layby details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLayby();
  }, [fetchLayby]);

  const handlePayment = async () => {
    const amount = toNumber(paymentAmount);
    if (amount <= 0) {
      setActionError('Please enter a valid amount');
      return;
    }
    try {
      setActionLoading(true);
      setActionError(null);
      await apiClient.post(`/laybys/${id}/payments`, {
        amount,
        payment_method: paymentMethod,
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('cash');
      await fetchLayby();
    } catch (err: unknown) {
      console.error('Payment failed:', err);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Payment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await apiClient.post(`/laybys/${id}/cancel`);
      setShowCancelModal(false);
      await fetchLayby();
    } catch (err: unknown) {
      console.error('Cancellation failed:', err);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Cancellation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCollect = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await apiClient.post(`/laybys/${id}/collect`);
      setShowCollectModal(false);
      await fetchLayby();
    } catch (err: unknown) {
      console.error('Collection failed:', err);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Collection failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading layby details...</p>
        </div>
      </div>
    );
  }

  if (error || !layby) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load layby</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/laybys')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Laybys
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={fetchLayby}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const status = statusConfig[layby.status] || statusConfig.ACTIVE;
  const canPay = layby.status === 'ACTIVE' || layby.status === 'OVERDUE';
  const canCancel = layby.status === 'ACTIVE' || layby.status === 'OVERDUE';
  const canCollect = layby.status === 'READY_FOR_COLLECTION';

  return (
    <div className="space-y-6">
      <PageHeader
        title={layby.reference_number}
        description={`Layby for ${layby.customer_name || 'Walk-in Customer'}`}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/laybys')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {canPay && (
              <Button
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={() => { setShowPaymentModal(true); setActionError(null); }}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Make Payment
              </Button>
            )}
            {canCollect && (
              <Button
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                onClick={() => { setShowCollectModal(true); setActionError(null); }}
              >
                <Package className="w-4 h-4 mr-2" />
                Collect
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                onClick={() => { setShowCancelModal(true); setActionError(null); }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Layby
              </Button>
            )}
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Status</p>
            <div className="mt-1">
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Total Amount</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(toNumber(layby.total_amount))}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Amount Paid</p>
            <p className="text-xl font-semibold text-green-400 mt-1">{formatCurrency(toNumber(layby.amount_paid))}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">Balance Remaining</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(toNumber(layby.balance_remaining))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Customer</span>
              <span className="text-white">{layby.customer_name || 'Walk-in Customer'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Payment Frequency</span>
              <span className="text-white capitalize">{layby.payment_frequency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Deposit</span>
              <span className="text-white">{formatCurrency(toNumber(layby.deposit_amount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Created</span>
              <span className="text-white">{formatDate(layby.created_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 pb-3 font-medium">Product</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">Qty</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">Unit Price</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {layby.items?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-700/50">
                    <td className="py-3 text-white">{item.product_name}</td>
                    <td className="py-3 text-right text-gray-300">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-300">{formatCurrency(toNumber(item.unit_price))}</td>
                    <td className="py-3 text-right text-white font-medium">{formatCurrency(toNumber(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule */}
      {layby.payment_schedule && layby.payment_schedule.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              <Calendar className="w-5 h-5 inline-block mr-2" />
              Payment Schedule
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 pb-3 font-medium">Due Date</th>
                    <th className="text-right text-gray-400 pb-3 font-medium">Amount Due</th>
                    <th className="text-right text-gray-400 pb-3 font-medium">Amount Paid</th>
                    <th className="text-right text-gray-400 pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {layby.payment_schedule.map((entry) => {
                    const sStatus = scheduleStatusConfig[entry.status] || scheduleStatusConfig.pending;
                    return (
                      <tr key={entry.id} className="border-b border-gray-700/50">
                        <td className="py-3 text-white">{formatDate(entry.due_date)}</td>
                        <td className="py-3 text-right text-gray-300">{formatCurrency(toNumber(entry.amount_due))}</td>
                        <td className="py-3 text-right text-gray-300">{formatCurrency(toNumber(entry.amount_paid))}</td>
                        <td className="py-3 text-right">
                          <Badge variant={sStatus.variant}>{sStatus.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {layby.payments && layby.payments.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              <DollarSign className="w-5 h-5 inline-block mr-2" />
              Payment History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 pb-3 font-medium">Date</th>
                    <th className="text-right text-gray-400 pb-3 font-medium">Amount</th>
                    <th className="text-left text-gray-400 pb-3 font-medium">Method</th>
                    <th className="text-left text-gray-400 pb-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {layby.payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-700/50">
                      <td className="py-3 text-white">{formatDate(payment.created_at)}</td>
                      <td className="py-3 text-right text-green-400 font-medium">{formatCurrency(toNumber(payment.amount))}</td>
                      <td className="py-3 text-gray-300 capitalize">{payment.payment_method}</td>
                      <td className="py-3 text-gray-400">{payment.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Make Payment</h2>
            <p className="text-sm text-gray-400 mb-4">
              Balance remaining: {formatCurrency(toNumber(layby.balance_remaining))}
            </p>

            {actionError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
                {actionError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-300 mb-1">Amount *</label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
              <div>
                <label htmlFor="pay-method" className="block text-sm font-medium text-gray-300 mb-1">Payment Method</label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="eft">EFT</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                disabled={actionLoading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCancelModal(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-2">Cancel Layby</h2>
            <p className="text-gray-400 mb-4">
              Are you sure you want to cancel this layby? This action cannot be undone.
            </p>

            {actionError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={actionLoading}>
                Go Back
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Modal */}
      {showCollectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCollectModal(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-2">
              <CheckCircle className="w-5 h-5 inline-block mr-2 text-green-400" />
              Collect Items
            </h2>
            <p className="text-gray-400 mb-4">
              Confirm that the customer has collected all items for this layby. This will mark the layby as completed.
            </p>

            {actionError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCollectModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleCollect}
                disabled={actionLoading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Collection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
