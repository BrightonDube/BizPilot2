'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader, Badge, LoadingSpinner, EmptyState } from '@/components/ui/bizpilot';
import {
  BookOpen, FileText, Scale, BarChart3, Plus, ChevronDown, ChevronUp,
  Send, X, Trash2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
}

interface JournalLine {
  id?: string;
  account_id: string;
  account_name?: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  date: string;
  description: string;
  status: string;
  lines: JournalLine[];
  total_debit: number;
  total_credit: number;
  created_at: string;
}

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  debit_balance: number;
  credit_balance: number;
}

interface IncomeStatement {
  revenue: Array<{ name: string; amount: number }>;
  expenses: Array<{ name: string; amount: number }>;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
}

interface BalanceSheet {
  assets: Array<{ name: string; amount: number }>;
  liabilities: Array<{ name: string; amount: number }>;
  equity: Array<{ name: string; amount: number }>;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}

type TabKey = 'accounts' | 'journal' | 'trial-balance' | 'reports';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'accounts', label: 'Chart of Accounts', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'journal', label: 'Journal Entries', icon: <FileText className="w-4 h-4" /> },
  { key: 'trial-balance', label: 'Trial Balance', icon: <Scale className="w-4 h-4" /> },
  { key: 'reports', label: 'Financial Reports', icon: <BarChart3 className="w-4 h-4" /> },
];

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  liability: 'bg-red-500/10 text-red-400 border-red-500/20',
  equity: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  revenue: 'bg-green-500/10 text-green-400 border-green-500/20',
  expense: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  posted: 'bg-green-500/10 text-green-400 border-green-500/20',
  voided: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GeneralLedgerPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('accounts');
  const [loading, setLoading] = useState(true);

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset' });

  // Journal state
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEntry, setNewEntry] = useState({ date: '', description: '' });
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
  ]);

  // Trial balance state
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);

  // Reports state
  const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' });
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: Account[] }>('/ledger/accounts');
      setAccounts(res.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchJournalEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [jeRes, accRes] = await Promise.all([
        apiClient.get<{ items: JournalEntry[] }>('/ledger/journal-entries'),
        apiClient.get<{ items: Account[] }>('/ledger/accounts'),
      ]);
      setJournalEntries(jeRes.data.items || []);
      setAccounts(accRes.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: TrialBalanceRow[] }>('/ledger/trial-balance');
      setTrialBalance(res.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'accounts') fetchAccounts();
    else if (activeTab === 'journal') fetchJournalEntries();
    else if (activeTab === 'trial-balance') fetchTrialBalance();
    else if (activeTab === 'reports') setLoading(false);
  }, [activeTab, fetchAccounts, fetchJournalEntries, fetchTrialBalance]);

  const handleAddAccount = async () => {
    if (!accountForm.code || !accountForm.name) return;
    try {
      await apiClient.post('/ledger/accounts', accountForm);
      setAccountForm({ code: '', name: '', type: 'asset' });
      fetchAccounts();
    } catch { /* empty */ }
  };

  const handleCreateJournalEntry = async () => {
    if (!newEntry.date || !newEntry.description || newLines.length < 2) return;
    const totalDebit = newLines.reduce((s, l) => s + Number(l.debit_amount), 0);
    const totalCredit = newLines.reduce((s, l) => s + Number(l.credit_amount), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      alert('Total debits must equal total credits.');
      return;
    }
    try {
      await apiClient.post('/ledger/journal-entries', {
        ...newEntry,
        lines: newLines.filter((l) => l.account_id),
      });
      setShowCreateModal(false);
      setNewEntry({ date: '', description: '' });
      setNewLines([
        { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
        { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
      ]);
      fetchJournalEntries();
    } catch { /* empty */ }
  };

  const handlePostEntry = async (id: string) => {
    try {
      await apiClient.patch(`/ledger/journal-entries/${id}/post`);
      fetchJournalEntries();
    } catch { /* empty */ }
  };

  const handleVoidEntry = async (id: string) => {
    try {
      await apiClient.patch(`/ledger/journal-entries/${id}/void`);
      fetchJournalEntries();
    } catch { /* empty */ }
  };

  const addLine = () => {
    setNewLines([...newLines, { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }]);
  };

  const removeLine = (index: number) => {
    if (newLines.length <= 2) return;
    setNewLines(newLines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string | number) => {
    const updated = [...newLines];
    updated[index] = { ...updated[index], [field]: value };
    setNewLines(updated);
  };

  const totalNewDebit = newLines.reduce((s, l) => s + Number(l.debit_amount), 0);
  const totalNewCredit = newLines.reduce((s, l) => s + Number(l.credit_amount), 0);
  const isBalanced = Math.abs(totalNewDebit - totalNewCredit) < 0.01 && totalNewDebit > 0;

  const fetchReports = async () => {
    if (!dateRange.start_date || !dateRange.end_date) return;
    setLoading(true);
    try {
      const params = `?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
      const [isRes, bsRes] = await Promise.all([
        apiClient.get<IncomeStatement>(`/ledger/income-statement${params}`),
        apiClient.get<BalanceSheet>(`/ledger/balance-sheet${params}`),
      ]);
      setIncomeStatement(isRes.data);
      setBalanceSheet(bsRes.data);
    } catch { /* empty */ }
    setLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="General Ledger" description="Double-entry accounting and financial reports" />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors
              ${activeTab === tab.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* ── Chart of Accounts ─────────────────────────────────────────────── */}
      {!loading && activeTab === 'accounts' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Add Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Account code"
                value={accountForm.code}
                onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Input
                placeholder="Account name"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <select
                value={accountForm.type}
                onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <Button onClick={handleAddAccount} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Account
              </Button>
            </div>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium px-6 py-3">Code</th>
                  <th className="text-left text-gray-400 font-medium px-6 py-3">Name</th>
                  <th className="text-left text-gray-400 font-medium px-6 py-3">Type</th>
                  <th className="text-right text-gray-400 font-medium px-6 py-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-gray-400 py-8">No accounts found.</td></tr>
                ) : (
                  accounts.map((a) => (
                    <tr key={a.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-6 py-3 text-white font-mono">{a.code}</td>
                      <td className="px-6 py-3 text-white">{a.name}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${ACCOUNT_TYPE_COLORS[a.type] || 'text-gray-400'}`}>
                          {a.type.charAt(0).toUpperCase() + a.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-white font-mono">{formatCurrency(a.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Journal Entries ────────────────────────────────────────────────── */}
      {!loading && activeTab === 'journal' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> New Journal Entry
            </Button>
          </div>

          {journalEntries.length === 0 ? (
            <EmptyState icon={FileText} title="No Journal Entries" description="Create your first journal entry." />
          ) : (
            <div className="space-y-3">
              {journalEntries.map((je) => (
                <Card key={je.id} className="bg-gray-800/50 border-gray-700 p-0 overflow-hidden">
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === je.id ? null : je.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-white font-mono text-sm">{je.entry_number}</span>
                      <span className="text-gray-400 text-sm">{formatDate(je.date)}</span>
                      <span className="text-white text-sm">{je.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[je.status] || ''}`}>
                        {je.status.charAt(0).toUpperCase() + je.status.slice(1)}
                      </span>
                      <span className="text-gray-400 text-xs">
                        D: {formatCurrency(je.total_debit)} / C: {formatCurrency(je.total_credit)}
                      </span>
                      {je.status === 'draft' && (
                        <>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePostEntry(je.id); }} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                            <Send className="w-3 h-3 mr-1" /> Post
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleVoidEntry(je.id); }} className="border-red-500 text-red-400 hover:bg-red-500/10 text-xs">
                            <X className="w-3 h-3 mr-1" /> Void
                          </Button>
                        </>
                      )}
                      {expandedEntry === je.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedEntry === je.id && je.lines && (
                    <div className="border-t border-gray-700 px-4 pb-4">
                      <table className="w-full text-sm mt-2">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left py-2 font-medium">Account</th>
                            <th className="text-left py-2 font-medium">Description</th>
                            <th className="text-right py-2 font-medium">Debit</th>
                            <th className="text-right py-2 font-medium">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {je.lines.map((line, idx) => (
                            <tr key={line.id || idx} className="border-t border-gray-700/50">
                              <td className="py-2 text-white">{line.account_name || line.account_id}</td>
                              <td className="py-2 text-gray-400">{line.description}</td>
                              <td className="py-2 text-right text-white font-mono">{line.debit_amount > 0 ? formatCurrency(line.debit_amount) : ''}</td>
                              <td className="py-2 text-right text-white font-mono">{line.credit_amount > 0 ? formatCurrency(line.credit_amount) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Create Journal Entry Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">New Journal Entry</h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  <Input
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Input
                    placeholder="Description"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium text-sm">Lines</h4>
                    <Button size="sm" variant="outline" onClick={addLine} className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      <Plus className="w-3 h-3 mr-1" /> Add Line
                    </Button>
                  </div>
                  {newLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={line.account_id}
                        onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                        className="col-span-4 bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-2 text-sm"
                      >
                        <option value="">Select account...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        placeholder="Debit"
                        value={line.debit_amount || ''}
                        onChange={(e) => updateLine(idx, 'debit_amount', parseFloat(e.target.value) || 0)}
                        className="col-span-2 bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        type="number"
                        placeholder="Credit"
                        value={line.credit_amount || ''}
                        onChange={(e) => updateLine(idx, 'credit_amount', parseFloat(e.target.value) || 0)}
                        className="col-span-2 bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        className="col-span-3 bg-gray-800 border-gray-600 text-white"
                      />
                      <button onClick={() => removeLine(idx)} className="col-span-1 text-gray-400 hover:text-red-400 flex justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700 mb-6">
                  <div className="flex gap-6 text-sm">
                    <span className="text-gray-400">Total Debit: <span className="text-white font-mono">{formatCurrency(totalNewDebit)}</span></span>
                    <span className="text-gray-400">Total Credit: <span className="text-white font-mono">{formatCurrency(totalNewCredit)}</span></span>
                  </div>
                  <span className={`text-sm font-medium ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                    {isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                  </span>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateJournalEntry} disabled={!isBalanced} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50">
                    Create Entry
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Trial Balance ──────────────────────────────────────────────────── */}
      {!loading && activeTab === 'trial-balance' && (
        <Card className="bg-gray-800/50 border-gray-700 p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium px-6 py-3">Account Code</th>
                <th className="text-left text-gray-400 font-medium px-6 py-3">Account Name</th>
                <th className="text-right text-gray-400 font-medium px-6 py-3">Debit</th>
                <th className="text-right text-gray-400 font-medium px-6 py-3">Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-400 py-8">No trial balance data.</td></tr>
              ) : (
                <>
                  {trialBalance.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-6 py-3 text-white font-mono">{row.account_code}</td>
                      <td className="px-6 py-3 text-white">{row.account_name}</td>
                      <td className="px-6 py-3 text-right text-white font-mono">{row.debit_balance > 0 ? formatCurrency(row.debit_balance) : ''}</td>
                      <td className="px-6 py-3 text-right text-white font-mono">{row.credit_balance > 0 ? formatCurrency(row.credit_balance) : ''}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-600 bg-gray-700/30 font-semibold">
                    <td className="px-6 py-3 text-white" colSpan={2}>Totals</td>
                    <td className="px-6 py-3 text-right text-white font-mono">
                      {formatCurrency(trialBalance.reduce((s, r) => s + r.debit_balance, 0))}
                    </td>
                    <td className="px-6 py-3 text-right text-white font-mono">
                      {formatCurrency(trialBalance.reduce((s, r) => s + r.credit_balance, 0))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Financial Reports ─────────────────────────────────────────────── */}
      {!loading && activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Date Range</h3>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">End Date</label>
                <Input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <Button onClick={fetchReports} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                Generate Reports
              </Button>
            </div>
          </Card>

          {incomeStatement && (
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Income Statement</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-2 text-gray-400 font-semibold" colSpan={2}>Revenue</td></tr>
                  {incomeStatement.revenue.map((r, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 pl-4 text-white">{r.name}</td>
                      <td className="py-2 text-right text-green-400 font-mono">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-gray-600">
                    <td className="py-2 text-white font-semibold">Total Revenue</td>
                    <td className="py-2 text-right text-green-400 font-mono font-semibold">{formatCurrency(incomeStatement.total_revenue)}</td>
                  </tr>

                  <tr><td className="py-2 pt-4 text-gray-400 font-semibold" colSpan={2}>Expenses</td></tr>
                  {incomeStatement.expenses.map((e, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 pl-4 text-white">{e.name}</td>
                      <td className="py-2 text-right text-red-400 font-mono">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-gray-600">
                    <td className="py-2 text-white font-semibold">Total Expenses</td>
                    <td className="py-2 text-right text-red-400 font-mono font-semibold">{formatCurrency(incomeStatement.total_expenses)}</td>
                  </tr>

                  <tr className="border-t-2 border-gray-500">
                    <td className="py-3 text-white font-bold text-base">Net Income</td>
                    <td className={`py-3 text-right font-mono font-bold text-base ${incomeStatement.net_income >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(incomeStatement.net_income)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          )}

          {balanceSheet && (
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Balance Sheet</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-2 text-gray-400 font-semibold" colSpan={2}>Assets</td></tr>
                  {balanceSheet.assets.map((a, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 pl-4 text-white">{a.name}</td>
                      <td className="py-2 text-right text-white font-mono">{formatCurrency(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-gray-600">
                    <td className="py-2 text-white font-semibold">Total Assets</td>
                    <td className="py-2 text-right text-blue-400 font-mono font-semibold">{formatCurrency(balanceSheet.total_assets)}</td>
                  </tr>

                  <tr><td className="py-2 pt-4 text-gray-400 font-semibold" colSpan={2}>Liabilities</td></tr>
                  {balanceSheet.liabilities.map((l, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 pl-4 text-white">{l.name}</td>
                      <td className="py-2 text-right text-white font-mono">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-gray-600">
                    <td className="py-2 text-white font-semibold">Total Liabilities</td>
                    <td className="py-2 text-right text-red-400 font-mono font-semibold">{formatCurrency(balanceSheet.total_liabilities)}</td>
                  </tr>

                  <tr><td className="py-2 pt-4 text-gray-400 font-semibold" colSpan={2}>Equity</td></tr>
                  {balanceSheet.equity.map((eq, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 pl-4 text-white">{eq.name}</td>
                      <td className="py-2 text-right text-white font-mono">{formatCurrency(eq.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-500">
                    <td className="py-3 text-white font-bold text-base">Total Liabilities + Equity</td>
                    <td className="py-3 text-right text-purple-400 font-mono font-bold text-base">
                      {formatCurrency(balanceSheet.total_liabilities + balanceSheet.total_equity)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
