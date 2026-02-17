'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Users,
  DollarSign,
  CreditCard,
  AlertTriangle,
  X,
  Eye,
  Plus,
  Banknote,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { formatCurrency, toNumber } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CustomerAccount {
  id: string;
  account_number: string;
  customer_name: string;
  balance: number;
  credit_limit: number;
  status: string;
  last_activity: string | null;
}

interface AccountListResponse {
  items: CustomerAccount[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface BalanceDetail {
  balance: number;
  current: number;
  days_30: number;
  days_60: number;
  days_90: number;
  days_90_plus: number;
  recent_transactions: Transaction[];
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  closed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const statCards = [
  { key: 'total_accounts', label: 'Total Accounts', icon: Users, color: 'blue' },
  { key: 'total_outstanding', label: 'Total Outstanding', icon: DollarSign, color: 'purple', isCurrency: true },
  { key: 'total_credit_limit', label: 'Total Credit Limit', icon: CreditCard, color: 'green', isCurrency: true },
  { key: 'overdue_count', label: 'Overdue', icon: AlertTriangle, color: 'red' },
] as const;

const colorMap: Record<string, { container: string; icon: string }> = {
  blue: { container: 'bg-blue-500/20 border-blue-500/30', icon: 'text-blue-400' },
  purple: { container: 'bg-purple-500/20 border-purple-500/30', icon: 'text-purple-400' },
  green: { container: 'bg-green-500/20 border-green-500/30', icon: 'text-green-400' },
  red: { container: 'bg-red-500/20 border-red-500/30', icon: 'text-red-400' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CustomerAccountsPage() {
  /* ---- list state ---- */
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- stats ---- */
  const [stats, setStats] = useState({ total_accounts: 0, total_outstanding: 0, total_credit_limit: 0, overdue_count: 0 });

  /* ---- detail modal ---- */
  const [selectedAccount, setSelectedAccount] = useState<CustomerAccount | null>(null);
  const [balanceDetail, setBalanceDetail] = useState<BalanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ---- charge modal ---- */
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeAccountId, setChargeAccountId] = useState<string | null>(null);
  const [chargeForm, setChargeForm] = useState({ amount: '', description: '', reference: '' });
  const [chargeSubmitting, setChargeSubmitting] = useState(false);

  /* ---- payment modal ---- */
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', reference: '' });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch list                                                       */
  /* ---------------------------------------------------------------- */

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: page.toString(), per_page: '20' });
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await apiClient.get<AccountListResponse>(`/customer-accounts?${params}`);
      setAccounts(response.data.items);
      setTotal(response.data.total);
      setPages(response.data.pages);

      const items = response.data.items;
      setStats({
        total_accounts: response.data.total,
        total_outstanding: items.reduce((s, a) => s + toNumber(a.balance), 0),
        total_credit_limit: items.reduce((s, a) => s + toNumber(a.credit_limit), 0),
        overdue_count: items.filter((a) => toNumber(a.balance) > toNumber(a.credit_limit)).length,
      });
    } catch {
      setError('Failed to load customer accounts');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, statusFilter]);

  useEffect(() => {
    const id = setTimeout(fetchAccounts, 300);
    return () => clearTimeout(id);
  }, [fetchAccounts]);

  /* ---------------------------------------------------------------- */
  /*  Detail                                                           */
  /* ---------------------------------------------------------------- */

