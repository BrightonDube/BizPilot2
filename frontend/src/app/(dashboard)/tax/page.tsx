'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Plus, Trash2, Calculator, Percent, CheckCircle } from 'lucide-react';

interface TaxRate {
  id: string;
  name: string;
  code: string | null;
  tax_type: string;
  rate: number;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  is_inclusive: boolean;
}

interface TaxCalcResult {
  tax_amount: number;
  net_amount: number;
  gross_amount: number;
  rates_applied: { name: string; rate: number; amount: number }[];
}

export default function TaxPage() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmount, setCalcAmount] = useState('100');
  const [calcResult, setCalcResult] = useState<TaxCalcResult | null>(null);
  const [newRate, setNewRate] = useState({
    name: '', code: '', tax_type: 'vat' as string, rate: 15, description: '',
    is_default: false, is_inclusive: true,
  });

  const fetchRates = useCallback(async () => {
    try { const res = await apiClient.get('/tax/rates', { params: { include_inactive: true } }); setRates(res.data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const createRate = async () => {
    try {
      await apiClient.post('/tax/rates', { ...newRate, rate: parseFloat(String(newRate.rate)) });
      setShowCreate(false);
      setNewRate({ name: '', code: '', tax_type: 'vat', rate: 15, description: '', is_default: false, is_inclusive: true });
      fetchRates();
    } catch { /* ignore */ }
  };

  const deleteRate = async (id: string) => {
    try { await apiClient.delete(`/tax/rates/${id}`); fetchRates(); } catch { /* ignore */ }
  };

  const toggleDefault = async (id: string, rate: TaxRate) => {
    try { await apiClient.put(`/tax/rates/${id}`, { is_default: !rate.is_default }); fetchRates(); } catch { /* ignore */ }
  };

  const toggleActive = async (id: string, rate: TaxRate) => {
    try { await apiClient.put(`/tax/rates/${id}`, { is_active: !rate.is_active }); fetchRates(); } catch { /* ignore */ }
  };

  const calculate = async () => {
    try {
      const res = await apiClient.post('/tax/calculate', { amount: parseFloat(calcAmount) });
      setCalcResult(res.data);
    } catch { /* ignore */ }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Percent className="w-6 h-6" /> Tax Configuration</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCalc(!showCalc)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm">
            <Calculator className="w-4 h-4" /> Calculator
          </button>
          <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Tax Rate
          </button>
        </div>
      </div>

      {showCalc && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-medium mb-3">Tax Calculator</h3>
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Amount (R)</label>
              <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} className="border rounded-lg p-2 text-sm w-40" />
            </div>
            <button onClick={calculate} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Calculate</button>
          </div>
          {calcResult && (
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Net:</span> <span className="font-medium">{formatCurrency(calcResult.net_amount)}</span></div>
              <div><span className="text-gray-500">Tax:</span> <span className="font-medium text-red-600">{formatCurrency(calcResult.tax_amount)}</span></div>
              <div><span className="text-gray-500">Gross:</span> <span className="font-bold">{formatCurrency(calcResult.gross_amount)}</span></div>
              {calcResult.rates_applied?.map((r, i) => (
                <div key={i} className="text-xs text-gray-400">{r.name}: {r.rate}% = {formatCurrency(r.amount)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-medium mb-3">New Tax Rate</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input placeholder="Name *" value={newRate.name} onChange={e => setNewRate({ ...newRate, name: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Code" value={newRate.code} onChange={e => setNewRate({ ...newRate, code: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <select value={newRate.tax_type} onChange={e => setNewRate({ ...newRate, tax_type: e.target.value })} className="border rounded-lg p-2 text-sm">
              <option value="vat">VAT</option><option value="sales_tax">Sales Tax</option>
              <option value="service_tax">Service Tax</option><option value="excise">Excise</option><option value="custom">Custom</option>
            </select>
            <input type="number" step="0.01" placeholder="Rate (%)" value={newRate.rate} onChange={e => setNewRate({ ...newRate, rate: parseFloat(e.target.value) || 0 })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Description" value={newRate.description} onChange={e => setNewRate({ ...newRate, description: e.target.value })} className="border rounded-lg p-2 text-sm col-span-2" />
          </div>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newRate.is_inclusive} onChange={e => setNewRate({ ...newRate, is_inclusive: e.target.checked })} /> Price inclusive</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newRate.is_default} onChange={e => setNewRate({ ...newRate, is_default: e.target.checked })} /> Default rate</label>
          </div>
          <div className="flex gap-2"><button onClick={createRate} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button><button onClick={() => setShowCreate(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-3">Name</th><th className="text-left p-3">Code</th>
            <th className="text-left p-3">Type</th><th className="text-right p-3">Rate</th>
            <th className="text-center p-3">Inclusive</th><th className="text-center p-3">Default</th>
            <th className="text-center p-3">Active</th><th className="text-right p-3">Actions</th>
          </tr></thead>
          <tbody>{rates.map(r => (
            <tr key={r.id} className={`border-t hover:bg-gray-50 ${!r.is_active ? 'opacity-50' : ''}`}>
              <td className="p-3 font-medium">{r.name}</td>
              <td className="p-3 text-gray-500">{r.code || '—'}</td>
              <td className="p-3 capitalize">{r.tax_type.replace(/_/g, ' ')}</td>
              <td className="p-3 text-right font-medium">{r.rate}%</td>
              <td className="p-3 text-center">{r.is_inclusive ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : '—'}</td>
              <td className="p-3 text-center">
                <button onClick={() => toggleDefault(r.id, r)} className={r.is_default ? 'text-blue-600' : 'text-gray-300 hover:text-blue-400'}>
                  <CheckCircle className="w-4 h-4 mx-auto" />
                </button>
              </td>
              <td className="p-3 text-center">
                <button onClick={() => toggleActive(r.id, r)} className={`text-xs px-2 py-0.5 rounded ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.is_active ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="p-3 text-right">
                <button onClick={() => deleteRate(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!rates.length && <p className="text-center py-8 text-gray-400">No tax rates configured</p>}
      </div>
    </div>
  );
}
