'use client';

/**
 * Delivery Management page - Track deliveries, manage zones, and assign drivers.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  MapPin,
  Users,
  Plus,
  Clock,
  Phone,
  Loader2,
  X,
  Save,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Navigation,
  Package,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

// --- Interfaces ---

interface Delivery {
  id: string;
  order_number: string;
  driver_id?: string;
  driver_name?: string;
  status: string;
  address: string;
  eta?: string;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  updated_at?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  estimated_time: number;
  active: boolean;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  available: boolean;
}

type TabKey = 'active' | 'zones' | 'drivers';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { key: 'active', label: 'Active Deliveries', icon: <Truck className="h-4 w-4" /> },
  { key: 'zones', label: 'Zones', icon: <MapPin className="h-4 w-4" /> },
  { key: 'drivers', label: 'Drivers', icon: <Users className="h-4 w-4" /> },
];

const DELIVERY_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
  assigned: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Assigned' },
  picked_up: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Picked Up' },
  in_transit: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Transit' },
  delivered: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Delivered' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
};

const DELIVERY_STATUSES = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed'];

function DeliveryStatusBadge({ status }: { status: string }) {
  const style = DELIVERY_STATUS_STYLES[status] || DELIVERY_STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// --- Helpers ---

const formatCurrency = (value: number) =>
  `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

// --- Main Page ---

export default function DeliveryManagementPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Active Deliveries
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // Assign driver modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignDeliveryId, setAssignDeliveryId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Zones
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', fee: '', estimated_time: '' });

  // Drivers
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', vehicle: '' });

  // --- Data Fetching ---

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/active');
      setDeliveries(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/zones');
      setZones(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/drivers');
      setDrivers(res.data.items || res.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.allSettled([fetchDeliveries(), fetchZones(), fetchDrivers()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchDeliveries, fetchZones, fetchDrivers]);

  // --- Delivery Handlers ---

  const handleUpdateStatus = async (deliveryId: string, newStatus: string) => {
    try {
      setActionLoading(deliveryId);
      await apiClient.patch(`/deliveries/${deliveryId}/status`, { status: newStatus });
      setStatusDropdownId(null);
      await fetchDeliveries();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const openAssignModal = (deliveryId: string) => {
    setAssignDeliveryId(deliveryId);
    setSelectedDriverId('');
    setAssignModalOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!assignDeliveryId || !selectedDriverId) return;
    try {
      setActionLoading('assign');
      await apiClient.post(`/deliveries/${assignDeliveryId}/assign`, { driver_id: selectedDriverId });
      setAssignModalOpen(false);
      await fetchDeliveries();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // --- Zone Handlers ---

  const handleAddZone = async () => {
    try {
      setActionLoading('add-zone');
      await apiClient.post('/deliveries/zones', {
        name: zoneForm.name,
        fee: parseFloat(zoneForm.fee) || 0,
        estimated_time: parseInt(zoneForm.estimated_time, 10) || 0,
      });
      setZoneFormOpen(false);
      setZoneForm({ name: '', fee: '', estimated_time: '' });
      await fetchZones();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleZone = async (zone: DeliveryZone) => {
    try {
      setActionLoading(zone.id);
      await apiClient.patch(`/deliveries/zones/${zone.id}`, { active: !zone.active });
      await fetchZones();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // --- Driver Handlers ---

  const handleAddDriver = async () => {
    try {
      setActionLoading('add-driver');
      await apiClient.post('/deliveries/drivers', {
        name: driverForm.name,
        phone: driverForm.phone,
        vehicle: driverForm.vehicle,
      });
      setDriverFormOpen(false);
      setDriverForm({ name: '', phone: '', vehicle: '' });
      await fetchDrivers();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleDriverAvailability = async (driver: Driver) => {
    try {
      setActionLoading(driver.id);
      await apiClient.patch(`/deliveries/drivers/${driver.id}/availability`, { available: !driver.available });
      await fetchDrivers();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Management"
        description="Track active deliveries, manage delivery zones, and assign drivers."
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- Active Deliveries Tab --- */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {deliveries.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No active deliveries at the moment.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveries.map((delivery) => (
                <Card key={delivery.id} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          <span className="text-white font-medium">{delivery.order_number}</span>
                        </div>
                        <DeliveryStatusBadge status={delivery.status} />
                      </div>
                      {delivery.eta && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">ETA</p>
                          <p className="text-sm text-white font-medium flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(delivery.eta)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span className="text-gray-300">{delivery.address}</span>
                      </div>
                      {delivery.driver_name ? (
                        <div className="flex items-center gap-2">
                          <Navigation className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-300">{delivery.driver_name}</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs italic">No driver assigned</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status update dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setStatusDropdownId(statusDropdownId === delivery.id ? null : delivery.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors"
                        >
                          Update Status <ChevronDown className="h-3 w-3" />
                        </button>
                        {statusDropdownId === delivery.id && (
                          <div className="absolute z-10 mt-1 left-0 w-40 bg-gray-700 border border-gray-600 rounded-lg shadow-xl py-1">
                            {DELIVERY_STATUSES.filter((s) => s !== delivery.status).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleUpdateStatus(delivery.id, status)}
                                disabled={actionLoading === delivery.id}
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50"
                              >
                                {DELIVERY_STATUS_STYLES[status]?.label || status}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {!delivery.driver_id && (
                        <button
                          onClick={() => openAssignModal(delivery.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-md transition-colors"
                        >
                          <Users className="h-3.5 w-3.5" /> Assign Driver
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Zones Tab --- */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setZoneFormOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Zone
            </Button>
          </div>

          {/* Add zone form */}
          {zoneFormOpen && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">New Delivery Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Zone Name</label>
                    <Input
                      value={zoneForm.name}
                      onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="e.g. CBD"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Delivery Fee (R)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={zoneForm.fee}
                      onChange={(e) => setZoneForm({ ...zoneForm, fee: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Est. Time (min)</label>
                    <Input
                      type="number"
                      value={zoneForm.estimated_time}
                      onChange={(e) => setZoneForm({ ...zoneForm, estimated_time: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="30"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setZoneFormOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddZone}
                    disabled={actionLoading === 'add-zone' || !zoneForm.name}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {actionLoading === 'add-zone' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Zone
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {zones.length === 0 && !zoneFormOpen ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No delivery zones configured.</p>
              </CardContent>
            </Card>
          ) : zones.length > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-3">Zone Name</th>
                        <th className="px-6 py-3">Delivery Fee</th>
                        <th className="px-6 py-3">Est. Time</th>
                        <th className="px-6 py-3">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {zones.map((zone) => (
                        <tr key={zone.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4 text-white font-medium">{zone.name}</td>
                          <td className="px-6 py-4 text-gray-300">{formatCurrency(zone.fee)}</td>
                          <td className="px-6 py-4 text-gray-300">{zone.estimated_time} min</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleZone(zone)}
                              disabled={actionLoading === zone.id}
                              className="text-gray-400 hover:text-white disabled:opacity-50"
                            >
                              {zone.active ? (
                                <ToggleRight className="h-6 w-6 text-green-400" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-gray-500" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --- Drivers Tab --- */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setDriverFormOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Driver
            </Button>
          </div>

          {/* Add driver form */}
          {driverFormOpen && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">New Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                    <Input
                      value={driverForm.name}
                      onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Driver name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Phone</label>
                    <Input
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Vehicle</label>
                    <Input
                      value={driverForm.vehicle}
                      onChange={(e) => setDriverForm({ ...driverForm, vehicle: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="e.g. Motorbike, Car"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setDriverFormOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddDriver}
                    disabled={actionLoading === 'add-driver' || !driverForm.name}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {actionLoading === 'add-driver' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Driver
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {drivers.length === 0 && !driverFormOpen ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No drivers added yet.</p>
              </CardContent>
            </Card>
          ) : drivers.length > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Vehicle</th>
                        <th className="px-6 py-3">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {drivers.map((driver) => (
                        <tr key={driver.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4 text-white font-medium">{driver.name}</td>
                          <td className="px-6 py-4 text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {driver.phone}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">{driver.vehicle}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleDriverAvailability(driver)}
                              disabled={actionLoading === driver.id}
                              className="text-gray-400 hover:text-white disabled:opacity-50"
                            >
                              {driver.available ? (
                                <ToggleRight className="h-6 w-6 text-green-400" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-gray-500" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --- Assign Driver Modal --- */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Assign Driver</h2>
              <button onClick={() => setAssignModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Select Driver</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a driver...</option>
                  {drivers
                    .filter((d) => d.available)
                    .map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} — {driver.vehicle}
                      </option>
                    ))}
                </select>
              </div>
              {drivers.filter((d) => d.available).length === 0 && (
                <p className="text-sm text-yellow-400">No available drivers at the moment.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <Button onClick={() => setAssignModalOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
                Cancel
              </Button>
              <Button
                onClick={handleAssignDriver}
                disabled={actionLoading === 'assign' || !selectedDriverId}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {actionLoading === 'assign' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
