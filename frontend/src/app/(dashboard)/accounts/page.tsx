'use client';

/**
 * Customer Accounts page - Manage customer credit accounts, view balances,
 * process payments, record charges, and view aging reports.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Users,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Eye,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  PauseCircle,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  Button,
  Input,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

type ViewMode = 'accounts' | 'aging' | 'detail';

interface Account {
  id: string;
  account_number: string;
  customer_name?: string;
  customer_id: string;
  credit_limit: number;
  current_balance: number;
  available_credit: number;
  status: string;
  created_at: string;
}

function formatCurrency(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'suspended':
      return <PauseCircle className="w-4 h-4 text-yellow-400" />;
    case 'closed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

export default function CustomerAccountsPage() {
  const [view, setView] = useState<ViewMode>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [aging, setAging] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalAccountId, setModalAccountId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = { page, per_page: 20 };
      if (search) params.search = search;
      const res = await apiClient.get('/customer-accounts', { params });
      setAccounts(res.data.items ?? res.data ?? []);
      setTotalPages(res.data.pages ?? 1);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  const fetchAging = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/customer-accounts/aging');
      setAging(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch aging report');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAccountDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [accountRes, txRes] = await Promise.all([
        apiClient.get(`/customer-accounts/${id}`),
        apiClient.get(`/customer-accounts/${id}/transactions`, { params: { page: 1, per_page: 50 } }),
      ]);
      setSelectedAccount(accountRes.data);
      setTransactions(txRes.data.items ?? txRes.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch account details');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'accounts') fetchAccounts();
    else if (view === 'aging') fetchAging();
  }, [view, fetchAccounts, fetchAging]);

  const openDetail = (id: string) => {
    fetchAccountDetail(id);
    setView('detail');
  };

  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);
  const totalCredit = accounts.reduce((s, a) => s + (a.credit_limit ?? 0), 0);
  const activeCount = accounts.filter(a => a.status === 'active').length;
  const overdueCount = accounts.filter(a => a.current_balance > (a.credit_limit ?? 0)).length;

  return (
      <div className="space-y-6">
        <PageHeader
          title="Customer Accounts"
          description="Manage credit accounts, payments, and balances"
        />

        {/* Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-lg bg-gray-800/50 border border-gray-700 p-1">
            {[
              { key: 'accounts' as ViewMode, label: 'Accounts', icon: <Users className="w-4 h-4" /> },
              { key: 'aging' as ViewMode, label: 'Aging Report', icon: <Clock className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setView(tab.key); setSelectedAccount(null); }}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  view === tab.key || (view === 'detail' && tab.key === 'accounts')
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {view === 'accounts' && (
            <>
              <div className="flex-1 max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search accounts..."
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                New Account
              </Button>
            </>
          )}

          {view === 'detail' && (
            <Button variant="outline" onClick={() => { setView('accounts'); setSelectedAccount(null); }} className="border-gray-600">
              ← Back to Accounts
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card className="bg-red-900/20 border-red-700">
            <CardContent className="py-4">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Accounts List View */}
            {view === 'accounts' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total Accounts" value={accounts.length} icon={<Users className="w-5 h-5" />} />
                  <StatCard title="Active" value={activeCount} icon={<CheckCircle className="w-5 h-5" />} />
                  <StatCard title="Total Balance" value={formatCurrency(totalBalance)} icon={<DollarSign className="w-5 h-5" />} />
                  <StatCard title="Total Credit" value={formatCurrency(totalCredit)} icon={<CreditCard className="w-5 h-5" />} />
                </div>

                <Card className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            {['Account #', 'Customer', 'Status', 'Balance', 'Credit Limit', 'Available', 'Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {accounts.map(acc => (
                            <tr key={acc.id} className="hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-3 text-gray-200 font-mono">{acc.account_number}</td>
                              <td className="px-4 py-3 text-gray-200">{acc.customer_name ?? '-'}</td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-1.5">
                                  {statusIcon(acc.status)}
                                  <span className="text-gray-200 capitalize">{acc.status}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-200">{formatCurrency(acc.current_balance ?? 0)}</td>
                              <td className="px-4 py-3 text-gray-200">{formatCurrency(acc.credit_limit ?? 0)}</td>
                              <td className="px-4 py-3 text-gray-200">{formatCurrency(acc.available_credit ?? 0)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => openDetail(acc.id)} className="text-blue-400 hover:text-blue-300" title="View">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => { setModalAccountId(acc.id); setShowChargeModal(true); }}
                                    className="text-red-400 hover:text-red-300"
                                    title="Add Charge"
                                  >
                                    <ArrowUpCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => { setModalAccountId(acc.id); setShowPaymentModal(true); }}
                                    className="text-green-400 hover:text-green-300"
                                    title="Record Payment"
                                  >
                                    <ArrowDownCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {accounts.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                No customer accounts found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {totalPages > 1 && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="border-gray-600"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-400 flex items-center">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="border-gray-600"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Aging Report View */}
            {view === 'aging' && aging && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Total Outstanding"
                    value={formatCurrency(aging.total_outstanding ?? 0)}
                    icon={<DollarSign className="w-5 h-5" />}
                  />
                  <StatCard
                    title="Current (0-30 days)"
                    value={formatCurrency(aging.current ?? aging.bucket_0_30 ?? 0)}
                    icon={<TrendingUp className="w-5 h-5" />}
                  />
                  <StatCard
                    title="31-60 days"
                    value={formatCurrency(aging.bucket_31_60 ?? 0)}
                    icon={<Clock className="w-5 h-5" />}
                  />
                  <StatCard
                    title="Over 90 days"
                    value={formatCurrency(aging.bucket_90_plus ?? 0)}
                    icon={<AlertTriangle className="w-5 h-5" />}
                  />
                </div>

                {aging.accounts && aging.accounts.length > 0 && (
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-400" />
                        Aging by Account
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-700">
                              {['Account', 'Customer', 'Current', '31-60', '61-90', '90+', 'Total'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/50">
                            {aging.accounts.map((a: any) => (
                              <tr key={a.account_id ?? a.id} className="hover:bg-gray-700/30">
                                <td className="px-4 py-3 text-gray-200 font-mono">{a.account_number ?? '-'}</td>
                                <td className="px-4 py-3 text-gray-200">{a.customer_name ?? '-'}</td>
                                <td className="px-4 py-3 text-gray-200">{formatCurrency(a.current ?? a.bucket_0_30 ?? 0)}</td>
                                <td className="px-4 py-3 text-gray-200">{formatCurrency(a.bucket_31_60 ?? 0)}</td>
                                <td className="px-4 py-3 text-gray-200">{formatCurrency(a.bucket_61_90 ?? 0)}</td>
                                <td className="px-4 py-3 text-red-400 font-medium">{formatCurrency(a.bucket_90_plus ?? 0)}</td>
                                <td className="px-4 py-3 text-gray-200 font-medium">{formatCurrency(a.total ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Account Detail View */}
            {view === 'detail' && selectedAccount && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Current Balance"
                    value={formatCurrency(selectedAccount.current_balance ?? 0)}
                    icon={<DollarSign className="w-5 h-5" />}
                  />
                  <StatCard
                    title="Credit Limit"
                    value={formatCurrency(selectedAccount.credit_limit ?? 0)}
                    icon={<CreditCard className="w-5 h-5" />}
                  />
                  <StatCard
                    title="Available Credit"
                    value={formatCurrency(selectedAccount.available_credit ?? 0)}
                    icon={<TrendingUp className="w-5 h-5" />}
                  />
                  <StatCard
                    title="Status"
                    value={selectedAccount.status ?? '-'}
                    icon={statusIcon(selectedAccount.status)}
                  />
                </div>

                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        Account #{selectedAccount.account_number} — {selectedAccount.customer_name ?? 'Customer'}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                          onClick={() => { setModalAccountId(selectedAccount.id); setShowChargeModal(true); }}
                        >
                          <ArrowUpCircle className="w-4 h-4 mr-1" />
                          Add Charge
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-700 hover:bg-green-600"
                          onClick={() => { setModalAccountId(selectedAccount.id); setShowPaymentModal(true); }}
                        >
                          <ArrowDownCircle className="w-4 h-4 mr-1" />
                          Record Payment
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            {['Date', 'Type', 'Description', 'Amount', 'Running Balance'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {transactions.map((tx: any) => (
                            <tr key={tx.id} className="hover:bg-gray-700/30">
                              <td className="px-4 py-3 text-gray-200">
                                {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`capitalize ${
                                  tx.transaction_type === 'charge' || tx.type === 'charge'
                                    ? 'text-red-400'
                                    : tx.transaction_type === 'payment' || tx.type === 'payment'
                                    ? 'text-green-400'
                                    : 'text-gray-200'
                                }`}>
                                  {tx.transaction_type ?? tx.type ?? '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-200">{tx.description ?? tx.reference ?? '-'}</td>
                              <td className="px-4 py-3 text-gray-200">{formatCurrency(tx.amount ?? 0)}</td>
                              <td className="px-4 py-3 text-gray-200">{tx.running_balance != null ? formatCurrency(tx.running_balance) : '-'}</td>
                            </tr>
                          ))}
                          {transactions.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                No transactions found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Charge Modal */}
        {showChargeModal && modalAccountId && (
          <ChargeModal
            accountId={modalAccountId}
            onClose={() => { setShowChargeModal(false); setModalAccountId(null); }}
            onSuccess={() => {
              setShowChargeModal(false);
              setModalAccountId(null);
              if (view === 'detail' && selectedAccount) fetchAccountDetail(selectedAccount.id);
              else fetchAccounts();
            }}
          />
        )}

        {/* Payment Modal */}
        {showPaymentModal && modalAccountId && (
          <PaymentModal
            accountId={modalAccountId}
            onClose={() => { setShowPaymentModal(false); setModalAccountId(null); }}
            onSuccess={() => {
              setShowPaymentModal(false);
              setModalAccountId(null);
              if (view === 'detail' && selectedAccount) fetchAccountDetail(selectedAccount.id);
              else fetchAccounts();
            }}
          />
        )}

        {/* Create Account Modal */}
        {showCreateModal && (
          <CreateAccountModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => { setShowCreateModal(false); fetchAccounts(); }}
          />
        )}
      </div>
  );
}

// --- Modal Components ---

function ChargeModal({ accountId, onClose, onSuccess }: { accountId: string; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    setErr(null);
    try {
      await apiClient.post(`/customer-accounts/${accountId}/charge`, {
        amount: parseFloat(amount),
        description: description || 'Charge',
        reference: reference || undefined,
      });
      onSuccess();
    } catch (error: any) {
      setErr(error?.response?.data?.detail || 'Failed to add charge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Add Charge</h3>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (R)</label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} className="bg-gray-900 border-gray-600" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <Input value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} className="bg-gray-900 border-gray-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Reference</label>
            <Input value={reference} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReference(e.target.value)} className="bg-gray-900 border-gray-600" />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-600">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpCircle className="w-4 h-4 mr-2" />}
              Add Charge
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ accountId, onClose, onSuccess }: { accountId: string; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    setErr(null);
    try {
      await apiClient.post(`/customer-accounts/${accountId}/payment`, {
        amount: parseFloat(amount),
        payment_method: method,
        reference: reference || undefined,
      });
      onSuccess();
    } catch (error: any) {
      setErr(error?.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Record Payment</h3>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (R)</label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} className="bg-gray-900 border-gray-600" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="eft">EFT</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Reference</label>
            <Input value={reference} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReference(e.target.value)} className="bg-gray-900 border-gray-600" />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-600">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
              Record Payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [creditLimit, setCreditLimit] = useState('1000');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    setSubmitting(true);
    setErr(null);
    try {
      await apiClient.post('/customer-accounts', {
        customer_id: customerId,
        credit_limit: parseFloat(creditLimit) || 1000,
      });
      onSuccess();
    } catch (error: any) {
      setErr(error?.response?.data?.detail || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Create Customer Account</h3>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Customer ID</label>
            <Input value={customerId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerId(e.target.value)} placeholder="Enter customer UUID" className="bg-gray-900 border-gray-600" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Credit Limit (R)</label>
            <Input type="number" step="100" min="0" value={creditLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreditLimit(e.target.value)} className="bg-gray-900 border-gray-600" />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-600">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
