'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Clock, Calendar, Plus, CheckCircle, XCircle, PlayCircle, StopCircle } from 'lucide-react';

type Tab = 'schedule' | 'shifts' | 'leave';

interface Shift {
  id: string;
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  role: string | null;
  notes: string | null;
  status: string;
  actual_start: string | null;
  actual_end: string | null;
  user?: { full_name?: string; email?: string };
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  user?: { full_name?: string; email?: string };
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function ShiftsPage() {
  const [tab, setTab] = useState<Tab>('shifts');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [showCreateLeave, setShowCreateLeave] = useState(false);
  const [newShift, setNewShift] = useState({ user_id: '', shift_date: '', start_time: '08:00', end_time: '17:00', break_minutes: 30, role: '', notes: '' });
  const [newLeave, setNewLeave] = useState({ user_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });

  const fetchShifts = useCallback(async () => {
    try { const res = await apiClient.get('/shifts/', { params: { per_page: 50 } }); setShifts(res.data.items || res.data); } catch { /* ignore */ }
  }, []);

  const fetchLeaves = useCallback(async () => {
    try { const res = await apiClient.get('/shifts/leave', { params: { per_page: 50 } }); setLeaves(res.data.items || res.data); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => { setLoading(true); await Promise.all([fetchShifts(), fetchLeaves()]); setLoading(false); };
    load();
  }, [fetchShifts, fetchLeaves]);

  const createShift = async () => {
    try { await apiClient.post('/shifts/', newShift); setShowCreateShift(false); fetchShifts(); } catch { /* ignore */ }
  };

  const createLeave = async () => {
    try { await apiClient.post('/shifts/leave', newLeave); setShowCreateLeave(false); fetchLeaves(); } catch { /* ignore */ }
  };

  const clockIn = async (id: string) => { try { await apiClient.post(`/shifts/${id}/clock-in`); fetchShifts(); } catch { /* ignore */ } };
  const clockOut = async (id: string) => { try { await apiClient.post(`/shifts/${id}/clock-out`); fetchShifts(); } catch { /* ignore */ } };
  const approveLeave = async (id: string) => { try { await apiClient.patch(`/shifts/leave/${id}/approve`); fetchLeaves(); } catch { /* ignore */ } };
  const rejectLeave = async (id: string) => { try { await apiClient.patch(`/shifts/leave/${id}/reject`); fetchLeaves(); } catch { /* ignore */ } };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> Shift Management</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateShift(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> New Shift</button>
          <button onClick={() => setShowCreateLeave(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Leave Request</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {(['shifts', 'leave'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 border-b-2 capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t === 'leave' ? 'Leave Requests' : 'All Shifts'}
          </button>
        ))}
      </div>

      {showCreateShift && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">Create Shift</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <input placeholder="User ID *" value={newShift.user_id} onChange={e => setNewShift({ ...newShift, user_id: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="date" value={newShift.shift_date} onChange={e => setNewShift({ ...newShift, shift_date: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="time" value={newShift.start_time} onChange={e => setNewShift({ ...newShift, start_time: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="time" value={newShift.end_time} onChange={e => setNewShift({ ...newShift, end_time: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Role" value={newShift.role} onChange={e => setNewShift({ ...newShift, role: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="number" placeholder="Break (min)" value={newShift.break_minutes} onChange={e => setNewShift({ ...newShift, break_minutes: parseInt(e.target.value) || 0 })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Notes" value={newShift.notes} onChange={e => setNewShift({ ...newShift, notes: e.target.value })} className="border rounded-lg p-2 text-sm col-span-2" />
          </div>
          <div className="flex gap-2"><button onClick={createShift} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button><button onClick={() => setShowCreateShift(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      {showCreateLeave && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">Leave Request</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <input placeholder="User ID *" value={newLeave.user_id} onChange={e => setNewLeave({ ...newLeave, user_id: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <select value={newLeave.leave_type} onChange={e => setNewLeave({ ...newLeave, leave_type: e.target.value })} className="border rounded-lg p-2 text-sm">
              <option value="annual">Annual</option><option value="sick">Sick</option><option value="family">Family</option><option value="unpaid">Unpaid</option><option value="other">Other</option>
            </select>
            <input type="date" value={newLeave.start_date} onChange={e => setNewLeave({ ...newLeave, start_date: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="date" value={newLeave.end_date} onChange={e => setNewLeave({ ...newLeave, end_date: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>
          <input placeholder="Reason" value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} className="w-full border rounded-lg p-2 text-sm mb-3" />
          <div className="flex gap-2"><button onClick={createLeave} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm">Submit</button><button onClick={() => setShowCreateLeave(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      {tab === 'shifts' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left p-3">Date</th><th className="text-left p-3">Staff</th>
              <th className="text-left p-3">Time</th><th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th>
            </tr></thead>
            <tbody>{shifts.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{s.shift_date}</td>
                <td className="p-3">{s.user?.full_name || s.user?.email || s.user_id.slice(0, 8)}</td>
                <td className="p-3 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> {s.start_time} - {s.end_time}</td>
                <td className="p-3">{s.role || '—'}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status.replace(/_/g, ' ')}</span></td>
                <td className="p-3">
                  {s.status === 'scheduled' && <button onClick={() => clockIn(s.id)} className="text-green-600 hover:text-green-800" title="Clock in"><PlayCircle className="w-4 h-4" /></button>}
                  {s.status === 'in_progress' && <button onClick={() => clockOut(s.id)} className="text-red-600 hover:text-red-800" title="Clock out"><StopCircle className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!shifts.length && <p className="text-center py-8 text-gray-400">No shifts scheduled</p>}
        </div>
      )}

      {tab === 'leave' && (
        <div className="space-y-3">
          {leaves.map(l => (
            <div key={l.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{l.user?.full_name || l.user?.email || l.user_id.slice(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[l.status] || 'bg-gray-100'}`}>{l.status}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{l.leave_type}</span>
                </div>
                <p className="text-sm text-gray-500">{l.start_date} → {l.end_date}</p>
                {l.reason && <p className="text-xs text-gray-400">{l.reason}</p>}
              </div>
              {l.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => approveLeave(l.id)} className="text-green-600 hover:text-green-800" title="Approve"><CheckCircle className="w-5 h-5" /></button>
                  <button onClick={() => rejectLeave(l.id)} className="text-red-600 hover:text-red-800" title="Reject"><XCircle className="w-5 h-5" /></button>
                </div>
              )}
            </div>
          ))}
          {!leaves.length && <p className="text-center py-8 text-gray-400">No leave requests</p>}
        </div>
      )}
    </div>
  );
}
