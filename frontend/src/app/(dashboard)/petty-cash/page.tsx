'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Wallet,
  Receipt,
  Clock,
  TrendingDown,
  AlertTriangle,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  XCircle,
  RefreshCw,
  Tag,
  Banknote,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { formatCurrency, toNumber } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PettyCashFund {
  id: string;
  name: string;
  balance: number;
}

interface FundSummary {
  balance: number;
  total_expenses: number;
  pending_approvals: number;
  month_spent: number;
}

interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  requested_by: string;
  status: string;
}

interface ExpenseListResponse {
  items: Expense[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface PettyCashCategory {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const expenseStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  disbursed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const statCardDefs = [
  { key: 'balance', label: 'Fund Balance', icon: Wallet, color: 'blue', isCurrency: true },
  { key: 'total_expenses', label: 'Total Expenses', icon: TrendingDown, color: 'red', isCurrency: true },
  { key: 'pending_approvals', label: 'Pending Approvals', icon: Clock, color: 'yellow' },
  { key: 'month_spent', label: 'This Month', icon: Receipt, color: 'purple', isCurrency: true },
] as const;

const colorMap: Record<string, { container: string; icon: string }> = {
  blue: { container: 'bg-blue-500/20 border-blue-500/30', icon: 'text-blue-400' },
  red: { container: 'bg-red-500/20 border-red-500/30', icon: 'text-red-400' },
  yellow: { container: 'bg-yellow-500/20 border-yellow-500/30', icon: 'text-yellow-400' },
  purple: { container: 'bg-purple-500/20 border-purple-500/30', icon: 'text-purple-400' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Tab = 'expenses' | 'categories' | 'replenishments';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PettyCashPage() {
  /* ---- fund selector ---- */
  const [funds, setFunds] = useState<PettyCashFund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  /* ---- summary ---- */
  const [summary, setSummary] = useState<FundSummary>({ balance: 0, total_expenses: 0, pending_approvals: 0, month_spent: 0 });

  /* ---- tabs ---- */
  const [activeTab, setActiveTab] = useState<Tab>('expenses');

  /* ---- expenses ---- */
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expTotal, setExpTotal] = useState(0);
  const [expPage, setExpPage] = useState(1);
  const [expPages, setExpPages] = useState(0);
  const [expSearch, setExpSearch] = useState('');
  const [expLoading, setExpLoading] = useState(true);
  const [expError, setExpError] = useState<string | null>(null);

  /* ---- categories ---- */
  const [categories, setCategories] = useState<PettyCashCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  /* ---- submit expense modal ---- */
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', category: '', vendor: '', receipt_number: '' });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  /* ---- replenish modal ---- */
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [replenishForm, setReplenishForm] = useState({ amount: '', notes: '' });
  const [replenishSubmitting, setReplenishSubmitting] = useState(false);

  /* ---- approve/reject ---- */
  const [actionExpenseId, setActionExpenseId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch funds                                                      */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    async function loadFunds() {
      try {
        const res = await apiClient.get<PettyCashFund[]>('/petty-cash/funds');
        const list = Array.isArray(res.data) ? res.data : [];
        setFunds(list);
        if (list.length > 0 && !selectedFundId) {
          setSelectedFundId(list[0].id);
        }
      } catch {
        /* no funds */
      }
    }
    loadFunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Fetch summary                                                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedFundId) return;
    async function loadSummary() {
      try {
        const res = await apiClient.get<FundSummary>(`/petty-cash/funds/${selectedFundId}/summary`);
        setSummary(res.data);
      } catch {
        /* keep defaults */
      }
    }
    loadSummary();
  }, [selectedFundId]);

  /* ---------------------------------------------------------------- */
  /*  Fetch expenses                                                   */
  /* ---------------------------------------------------------------- */

  const fetchExpenses = useCallback(async () => {
    if (!selectedFundId) return;
    try {
      setExpLoading(true);
      setExpError(null);
      const params = new URLSearchParams({ page: expPage.toString(), per_page: '20' });
      if (expSearch) params.append('search', expSearch);

      const res = await apiClient.get<ExpenseListResponse>(`/petty-cash/funds/${selectedFundId}/expenses?${params}`);
      setExpenses(res.data.items);
      setExpTotal(res.data.total);
      setExpPages(res.data.pages);
    } catch {
      setExpError('Failed to load expenses');
    } finally {
      setExpLoading(false);
    }
  }, [selectedFundId, expPage, expSearch]);

  useEffect(() => {
    if (activeTab !== 'expenses') return;
    const id = setTimeout(fetchExpenses, 300);
    return () => clearTimeout(id);
  }, [fetchExpenses, activeTab]);

  /* ---------------------------------------------------------------- */
  /*  Fetch categories                                                 */
  /* ---------------------------------------------------------------- */

  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const res = await apiClient.get<PettyCashCategory[]>('/petty-cash/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* ignore */
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'categories') fetchCategories();
  }, [activeTab, fetchCategories]);

