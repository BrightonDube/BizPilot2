'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Gift, Plus, CreditCard, ArrowUp, Search, XCircle } from 'lucide-react';

interface GiftCard {
  id: string;
  code: string;
  initial_value: number;
  current_balance: number;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  expires_at: string | null;
  created_at: string;
  transactions?: { id: string; transaction_type: string; amount: number; balance_after: number; created_at: string }[];
}

interface Stats { total_issued: number; total_redeemed: number; outstanding_balance: number; active_count: number; }

const STATUS_COLORS: Record<string, string> = { active: 'bg-green-100 text-green-800', redeemed: 'bg-gray-100 text-gray-800', expired: 'bg-yellow-100 text-yellow-800', cancelled: 'bg-red-100 text-red-800' };

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GiftCard | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [newCard, setNewCard] = useState({ initial_value: 100, customer_name: '', customer_email: '' });
  const [redeemAmount, setRedeemAmount] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');

  const fmt = (v: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);

  const fetch = useCallback(async () => {
    try {
      const [cardsRes, statsRes] = await Promise.all([apiClient.get('/gift-cards/'), apiClient.get('/gift-cards/stats')]);
      setCards(cardsRes.data.items || cardsRes.data);
      setStats(statsRes.data);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async () => { try { await apiClient.post('/gift-cards/', newCard); setShowCreate(false); fetch(); } catch { /* */ } };
  const redeem = async () => { if (!selected) return; try { await apiClient.post(`/gift-cards/${selected.id}/redeem`, { amount: parseFloat(redeemAmount) }); setShowRedeem(false); fetch(); } catch { /* */ } };
  const topUp = async () => { if (!selected) return; try { await apiClient.post(`/gift-cards/${selected.id}/top-up`, { amount: parseFloat(topUpAmount) }); setShowTopUp(false); fetch(); } catch { /* */ } };
  const cancel = async (id: string) => { try { await apiClient.patch(`/gift-cards/${id}/cancel`); fetch(); } catch { /* */ } };
  const lookup = async () => { try { const res = await apiClient.get(`/gift-cards/code/${lookupCode}`); setSelected(res.data); } catch { /* */ } };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="w-6 h-6" /> Gift Cards</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Issue Card</button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[{ l: 'Total Issued', v: fmt(stats.total_issued) }, { l: 'Total Redeemed', v: fmt(stats.total_redeemed) }, { l: 'Outstanding', v: fmt(stats.outstanding_balance) }, { l: 'Active Cards', v: stats.active_count }].map(s => (
            <div key={s.l} className="bg-white rounded-lg shadow p-4"><p className="text-2xl font-bold">{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input placeholder="Lookup by code..." value={lookupCode} onChange={e => setLookupCode(e.target.value)} className="border rounded-lg p-2 text-sm w-48" />
        <button onClick={lookup} className="bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200"><Search className="w-4 h-4" /></button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">Issue Gift Card</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input type="number" placeholder="Value (R)" value={newCard.initial_value} onChange={e => setNewCard({ ...newCard, initial_value: parseFloat(e.target.value) || 0 })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Customer name" value={newCard.customer_name} onChange={e => setNewCard({ ...newCard, customer_name: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Customer email" value={newCard.customer_email} onChange={e => setNewCard({ ...newCard, customer_email: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>
          <div className="flex gap-2"><button onClick={create} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Issue</button><button onClick={() => setShowCreate(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="text-left p-3">Code</th><th className="text-left p-3">Customer</th><th className="text-right p-3">Balance</th><th className="text-center p-3">Status</th><th className="text-right p-3">Actions</th></tr></thead>
              <tbody>{cards.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} className={`border-t cursor-pointer hover:bg-gray-50 ${selected?.id === c.id ? 'bg-blue-50' : ''}`}>
                  <td className="p-3 font-mono">{c.code}</td>
                  <td className="p-3">{c.customer_name || '—'}</td>
                  <td className="p-3 text-right font-medium">{fmt(c.current_balance)}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>{c.status}</span></td>
                  <td className="p-3 text-right">{c.status === 'active' && <button onClick={e => { e.stopPropagation(); cancel(c.id); }} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>}</td>
                </tr>
              ))}</tbody>
            </table>
            {!cards.length && <p className="text-center py-8 text-gray-400">No gift cards issued</p>}
          </div>
        </div>

        {selected && (
          <div className="w-80 bg-white rounded-lg shadow p-4 sticky top-6 self-start">
            <h3 className="font-bold text-lg mb-1">{selected.code}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[selected.status] || 'bg-gray-100'}`}>{selected.status}</span>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Initial Value</span><span>{fmt(selected.initial_value)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="font-bold text-lg">{fmt(selected.current_balance)}</span></div>
              {selected.customer_name && <p className="text-gray-600">{selected.customer_name}</p>}
            </div>
            {selected.status === 'active' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowRedeem(true)} className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-sm hover:bg-orange-200"><CreditCard className="w-3.5 h-3.5" /> Redeem</button>
                <button onClick={() => setShowTopUp(true)} className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm hover:bg-green-200"><ArrowUp className="w-3.5 h-3.5" /> Top Up</button>
              </div>
            )}
            {showRedeem && (
              <div className="mt-3 flex gap-2"><input type="number" placeholder="Amount" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} className="border rounded p-1.5 text-sm flex-1" /><button onClick={redeem} className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm">Redeem</button></div>
            )}
            {showTopUp && (
              <div className="mt-3 flex gap-2"><input type="number" placeholder="Amount" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} className="border rounded p-1.5 text-sm flex-1" /><button onClick={topUp} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Top Up</button></div>
            )}
            {selected.transactions && selected.transactions.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Transactions</h4>
                {selected.transactions.map(t => (
                  <div key={t.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                    <span className="capitalize">{t.transaction_type}</span>
                    <span className={t.transaction_type === 'redeem' ? 'text-red-600' : 'text-green-600'}>{t.transaction_type === 'redeem' ? '-' : '+'}{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
