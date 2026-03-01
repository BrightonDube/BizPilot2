'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Loader2, MapPin, Plus, ArrowRight, Package, AlertTriangle, Trash2 } from 'lucide-react';

type Tab = 'locations' | 'transfers' | 'alerts';

interface Location {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  is_warehouse: boolean;
  is_primary: boolean;
}

interface Transfer {
  id: string;
  reference_number: string | null;
  status: string;
  notes: string | null;
  from_location: { id: string; name: string };
  to_location: { id: string; name: string };
  items: { id: string; product: { name: string }; quantity: number; received_quantity: number }[];
  created_at: string;
}

interface LowStockAlert {
  location_name: string;
  product_name: string;
  quantity: number;
  min_quantity: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function LocationsPage() {
  const [tab, setTab] = useState<Tab>('locations');
  const [locations, setLocations] = useState<Location[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showCreateTransfer, setShowCreateTransfer] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', code: '', address: '', city: '', phone: '', is_warehouse: false });
  const [newTransfer, setNewTransfer] = useState({ from_location_id: '', to_location_id: '', notes: '', items: [{ product_id: '', quantity: 1 }] });

  const fetchLocations = useCallback(async () => {
    try { const res = await apiClient.get('/locations/'); setLocations(res.data); } catch { /* ignore */ }
  }, []);

  const fetchTransfers = useCallback(async () => {
    try { const res = await apiClient.get('/locations/transfers'); setTransfers(res.data.items || res.data); } catch { /* ignore */ }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try { const res = await apiClient.get('/locations/alerts/low-stock'); setAlerts(res.data); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchLocations(), fetchTransfers(), fetchAlerts()]);
      setLoading(false);
    };
    load();
  }, [fetchLocations, fetchTransfers, fetchAlerts]);

  const createLocation = async () => {
    try {
      await apiClient.post('/locations/', newLoc);
      setShowCreateLocation(false);
      setNewLoc({ name: '', code: '', address: '', city: '', phone: '', is_warehouse: false });
      fetchLocations();
    } catch { /* ignore */ }
  };

  const deleteLocation = async (id: string) => {
    try { await apiClient.delete(`/locations/${id}`); fetchLocations(); } catch { /* ignore */ }
  };

  const createTransfer = async () => {
    try {
      const items = newTransfer.items.filter(i => i.product_id);
      await apiClient.post('/locations/transfers', { ...newTransfer, items });
      setShowCreateTransfer(false);
      setNewTransfer({ from_location_id: '', to_location_id: '', notes: '', items: [{ product_id: '', quantity: 1 }] });
      fetchTransfers();
    } catch { /* ignore */ }
  };

  const receiveTransfer = async (transferId: string, items: { product_id: string; received_quantity: number }[]) => {
    try { await apiClient.patch(`/locations/transfers/${transferId}/receive`, { received_items: items }); fetchTransfers(); } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="w-6 h-6" /> Locations</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateLocation(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Add Location</button>
          <button onClick={() => setShowCreateTransfer(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"><ArrowRight className="w-4 h-4" /> New Transfer</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {([['locations', 'Locations', <MapPin key="l" className="w-4 h-4" />], ['transfers', 'Transfers', <Package key="t" className="w-4 h-4" />], ['alerts', `Alerts (${alerts.length})`, <AlertTriangle key="a" className="w-4 h-4" />]] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 border-b-2 ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {showCreateLocation && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">New Location</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input placeholder="Name *" value={newLoc.name} onChange={e => setNewLoc({ ...newLoc, name: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Code" value={newLoc.code} onChange={e => setNewLoc({ ...newLoc, code: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="City" value={newLoc.city} onChange={e => setNewLoc({ ...newLoc, city: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input placeholder="Address" value={newLoc.address} onChange={e => setNewLoc({ ...newLoc, address: e.target.value })} className="border rounded-lg p-2 text-sm col-span-2" />
            <input placeholder="Phone" value={newLoc.phone} onChange={e => setNewLoc({ ...newLoc, phone: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={newLoc.is_warehouse} onChange={e => setNewLoc({ ...newLoc, is_warehouse: e.target.checked })} /> Warehouse</label>
          <div className="flex gap-2"><button onClick={createLocation} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button><button onClick={() => setShowCreateLocation(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      {showCreateTransfer && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">New Stock Transfer</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <select value={newTransfer.from_location_id} onChange={e => setNewTransfer({ ...newTransfer, from_location_id: e.target.value })} className="border rounded-lg p-2 text-sm">
              <option value="">From Location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={newTransfer.to_location_id} onChange={e => setNewTransfer({ ...newTransfer, to_location_id: e.target.value })} className="border rounded-lg p-2 text-sm">
              <option value="">To Location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input placeholder="Notes" value={newTransfer.notes} onChange={e => setNewTransfer({ ...newTransfer, notes: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>
          {newTransfer.items.map((item, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 mb-2">
              <input placeholder="Product ID" value={item.product_id} onChange={e => { const items = [...newTransfer.items]; items[i].product_id = e.target.value; setNewTransfer({ ...newTransfer, items }); }} className="border rounded-lg p-2 text-sm col-span-2" />
              <input type="number" placeholder="Qty" value={item.quantity} onChange={e => { const items = [...newTransfer.items]; items[i].quantity = parseInt(e.target.value) || 1; setNewTransfer({ ...newTransfer, items }); }} className="border rounded-lg p-2 text-sm" />
            </div>
          ))}
          <button onClick={() => setNewTransfer({ ...newTransfer, items: [...newTransfer.items, { product_id: '', quantity: 1 }] })} className="text-blue-600 text-sm mb-3">+ Add Item</button>
          <div className="flex gap-2"><button onClick={createTransfer} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm">Create Transfer</button><button onClick={() => setShowCreateTransfer(false)} className="text-gray-500 text-sm">Cancel</button></div>
        </div>
      )}

      {tab === 'locations' && (
        <div className="grid grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">{loc.name}</h3>
                  {loc.code && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{loc.code}</span>}
                </div>
                <div className="flex gap-1">
                  {loc.is_primary && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Primary</span>}
                  {loc.is_warehouse && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Warehouse</span>}
                  <button onClick={() => deleteLocation(loc.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {loc.city && <p className="text-sm text-gray-500">{loc.city}</p>}
              {loc.address && <p className="text-xs text-gray-400">{loc.address}</p>}
              <span className={`text-xs mt-2 inline-block ${loc.is_active ? 'text-green-600' : 'text-red-500'}`}>{loc.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          ))}
          {!locations.length && <p className="col-span-3 text-center py-8 text-gray-400">No locations yet</p>}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="space-y-3">
          {transfers.map(t => (
            <div key={t.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.reference_number || t.id.slice(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[t.status] || 'bg-gray-100'}`}>{t.status.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-sm text-gray-400">{new Date(t.created_at).toLocaleDateString('en-ZA')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>{t.from_location?.name || 'Unknown'}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{t.to_location?.name || 'Unknown'}</span>
              </div>
              <div className="text-sm">
                {t.items?.map(item => (
                  <span key={item.id} className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1 mb-1">
                    {item.product?.name || 'Product'} x{item.quantity}
                    {item.received_quantity > 0 && <span className="text-green-600 ml-1">({item.received_quantity} rcvd)</span>}
                  </span>
                ))}
              </div>
              {t.status === 'pending' && (
                <button onClick={() => receiveTransfer(t.id, t.items.map(i => ({ product_id: i.id, received_quantity: i.quantity })))}
                  className="mt-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">
                  Mark Received
                </button>
              )}
            </div>
          ))}
          {!transfers.length && <p className="text-center py-8 text-gray-400">No transfers yet</p>}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div className="flex-1">
                <span className="font-medium">{a.product_name}</span>
                <span className="text-sm text-gray-500 ml-2">at {a.location_name}</span>
              </div>
              <div className="text-right">
                <span className="text-red-600 font-medium">{a.quantity}</span>
                <span className="text-gray-400 text-sm"> / min {a.min_quantity}</span>
              </div>
            </div>
          ))}
          {!alerts.length && <p className="text-center py-8 text-gray-400">No low stock alerts</p>}
        </div>
      )}
    </div>
  );
}