  const openDetail = async (account: CustomerAccount) => {
    setSelectedAccount(account);
    setDetailLoading(true);
    setBalanceDetail(null);
    try {
      const res = await apiClient.get<BalanceDetail>(`/customer-accounts/${account.id}/balance`);
      setBalanceDetail(res.data);
    } catch {
      setBalanceDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Charge                                                           */
  /* ---------------------------------------------------------------- */

  const openCharge = (id: string) => {
    setChargeAccountId(id);
    setChargeForm({ amount: '', description: '', reference: '' });
    setShowChargeModal(true);
  };

  const submitCharge = async () => {
    if (!chargeAccountId || !chargeForm.amount) return;
    setChargeSubmitting(true);
    try {
      await apiClient.post(`/customer-accounts/${chargeAccountId}/charge`, {
        amount: parseFloat(chargeForm.amount),
        description: chargeForm.description,
        reference: chargeForm.reference,
      });
      setShowChargeModal(false);
      fetchAccounts();
    } catch {
      /* keep modal open on error */
    } finally {
      setChargeSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Payment                                                          */
  /* ---------------------------------------------------------------- */

  const openPayment = (id: string) => {
    setPaymentAccountId(id);
    setPaymentForm({ amount: '', payment_method: 'cash', reference: '' });
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    if (!paymentAccountId || !paymentForm.amount) return;
    setPaymentSubmitting(true);
    try {
      await apiClient.post(`/customer-accounts/${paymentAccountId}/payment`, {
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference,
      });
      setShowPaymentModal(false);
      fetchAccounts();
    } catch {
      /* keep modal open on error */
    } finally {
      setPaymentSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Customer Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">Manage customer balances, charges and payments</p>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          const c = colorMap[s.color];
          const raw = stats[s.key];
          const display = ('isCurrency' in s && s.isCurrency) ? formatCurrency(toNumber(raw)) : toNumber(raw).toLocaleString();
          return (
            <motion.div
              key={s.key}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg border ${c.container}`}>
                  <Icon className={`h-5 w-5 ${c.icon}`} />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-400">{s.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{display}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Search & filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by customer or account number…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
      </motion.div>

      {/* Error */}
      {error && accounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center"
        >
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">{error}</h3>
          <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {isLoading && accounts.length === 0 && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && accounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center"
        >
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No accounts found</h3>
          <p className="text-gray-400 text-sm mt-1">Adjust your search or filters</p>
        </motion.div>
      )}

      {/* Table */}
      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3">Account #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-300">{a.account_number}</td>
                    <td className="px-4 py-3 text-white font-medium">{a.customer_name}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(toNumber(a.balance))}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(toNumber(a.credit_limit))}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[a.status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(a.last_activity)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(a)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => openCharge(a.id)} className="p-1.5 rounded-lg hover:bg-purple-700/50 text-gray-400 hover:text-purple-300 transition-colors" title="Charge">
                          <Plus className="h-4 w-4" />
                        </button>
                        <button onClick={() => openPayment(a.id)} className="p-1.5 rounded-lg hover:bg-green-700/50 text-gray-400 hover:text-green-300 transition-colors" title="Payment">
                          <Banknote className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
              <span className="text-sm text-gray-400">Page {page} of {pages} ({total} accounts)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ============================================================= */}
      {/*  Detail Modal                                                  */}
      {/* ============================================================= */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedAccount(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedAccount.customer_name}</h2>
                <p className="text-sm text-gray-400">{selectedAccount.account_number}</p>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : balanceDetail ? (
                <>
                  {/* Balance */}
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(toNumber(balanceDetail.balance))}</p>
                  </div>

                  {/* Aging breakdown */}
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-2">Aging Breakdown</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Current', value: balanceDetail.current },
                        { label: '30 Days', value: balanceDetail.days_30 },
                        { label: '60 Days', value: balanceDetail.days_60 },
                        { label: '90 Days', value: balanceDetail.days_90 },
                        { label: '90+ Days', value: balanceDetail.days_90_plus },
                      ].map((b) => (
                        <div key={b.label} className="bg-gray-900/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">{b.label}</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(toNumber(b.value))}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent transactions */}
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-2">Recent Transactions</p>
                    {balanceDetail.recent_transactions.length === 0 ? (
                      <p className="text-gray-500 text-sm">No recent transactions</p>
                    ) : (
                      <div className="space-y-2">
                        {balanceDetail.recent_transactions.map((t) => (
                          <div key={t.id} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                            <div>
                              <p className="text-sm text-white">{t.description}</p>
                              <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                            </div>
                            <p className={`text-sm font-medium ${t.type === 'payment' ? 'text-green-400' : 'text-red-400'}`}>
                              {t.type === 'payment' ? '-' : '+'}{formatCurrency(toNumber(t.amount))}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">Unable to load balance details</p>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={() => { setSelectedAccount(null); openCharge(selectedAccount.id); }}>
                  <Plus className="h-4 w-4 mr-2" /> Charge
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => { setSelectedAccount(null); openPayment(selectedAccount.id); }}>
                  <Banknote className="h-4 w-4 mr-2" /> Payment
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Charge Modal                                                  */}
      {/* ============================================================= */}
      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowChargeModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">New Charge</h2>
              <button onClick={() => setShowChargeModal(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (R)</label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <Input placeholder="Description" value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reference</label>
                <Input placeholder="Reference" value={chargeForm.reference} onChange={(e) => setChargeForm({ ...chargeForm, reference: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowChargeModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!chargeForm.amount || chargeSubmitting} onClick={submitCharge}>
                  {chargeSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Charge
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Payment Modal                                                 */}
      {/* ============================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (R)</label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="eft">EFT</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reference</label>
                <Input placeholder="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!paymentForm.amount || paymentSubmitting} onClick={submitPayment}>
                  {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                  Record Payment
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
