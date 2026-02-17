'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Monitor, Plus, PlayCircle, StopCircle, DollarSign, ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';

type Tab = 'registers' | 'sessions' | 'report';

interface Register { id: string; name: string; is_active: boolean; }

interface Session {
  id: string;
  register_id: string;
  status: string;
  opening_float: number;
  closing_float: number | null;
  expected_cash: number | null;
  actual_cash: number | null;
  cash_difference: number | null;
  total_sales: number;
  total_refunds: number;
  transaction_count: number;
  opened_at: string;
  closed_at: string | null;
  register?: { name: string };
  movements?: { id: string; movement_type: string; amount: number; reason: string; created_at: string }[];
}

interface Report { total_sessions: number; total_sales: number; avg_cash_difference: number; sessions_with_discrepancy: number; }

const STATUS_COLORS: Record<string, string> = { open: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-800', suspended: 'bg-yellow-100 text-yellow-800' };

export default function RegistersPage() {
  const [tab, setTab] = useState<Tab>('registers');
  const [registers, setRegisters] = useState<Register[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showOpen, setShowOpen] = useState<string | null>(null);
  const [showClose, setShowClose] = useState<string | null>(null);
  const [showMovement, setShowMovement] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [openFloat, setOpenFloat] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [movement, setMovement] = useState({ movement_type: 'cash_in', amount: 0, reason: '' });

  const fmt = (v: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);

  const fetchAll = useCallback(async () => {
    try {
      const [regRes, sesRes, repRes] = await Promise.all([
        apiClient.get('/registers/'), apiClient.get('/registers/sessions'), apiClient.get('/registers/report'),
      ]);
      setRegisters(regRes.data);
      setSessions(sesRes.data.items || sesRes.data);
      setReport(repRes.data);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createRegister = async () => { try { await apiClient.post('/registers/', { name: newName }); setShowCreate(false); setNewName(''); fetchAll(); } catch { /* */ } };
  const openSession = async (regId: string) => { try { await apiClient.post(`/registers/${regId}/open`, { opening_float: parseFloat(openFloat) || 0 }); setShowOpen(null); fetchAll(); } catch { /* */ } };
  const closeSession = async (sesId: string) => { try { await apiClient.post(`/registers/sessions/${sesId}/close`, { actual_cash: parseFloat(actualCash), notes: closeNotes || undefined }); setShowClose(null); fetchAll(); } catch { /* */ } };
  const addMovement = async (sesId: string) => { try { await apiClient.post(`/registers/sessions/${sesId}/movement`, movement); setShowMovement(null); fetchAll(); } catch { /* */ } };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Monitor className="w-6 h-6" /> Cash Registers</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> New Register</button>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {(['registers', 'sessions', 'report'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 border-b-2 capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex gap-3 items-end">
          <input placeholder="Register name *" value={newName} onChange={e => setNewName(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <button onClick={createRegister} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
          <button onClick={() => setShowCreate(false)} className="text-gray-500 text-sm">Cancel</button>
        </div>
      )}

      {tab === 'registers' && (
        <div className="grid grid-cols-3 gap-4">
          {registers.map(r => (
            <div key={r.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">{r.name}</h3>
                <span className={`text-xs ${r.is_active ? 'text-green-600' : 'text-red-500'}`}>{r.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowOpen(r.id)} className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm hover:bg-green-200"><PlayCircle className="w-3.5 h-3.5" /> Open</button>
              </div>
              {showOpen === r.id && (
                <div className="mt-3 flex gap-2">
                  <input type="number" placeholder="Opening float" value={openFloat} onChange={e => setOpenFloat(e.target.value)} className="border rounded p-1.5 text-sm flex-1" />
                  <button onClick={() => openSession(r.id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Start</button>
                </div>
              )}
            </div>
          ))}
          {!registers.length && <p className="col-span-3 text-center py-8 text-gray-400">No registers</p>}
        </div>
      )}

      {tab === 'sessions' && (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium">{s.register?.name || 'Register'}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status}</span>
                </div>
                <span className="text-sm text-gray-400">{new Date(s.opened_at).toLocaleString('en-ZA')}</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                <div><span className="text-gray-500">Float:</span> <span className="font-medium">{fmt(s.opening_float)}</span></div>
                <div><span className="text-gray-500">Sales:</span> <span className="font-medium">{fmt(s.total_sales)}</span></div>
                <div><span className="text-gray-500">Transactions:</span> <span className="font-medium">{s.transaction_count}</span></div>
                {s.cash_difference !== null && (
                  <div><span className="text-gray-500">Difference:</span> <span className={`font-medium ${s.cash_difference === 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(s.cash_difference)}</span></div>
                )}
              </div>
              {s.status === 'open' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowMovement(s.id)} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm"><DollarSign className="w-3.5 h-3.5" /> Movement</button>
                  <button onClick={() => setShowClose(s.id)} className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm"><StopCircle className="w-3.5 h-3.5" /> Close</button>
                </div>
              )}
              {showMovement === s.id && (
                <div className="mt-3 flex gap-2 items-end">
                  <select value={movement.movement_type} onChange={e => setMovement({ ...movement, movement_type: e.target.value })} className="border rounded p-1.5 text-sm">
                    <option value="cash_in">Cash In</option><option value="cash_out">Cash Out</option><option value="pay_in">Pay In</option><option value="pay_out">Pay Out</option>
                  </select>
                  <input type="number" placeholder="Amount" value={movement.amount || ''} onChange={e => setMovement({ ...movement, amount: parseFloat(e.target.value) || 0 })} className="border rounded p-1.5 text-sm w-24" />
                  <input placeholder="Reason" value={movement.reason} onChange={e => setMovement({ ...movement, reason: e.target.value })} className="border rounded p-1.5 text-sm flex-1" />
                  <button onClick={() => addMovement(s.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Add</button>
                </div>
              )}
              {showClose === s.id && (
                <div className="mt-3 flex gap-2">
                  <input type="number" placeholder="Actual cash" value={actualCash} onChange={e => setActualCash(e.target.value)} className="border rounded p-1.5 text-sm w-32" />
                  <input placeholder="Notes" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} className="border rounded p-1.5 text-sm flex-1" />
                  <button onClick={() => closeSession(s.id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Close</button>
                </div>
              )}
              {s.movements && s.movements.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  {s.movements.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-xs py-1">
                      {m.movement_type.includes('in') ? <ArrowDown className="w-3 h-3 text-green-500" /> : <ArrowUp className="w-3 h-3 text-red-500" />}
                      <span className="capitalize">{m.movement_type.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{fmt(m.amount)}</span>
                      <span className="text-gray-400">{m.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!sessions.length && <p className="text-center py-8 text-gray-400">No sessions</p>}
        </div>
      )}

      {tab === 'report' && report && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { l: 'Total Sessions', v: report.total_sessions, icon: <Monitor className="w-5 h-5 text-blue-600" /> },
            { l: 'Total Sales', v: fmt(report.total_sales), icon: <DollarSign className="w-5 h-5 text-green-600" /> },
            { l: 'Avg Difference', v: fmt(report.avg_cash_difference), icon: <BarChart3 className="w-5 h-5 text-orange-600" /> },
            { l: 'Discrepancies', v: report.sessions_with_discrepancy, icon: <StopCircle className="w-5 h-5 text-red-600" /> },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
              {s.icon}
              <div><p className="text-2xl font-bold">{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
