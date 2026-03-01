'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, Plus, Settings, Trash2, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

interface Modifier {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  modifiers: Modifier[];
}

export default function AddonsPage() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddModifier, setShowAddModifier] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', selection_type: 'single' as 'single' | 'multiple', is_required: false, min_selections: 0, max_selections: null as number | null });
  const [newModifier, setNewModifier] = useState({ name: '', price_adjustment: 0, is_default: false });

  const fetchGroups = useCallback(async () => {
    try {
      const res = await apiClient.get('/addons/groups');
      setGroups(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const toggleGroup = (id: string) => {
    const next = new Set(expandedGroups);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedGroups(next);
  };

  const createGroup = async () => {
    try {
      await apiClient.post('/addons/groups', newGroup);
      setShowCreateGroup(false);
      setNewGroup({ name: '', description: '', selection_type: 'single', is_required: false, min_selections: 0, max_selections: null });
      fetchGroups();
    } catch { /* ignore */ }
  };

  const deleteGroup = async (id: string) => {
    try { await apiClient.delete(`/addons/groups/${id}`); fetchGroups(); } catch { /* ignore */ }
  };

  const addModifier = async (groupId: string) => {
    try {
      await apiClient.post(`/addons/groups/${groupId}/modifiers`, newModifier);
      setShowAddModifier(null);
      setNewModifier({ name: '', price_adjustment: 0, is_default: false });
      fetchGroups();
    } catch { /* ignore */ }
  };

  const deleteModifier = async (modId: string) => {
    try { await apiClient.delete(`/addons/modifiers/${modId}`); fetchGroups(); } catch { /* ignore */ }
  };

  const toggleAvailability = async (modId: string, currentlyAvailable: boolean) => {
    try { await apiClient.put(`/addons/modifiers/${modId}`, { is_available: !currentlyAvailable }); fetchGroups(); } catch { /* ignore */ }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> Addons & Modifiers</h1>
        <button onClick={() => setShowCreateGroup(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> New Group</button>
      </div>

      {showCreateGroup && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-medium mb-3">Create Modifier Group</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input placeholder="Group name *" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <select value={newGroup.selection_type} onChange={e => setNewGroup({ ...newGroup, selection_type: e.target.value as 'single' | 'multiple' })} className="border rounded-lg p-2 text-sm">
              <option value="single">Single Select (Radio)</option>
              <option value="multiple">Multiple Select (Checkbox)</option>
            </select>
            <input placeholder="Description" value={newGroup.description} onChange={e => setNewGroup({ ...newGroup, description: e.target.value })} className="border rounded-lg p-2 text-sm col-span-2" />
          </div>
          <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={newGroup.is_required} onChange={e => setNewGroup({ ...newGroup, is_required: e.target.checked })} /> Required</label>
          <div className="flex gap-2"><button onClick={createGroup} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button><button onClick={() => setShowCreateGroup(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      <div className="space-y-3">
        {groups.map(group => (
          <div key={group.id} className="bg-white rounded-lg shadow">
            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleGroup(group.id)}>
              <div className="flex items-center gap-3">
                {expandedGroups.has(group.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div>
                  <h3 className="font-semibold">{group.name}</h3>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span className="capitalize">{group.selection_type}</span>
                    {group.is_required && <span className="text-red-500">Required</span>}
                    <span>{group.modifiers?.length || 0} options</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowAddModifier(group.id)} className="text-green-600 hover:text-green-800 p-1"><Plus className="w-4 h-4" /></button>
                <button onClick={() => deleteGroup(group.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {expandedGroups.has(group.id) && (
              <div className="border-t px-4 pb-4">
                {showAddModifier === group.id && (
                  <div className="bg-gray-50 rounded p-3 mt-3 mb-2">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input placeholder="Modifier name *" value={newModifier.name} onChange={e => setNewModifier({ ...newModifier, name: e.target.value })} className="border rounded-lg p-2 text-sm" />
                      <input type="number" step="0.01" placeholder="Price (+/-)" value={newModifier.price_adjustment} onChange={e => setNewModifier({ ...newModifier, price_adjustment: parseFloat(e.target.value) || 0 })} className="border rounded-lg p-2 text-sm" />
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={newModifier.is_default} onChange={e => setNewModifier({ ...newModifier, is_default: e.target.checked })} /> Default</label>
                        <button onClick={() => addModifier(group.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Add</button>
                        <button onClick={() => setShowAddModifier(null)} className="text-gray-400 text-sm">✕</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-1 mt-2">
                  {group.modifiers?.map(mod => (
                    <div key={mod.id} className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${mod.is_available ? 'bg-green-400' : 'bg-gray-300'}`} />
                        <span className={mod.is_available ? '' : 'text-gray-400 line-through'}>{mod.name}</span>
                        {mod.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        {mod.price_adjustment !== 0 && (
                          <span className={`flex items-center gap-0.5 text-sm ${mod.price_adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <DollarSign className="w-3 h-3" />
                            {mod.price_adjustment > 0 ? '+' : ''}{formatCurrency(mod.price_adjustment)}
                          </span>
                        )}
                        <button onClick={() => toggleAvailability(mod.id, mod.is_available)} className="text-xs text-gray-500 hover:text-blue-600">
                          {mod.is_available ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteModifier(mod.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  {(!group.modifiers || group.modifiers.length === 0) && (
                    <p className="text-sm text-gray-400 py-2">No modifiers yet. Click + to add one.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {!groups.length && (
          <div className="text-center py-12 text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No modifier groups yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
