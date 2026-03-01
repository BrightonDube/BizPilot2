'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Plus, Grid3X3, RefreshCw, Users, Loader2, Edit2, Trash2, X } from 'lucide-react';

interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
  section: string | null;
  position_x: number;
  position_y: number;
  is_active: boolean;
  has_active_order?: boolean;
  order_number?: string | null;
  order_total?: number | null;
  order_item_count?: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 border-green-500 text-green-800',
  occupied: 'bg-red-100 border-red-500 text-red-800',
  reserved: 'bg-blue-100 border-blue-500 text-blue-800',
  dirty: 'bg-yellow-100 border-yellow-500 text-yellow-800',
  blocked: 'bg-gray-100 border-gray-500 text-gray-800',
};

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTable, setEditTable] = useState<RestaurantTable | null>(null);
  const [formData, setFormData] = useState({
    table_number: '',
    capacity: 4,
    section: '',
    position_x: 0,
    position_y: 0,
  });

  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tables/floor-plan');
      setTables(res.data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleCreate = async () => {
    try {
      await apiClient.post('/tables', formData);
      setShowCreateModal(false);
      setFormData({ table_number: '', capacity: 4, section: '', position_x: 0, position_y: 0 });
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create table');
    }
  };

  const handleUpdate = async () => {
    if (!editTable) return;
    try {
      await apiClient.put(`/tables/${editTable.id}`, formData);
      setEditTable(null);
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update table');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this table?')) return;
    try {
      await apiClient.delete(`/tables/${id}`);
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete table');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/tables/${id}/status`, { status });
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update status');
    }
  };

  // Get unique sections
  const sections = [...new Set(tables.map(t => t.section).filter(Boolean))] as string[];

  // Stats
  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  function renderTableCard(table: RestaurantTable) {
    const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
    return (
      <div key={table.id} className={`border-2 rounded-lg p-4 ${colors} cursor-pointer transition-all hover:shadow-md`}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-lg font-bold">{table.table_number}</span>
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); setEditTable(table); setFormData({ table_number: table.table_number, capacity: table.capacity, section: table.section || '', position_x: table.position_x, position_y: table.position_y }); }} className="p-1 hover:bg-white/50 rounded">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(table.id); }} className="p-1 hover:bg-white/50 rounded">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm mb-1">
          <Users className="w-3 h-3" /> {table.capacity}
        </div>
        <div className="text-xs capitalize font-medium mb-2">{table.status}</div>
        {table.has_active_order && (
          <div className="text-xs bg-white/60 rounded p-1 mt-1">
            <div className="font-medium">{table.order_number}</div>
            <div>R {table.order_total?.toFixed(2)} • {table.order_item_count} items</div>
          </div>
        )}
        {table.status === 'available' && (
          <select onChange={(e) => { if (e.target.value) handleStatusChange(table.id, e.target.value); e.target.value = ''; }} className="w-full text-xs mt-1 border rounded p-1 bg-white/50" defaultValue="">
            <option value="" disabled>Change status...</option>
            <option value="reserved">Reserved</option>
            <option value="blocked">Blocked</option>
          </select>
        )}
        {table.status === 'occupied' && (
          <select onChange={(e) => { if (e.target.value) handleStatusChange(table.id, e.target.value); e.target.value = ''; }} className="w-full text-xs mt-1 border rounded p-1 bg-white/50" defaultValue="">
            <option value="" disabled>Change status...</option>
            <option value="dirty">Dirty</option>
            <option value="available">Available</option>
          </select>
        )}
        {table.status === 'dirty' && (
          <button onClick={() => handleStatusChange(table.id, 'available')} className="w-full text-xs mt-1 border rounded p-1 bg-white/50 hover:bg-white">Mark Clean</button>
        )}
        {table.status === 'reserved' && (
          <button onClick={() => handleStatusChange(table.id, 'available')} className="w-full text-xs mt-1 border rounded p-1 bg-white/50 hover:bg-white">Unreserve</button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
          <p className="text-gray-600">Manage restaurant floor plan and table assignments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTables} className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => { setShowCreateModal(true); setFormData({ table_number: '', capacity: 4, section: '', position_x: 0, position_y: 0 }); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Table
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm text-gray-600">Total Tables</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-700">Available</div>
          <div className="text-2xl font-bold text-green-800">{stats.available}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-700">Occupied</div>
          <div className="text-2xl font-bold text-red-800">{stats.occupied}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-700">Reserved</div>
          <div className="text-2xl font-bold text-blue-800">{stats.reserved}</div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Grid3X3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No tables yet</h3>
          <p className="text-gray-600 mt-1">Create your first table to start managing your floor plan.</p>
        </div>
      ) : (
        <>
          {/* Table grid by section */}
          {sections.length > 0 ? (
            sections.map(section => (
              <div key={section} className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">{section}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {tables.filter(t => t.section === section).map(renderTableCard)}
                </div>
              </div>
            ))
          ) : null}
          {/* Tables without section */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables.filter(t => !t.section || !sections.includes(t.section)).map(renderTableCard)}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editTable) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editTable ? 'Edit Table' : 'Add Table'}</h2>
              <button onClick={() => { setShowCreateModal(false); setEditTable(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Table Number</label>
                <input type="text" value={formData.table_number} onChange={e => setFormData(f => ({ ...f, table_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. T1, A1" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity</label>
                <input type="number" value={formData.capacity} onChange={e => setFormData(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} className="w-full border rounded-lg px-3 py-2" min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Section</label>
                <input type="text" value={formData.section} onChange={e => setFormData(f => ({ ...f, section: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Patio, Indoor" />
              </div>
              <button onClick={editTable ? handleUpdate : handleCreate} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                {editTable ? 'Save Changes' : 'Create Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
