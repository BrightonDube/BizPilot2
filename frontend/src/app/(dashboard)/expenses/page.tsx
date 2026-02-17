'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Receipt, Plus, CheckCircle, XCircle, DollarSign, BarChart3 } from 'lucide-react';

type Tab = 'expenses' | 'categories' | 'summary';

interface Expense {
  id: string;
  amount: number;
  description: string;
  vendor: string | null;
  expense_date: string;
  status: string;
  payment_method: string | null;
  category?: { name: string };
  submitter?: { full_name?: string; email?: string };
  created_at: string;
}

interface ExpenseCategory { id: string; name: string; description: string | null; budget_limit: number | null; }
interface Summary { total: number; by_category: Record<string, number>; by_status: Record<string, number>; }

const STATUS_COLORS: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-blue-100 text-blue-800', rejected: 'bg-red-100 text-red-800', paid: 'bg-green-100 text-green-800' };

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [newExpense, setNewExpense] = useState({ amount: 0, description: '', vendor: '', category_id: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'cash' });
  const [newCat, setNewCat] = useState({ name: '', description: '', budget_limit: null as number | null });

  const fmt = (v: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);

  const fetchAll = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { per_page: 50 };
      if (statusFilter) params.status = statusFilter;
      const [expRes, catRes, sumRes] = await Promise.all([
        apiClient.get('/expenses/', { params }),
        apiClient.get('/expenses/categories'),
        apiClient.get('/expenses/summary'),
      ]);
      setExpenses(expRes.data.items || expRes.data);
      setCategories(catRes.data);
      setSummary(sumRes.data);
    } catch { /* */ } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createExpense = async () => {
    try {
      await apiClient.post('/expenses/', { ...newExpense, amount: parseFloat(String(newExpense.amount)), category_id: newExpense.category_id || undefined });
      setShowCreate(false);
      fetchAll();
    } catch { /* */ }
  };

  const createCategory = async () => {
    try { await apiClient.post('/expenses/categories', newCat); setShowCreateCat(false); fetchAll(); } catch { /* */ }
  };

  const approve = async (id: string) => { try { await apiClient.patch(`/expenses/${id}/approve`); fetchAll(); } catch { /* */ } };
  const reject = async (id: string) => { try { await apiClient.patch(`/expenses/${id}/reject`); fetchAll(); } catch { /* */ } };
  const markPaid = async (id: string) => { try { await apiClient.patch(`/expenses/${id}/paid`); fetchAll(); } catch { /* */ } };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6" /> Expenses</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> New Expense</button>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {(['expenses', 'categories', 'summary'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 border-b-2 capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">New Expense</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input type="number" step="0.01" placeholder="Amount *" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} className="border rounded-lg p-2 text-sm" />
            <input type="date" value={newExpense.expense_date} onChange={e => setNewExpense({ ...newExpense, expense_date: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <select value={newExpense.category_id} onChange={e => setNewExpense({ ...newExpense, category_id: e.target.value })} className="border rounded-lg p-2 text-sm">
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Description *" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="border rounded-lg p-2 text-sm col-span-2" />
            <input placeholder="Vendor" value={newExpense.vendor} onChange={e => setNewExpense({ ...newExpense, vendor: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>
          <div className="flex gap-2"><button onClick={createExpense} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Submit</button><button onClick={() => setShowCreate(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      {tab === 'expenses' && (
        <>
          <div className="flex gap-2 mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg p-2 text-sm">
              <option value="">All Statuses</option>
              {['pending', 'approved', 'rejected', 'paid'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="text-left p-3">Date</th><th className="text-left p-3">Description</th><th className="text-left p-3">Category</th><th className="text-left p-3">Vendor</th><th className="text-right p-3">Amount</th><th className="text-center p-3">Status</th><th className="text-right p-3">Actions</th></tr></thead>
              <tbody>{expenses.map(e => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{e.expense_date}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3">{e.category?.name || '—'}</td>
                  <td className="p-3">{e.vendor || '—'}</td>
                  <td className="p-3 text-right font-medium">{fmt(e.amount)}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[e.status] || 'bg-gray-100'}`}>{e.status}</span></td>
                  <td className="p-3 text-right flex gap-1 justify-end">
                    {e.status === 'pending' && <><button onClick={() => approve(e.id)} className="text-green-600 hover:text-green-800" title="Approve"><CheckCircle className="w-4 h-4" /></button><button onClick={() => reject(e.id)} className="text-red-500 hover:text-red-700" title="Reject"><XCircle className="w-4 h-4" /></button></>}
                    {e.status === 'approved' && <button onClick={() => markPaid(e.id)} className="text-blue-600 hover:text-blue-800" title="Mark paid"><DollarSign className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {!expenses.length && <p className="text-center py-8 text-gray-400">No expenses</p>}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div>
          <button onClick={() => setShowCreateCat(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm mb-4 flex items-center gap-1"><Plus className="w-4 h-4" /> Add Category</button>
          {showCreateCat && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input placeholder="Name *" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="border rounded-lg p-2 text-sm" />
                <input placeholder="Description" value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} className="border rounded-lg p-2 text-sm" />
                <input type="number" placeholder="Budget limit" value={newCat.budget_limit ?? ''} onChange={e => setNewCat({ ...newCat, budget_limit: e.target.value ? parseFloat(e.target.value) : null })} className="border rounded-lg p-2 text-sm" />
              </div>
              <div className="flex gap-2"><button onClick={createCategory} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button><button onClick={() => setShowCreateCat(false)} className="text-gray-500 text-sm">Cancel</button></div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {categories.map(c => (
              <div key={c.id} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold">{c.name}</h3>
                {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
                {c.budget_limit && <p className="text-sm mt-1">Budget: {fmt(c.budget_limit)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'summary' && summary && (
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Total</h3>
            <p className="text-3xl font-bold">{fmt(summary.total)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">By Category</h3>
            {Object.entries(summary.by_category).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 text-sm"><span>{k}</span><span className="font-medium">{fmt(v)}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">By Status</h3>
            {Object.entries(summary.by_status).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 text-sm"><span className="capitalize">{k}</span><span className="font-medium">{fmt(v)}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