  /* ---------------------------------------------------------------- */
  /*  Add category                                                     */
  /* ---------------------------------------------------------------- */

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      await apiClient.post('/petty-cash/categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      fetchCategories();
    } catch {
      /* ignore */
    } finally {
      setAddingCategory(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Submit expense                                                   */
  /* ---------------------------------------------------------------- */

  const submitExpense = async () => {
    if (!selectedFundId || !expenseForm.amount) return;
    setExpenseSubmitting(true);
    try {
      await apiClient.post(`/petty-cash/funds/${selectedFundId}/expenses`, {
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        category: expenseForm.category,
        vendor: expenseForm.vendor,
        receipt_number: expenseForm.receipt_number,
      });
      setShowExpenseModal(false);
      fetchExpenses();
      // refresh summary
      const summRes = await apiClient.get<FundSummary>(`/petty-cash/funds/${selectedFundId}/summary`);
      setSummary(summRes.data);
    } catch {
      /* keep modal */
    } finally {
      setExpenseSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Replenish                                                        */
  /* ---------------------------------------------------------------- */

  const submitReplenish = async () => {
    if (!selectedFundId || !replenishForm.amount) return;
    setReplenishSubmitting(true);
    try {
      await apiClient.post(`/petty-cash/funds/${selectedFundId}/replenish`, {
        amount: parseFloat(replenishForm.amount),
        notes: replenishForm.notes,
      });
      setShowReplenishModal(false);
      // refresh summary
      const summRes = await apiClient.get<FundSummary>(`/petty-cash/funds/${selectedFundId}/summary`);
      setSummary(summRes.data);
    } catch {
      /* keep modal */
    } finally {
      setReplenishSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Approve / Reject                                                 */
  /* ---------------------------------------------------------------- */

  const confirmAction = async () => {
    if (!actionExpenseId || !actionType) return;
    setActionSubmitting(true);
    try {
      await apiClient.patch(`/petty-cash/expenses/${actionExpenseId}/${actionType}`);
      setActionExpenseId(null);
      setActionType(null);
      fetchExpenses();
      if (selectedFundId) {
        const summRes = await apiClient.get<FundSummary>(`/petty-cash/funds/${selectedFundId}/summary`);
        setSummary(summRes.data);
      }
    } catch {
      /* keep modal */
    } finally {
      setActionSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Petty Cash</h1>
          <p className="text-gray-400 text-sm mt-1">Manage petty cash funds, expenses and replenishments</p>
        </div>
        <div className="flex items-center gap-2">
          {funds.length > 1 && (
            <select
              value={selectedFundId ?? ''}
              onChange={(e) => { setSelectedFundId(e.target.value); setExpPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => { setReplenishForm({ amount: '', notes: '' }); setShowReplenishModal(true); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Replenish
          </Button>
          <Button size="sm" onClick={() => { setExpenseForm({ amount: '', description: '', category: '', vendor: '', receipt_number: '' }); setShowExpenseModal(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Expense
          </Button>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCardDefs.map((s, i) => {
          const Icon = s.icon;
          const c = colorMap[s.color];
          const raw = summary[s.key];
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

      {/* Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center bg-gray-800/50 border border-gray-700 rounded-lg p-1 w-fit">
        {([
          { key: 'expenses', label: 'Expenses', icon: Receipt },
          { key: 'categories', label: 'Categories', icon: Tag },
          { key: 'replenishments', label: 'Replenishments', icon: RefreshCw },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-blue-600/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </motion.div>

      {/* ============================================================= */}
      {/*  Expenses Tab                                                  */}
      {/* ============================================================= */}
      {activeTab === 'expenses' && (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search expenses…"
              value={expSearch}
              onChange={(e) => { setExpSearch(e.target.value); setExpPage(1); }}
              className="pl-10 bg-gray-800 border-gray-700"
            />
          </div>

          {/* Error */}
          {expError && expenses.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">{expError}</h3>
              <Button variant="outline" onClick={() => fetchExpenses()}>Try Again</Button>
            </motion.div>
          )}

          {/* Loading */}
          {expLoading && expenses.length === 0 && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-800/50 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!expLoading && !expError && expenses.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
              <Receipt className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">No expenses found</h3>
              <p className="text-gray-400 text-sm mt-1">Submit a new expense to get started</p>
            </motion.div>
          )}

          {/* Table */}
          {expenses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Requested By</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-gray-400">{formatDate(exp.date)}</td>
                        <td className="px-4 py-3 text-white">{exp.description}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(toNumber(exp.amount))}</td>
                        <td className="px-4 py-3 text-gray-400">{exp.category}</td>
                        <td className="px-4 py-3 text-gray-400">{exp.requested_by}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${expenseStatusColors[exp.status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                            {exp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {exp.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => { setActionExpenseId(exp.id); setActionType('approve'); }}
                                className="p-1.5 rounded-lg hover:bg-green-700/50 text-gray-400 hover:text-green-300 transition-colors"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setActionExpenseId(exp.id); setActionType('reject'); }}
                                className="p-1.5 rounded-lg hover:bg-red-700/50 text-gray-400 hover:text-red-300 transition-colors"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {expPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
                  <span className="text-sm text-gray-400">Page {expPage} of {expPages} ({expTotal} expenses)</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={expPage <= 1} onClick={() => setExpPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={expPage >= expPages} onClick={() => setExpPage((p) => Math.min(expPages, p + 1))}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ============================================================= */}
      {/*  Categories Tab                                                */}
      {/* ============================================================= */}
      {activeTab === 'categories' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 border border-gray-700 rounded-xl">
          {/* Add form */}
          <div className="p-5 border-b border-gray-700">
            <div className="flex gap-3">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="bg-gray-900 border-gray-700 flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
              />
              <Button disabled={!newCategoryName.trim() || addingCategory} onClick={addCategory}>
                {addingCategory ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-gray-700/50">
            {catLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No categories yet</p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <span className="text-white text-sm">{cat.name}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* ============================================================= */}
      {/*  Replenishments Tab (placeholder)                              */}
      {/* ============================================================= */}
      {activeTab === 'replenishments' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <RefreshCw className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">Replenishment History</h3>
          <p className="text-gray-400 text-sm mt-1 mb-4">View fund replenishment records</p>
          <Button variant="outline" onClick={() => { setReplenishForm({ amount: '', notes: '' }); setShowReplenishModal(true); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Replenish Fund
          </Button>
        </motion.div>
      )}

      {/* ============================================================= */}
      {/*  Submit Expense Modal                                          */}
      {/* ============================================================= */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Submit Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (R)</label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <Input placeholder="What was purchased?" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <Input placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Vendor</label>
                <Input placeholder="Vendor name" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Receipt Number</label>
                <Input placeholder="Receipt #" value={expenseForm.receipt_number} onChange={(e) => setExpenseForm({ ...expenseForm, receipt_number: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowExpenseModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!expenseForm.amount || expenseSubmitting} onClick={submitExpense}>
                  {expenseSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Submit
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Replenish Fund Modal                                          */}
      {/* ============================================================= */}
      {showReplenishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowReplenishModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Replenish Fund</h2>
              <button onClick={() => setShowReplenishModal(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (R)</label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={replenishForm.amount} onChange={(e) => setReplenishForm({ ...replenishForm, amount: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <Input placeholder="Notes (optional)" value={replenishForm.notes} onChange={(e) => setReplenishForm({ ...replenishForm, notes: e.target.value })} className="bg-gray-900 border-gray-700" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowReplenishModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!replenishForm.amount || replenishSubmitting} onClick={submitReplenish}>
                  {replenishSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                  Replenish
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Approve / Reject Confirmation Modal                           */}
      {/* ============================================================= */}
      {actionExpenseId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setActionExpenseId(null); setActionType(null); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-4">
              {actionType === 'approve' ? (
                <Check className="h-12 w-12 text-green-400 mx-auto" />
              ) : (
                <XCircle className="h-12 w-12 text-red-400 mx-auto" />
              )}
              <h2 className="text-lg font-semibold text-white capitalize">{actionType} Expense?</h2>
              <p className="text-gray-400 text-sm">
                Are you sure you want to {actionType} this expense?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setActionExpenseId(null); setActionType(null); }}>Cancel</Button>
                <Button
                  className={`flex-1 ${actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  disabled={actionSubmitting}
                  onClick={confirmAction}
                >
                  {actionSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {actionType === 'approve' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
