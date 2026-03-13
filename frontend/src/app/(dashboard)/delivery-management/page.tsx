'use client';

/**
 * Delivery Management page.
 *
 * Tabs: Active Deliveries | Zones | Drivers | Reports
 * Features:
 * - View/update delivery status, assign or auto-assign drivers
 * - Create/edit delivery zones with fee type and geographic config
 * - Manage drivers, view workload
 * - Delivery time, zone performance, cost analysis, driver comparison reports
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Truck, MapPin, Users, Plus, Clock, Phone, Loader2, X, Save,
  ChevronDown, ToggleLeft, ToggleRight, Navigation, Package,
  BarChart3, RefreshCw, Zap, DollarSign,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════
// Types matching backend API
// ═══════════════════════════════════════════════════════════════════════════

interface DeliveryZone {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  delivery_fee: number;
  estimated_minutes: number;
  is_active: boolean;
  zone_type?: string;
  fee_type?: string;
  fee_per_km?: number;
  center_lat?: number;
  center_lng?: number;
  radius_km?: number;
  free_delivery_threshold?: number;
  max_distance_km?: number;
  created_at: string;
  updated_at: string;
}

interface Driver {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  vehicle_type?: string;
  license_plate?: string;
  is_available: boolean;
  is_active: boolean;
  max_concurrent?: number;
  created_at: string;
  updated_at: string;
}

interface Delivery {
  id: string;
  business_id: string;
  order_id: string;
  driver_id?: string;
  zone_id?: string;
  status: string;
  delivery_address: string;
  customer_phone: string;
  delivery_fee: number;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  delivery_notes?: string;
  proof_of_delivery?: string;
  created_at: string;
  updated_at: string;
}

interface DriverWorkload {
  driver_id: string;
  name: string;
  phone: string;
  is_available: boolean;
  active_deliveries: number;
  max_concurrent: number;
  utilization_pct: number;
}

type TabKey = 'active' | 'zones' | 'drivers' | 'reports';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'active', label: 'Active Deliveries', icon: <Truck className="h-4 w-4" /> },
  { key: 'zones', label: 'Zones', icon: <MapPin className="h-4 w-4" /> },
  { key: 'drivers', label: 'Drivers', icon: <Users className="h-4 w-4" /> },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
  assigned: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Assigned' },
  picked_up: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Picked Up' },
  in_transit: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Transit' },
  delivered: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Delivered' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
  returned: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Returned' },
};

const ALL_STATUSES = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

const formatCurrency = (v: number) =>
  `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

export default function DeliveryManagementPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Active Deliveries
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // Assign driver
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignDeliveryId, setAssignDeliveryId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Zones
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: '', delivery_fee: '', estimated_minutes: '',
    zone_type: 'flat', fee_type: 'flat', fee_per_km: '',
    free_delivery_threshold: '', description: '',
  });

  // Drivers
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', vehicle_type: '', license_plate: '' });
  const [workload, setWorkload] = useState<DriverWorkload[]>([]);

  // Reports
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [activeReport, setActiveReport] = useState<string>('delivery-times');

  // ── Data fetching ─────────────────────────────────────────────────────

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/active');
      setDeliveries(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch { /* silent */ }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/zones');
      setZones(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch { /* silent */ }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/drivers');
      setDrivers(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch { /* silent */ }
  }, []);

  const fetchWorkload = useCallback(async () => {
    try {
      const res = await apiClient.get('/deliveries/drivers/workload');
      setWorkload(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.allSettled([fetchDeliveries(), fetchZones(), fetchDrivers()]);
      setIsLoading(false);
    };
    load();
  }, [fetchDeliveries, fetchZones, fetchDrivers]);

  // Also fetch workload when switching to drivers tab
  useEffect(() => {
    if (activeTab === 'drivers') fetchWorkload();
  }, [activeTab, fetchWorkload]);

  // ── Delivery handlers ─────────────────────────────────────────────────

  const handleUpdateStatus = async (deliveryId: string, newStatus: string) => {
    try {
      setActionLoading(deliveryId);
      await apiClient.patch(`/deliveries/${deliveryId}/status`, { status: newStatus });
      setStatusDropdownId(null);
      await fetchDeliveries();
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  const handleAssignDriver = async () => {
    if (!assignDeliveryId || !selectedDriverId) return;
    try {
      setActionLoading('assign');
      await apiClient.post(`/deliveries/${assignDeliveryId}/assign`, { driver_id: selectedDriverId });
      setAssignModalOpen(false);
      await fetchDeliveries();
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  const handleAutoAssign = async (deliveryId: string) => {
    try {
      setActionLoading(deliveryId);
      await apiClient.post(`/deliveries/${deliveryId}/auto-assign`);
      await fetchDeliveries();
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  // ── Zone handlers ─────────────────────────────────────────────────────

  const handleCreateZone = async () => {
    if (!zoneForm.name || !zoneForm.delivery_fee || !zoneForm.estimated_minutes) return;
    try {
      setActionLoading('zone');
      await apiClient.post('/deliveries/zones', {
        name: zoneForm.name,
        delivery_fee: parseFloat(zoneForm.delivery_fee),
        estimated_minutes: parseInt(zoneForm.estimated_minutes),
        zone_type: zoneForm.zone_type,
        fee_type: zoneForm.fee_type,
        fee_per_km: zoneForm.fee_per_km ? parseFloat(zoneForm.fee_per_km) : undefined,
        free_delivery_threshold: zoneForm.free_delivery_threshold ? parseFloat(zoneForm.free_delivery_threshold) : undefined,
        description: zoneForm.description || undefined,
      });
      setZoneFormOpen(false);
      setZoneForm({ name: '', delivery_fee: '', estimated_minutes: '', zone_type: 'flat', fee_type: 'flat', fee_per_km: '', free_delivery_threshold: '', description: '' });
      await fetchZones();
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  const handleToggleZone = async (zoneId: string, isActive: boolean) => {
    try {
      await apiClient.put(`/deliveries/zones/${zoneId}`, { is_active: !isActive });
      await fetchZones();
    } catch { /* silent */ }
  };

  // ── Driver handlers ───────────────────────────────────────────────────

  const handleCreateDriver = async () => {
    if (!driverForm.name || !driverForm.phone) return;
    try {
      setActionLoading('driver');
      await apiClient.post('/deliveries/drivers', {
        name: driverForm.name,
        phone: driverForm.phone,
        vehicle_type: driverForm.vehicle_type || undefined,
        license_plate: driverForm.license_plate || undefined,
      });
      setDriverFormOpen(false);
      setDriverForm({ name: '', phone: '', vehicle_type: '', license_plate: '' });
      await fetchDrivers();
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  const handleToggleAvailability = async (driverId: string) => {
    try {
      await apiClient.patch(`/deliveries/drivers/${driverId}/availability`);
      await fetchDrivers();
      await fetchWorkload();
    } catch { /* silent */ }
  };

  // ── Report handlers ───────────────────────────────────────────────────

  const fetchReport = useCallback(async (reportType: string) => {
    try {
      setActionLoading('report');
      const res = await apiClient.get(`/deliveries/reports/${reportType}`);
      setReportData(res.data);
      setActiveReport(reportType);
    } catch { setReportData(null); } finally { setActionLoading(null); }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') fetchReport(activeReport);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Delivery Management" description="Track deliveries, manage zones, and assign drivers" />

      {/* Tabs */}
      <div className="flex space-x-1 bg-white/5 backdrop-blur-sm rounded-lg p-1 border border-white/10">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Active Deliveries Tab ─────────────────────────────────── */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Active Deliveries ({deliveries.length})
            </h2>
            <Button variant="outline" size="sm" onClick={fetchDeliveries}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>

          {deliveries.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-12 text-center text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active deliveries</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {deliveries.map(d => (
                <Card key={d.id} className="bg-white/5 border-white/10">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={d.status} />
                          <span className="text-xs text-gray-500">
                            Order: {d.order_id.slice(0, 8)}…
                          </span>
                        </div>
                        <p className="text-sm text-white flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {d.delivery_address}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {d.customer_phone}
                        </p>
                        <p className="text-xs text-gray-500">
                          Fee: {formatCurrency(d.delivery_fee)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Auto-assign button */}
                        {!d.driver_id && (
                          <>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleAutoAssign(d.id)}
                              disabled={actionLoading === d.id}
                            >
                              <Zap className="h-3 w-3 mr-1" /> Auto
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => {
                                setAssignDeliveryId(d.id);
                                setSelectedDriverId('');
                                setAssignModalOpen(true);
                              }}
                            >
                              <Users className="h-3 w-3 mr-1" /> Assign
                            </Button>
                          </>
                        )}

                        {/* Status dropdown */}
                        <div className="relative">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setStatusDropdownId(statusDropdownId === d.id ? null : d.id)}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          {statusDropdownId === d.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-white/10 rounded-md shadow-lg z-10">
                              {ALL_STATUSES.filter(s => s !== d.status).map(s => (
                                <button
                                  key={s}
                                  onClick={() => handleUpdateStatus(d.id, s)}
                                  className="block w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
                                >
                                  {STATUS_STYLES[s]?.label || s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Zones Tab ─────────────────────────────────────────────── */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Delivery Zones ({zones.length})</h2>
            <Button size="sm" onClick={() => setZoneFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Zone
            </Button>
          </div>

          {/* Zone create form */}
          {zoneFormOpen && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle className="text-sm">New Zone</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Zone name" value={zoneForm.name}
                    onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })}
                  />
                  <Input
                    type="number" placeholder="Delivery fee (R)" value={zoneForm.delivery_fee}
                    onChange={e => setZoneForm({ ...zoneForm, delivery_fee: e.target.value })}
                  />
                  <Input
                    type="number" placeholder="Est. minutes" value={zoneForm.estimated_minutes}
                    onChange={e => setZoneForm({ ...zoneForm, estimated_minutes: e.target.value })}
                  />
                  <select
                    value={zoneForm.fee_type}
                    onChange={e => setZoneForm({ ...zoneForm, fee_type: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white"
                  >
                    <option value="flat">Flat Fee</option>
                    <option value="distance">Distance-Based</option>
                    <option value="order_value">Order Value</option>
                    <option value="combined">Combined</option>
                  </select>
                </div>
                {(zoneForm.fee_type === 'distance' || zoneForm.fee_type === 'combined') && (
                  <Input
                    type="number" placeholder="Fee per km (R)" value={zoneForm.fee_per_km}
                    onChange={e => setZoneForm({ ...zoneForm, fee_per_km: e.target.value })}
                  />
                )}
                <Input
                  type="number" placeholder="Free delivery threshold (R, optional)" value={zoneForm.free_delivery_threshold}
                  onChange={e => setZoneForm({ ...zoneForm, free_delivery_threshold: e.target.value })}
                />
                <Input
                  placeholder="Description (optional)" value={zoneForm.description}
                  onChange={e => setZoneForm({ ...zoneForm, description: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateZone} disabled={actionLoading === 'zone'}>
                    {actionLoading === 'zone' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setZoneFormOpen(false)}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Zone list */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {zones.map(z => (
              <Card key={z.id} className={`bg-white/5 border-white/10 ${!z.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">{z.name}</h3>
                    <button onClick={() => handleToggleZone(z.id, z.is_active)}>
                      {z.is_active
                        ? <ToggleRight className="h-5 w-5 text-green-400" />
                        : <ToggleLeft className="h-5 w-5 text-gray-500" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> {formatCurrency(z.delivery_fee)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {z.estimated_minutes} min
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      {z.fee_type || 'flat'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                      {z.zone_type || 'flat'}
                    </span>
                    {z.free_delivery_threshold && (
                      <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                        Free &gt; {formatCurrency(z.free_delivery_threshold)}
                      </span>
                    )}
                  </div>
                  {z.description && <p className="text-xs text-gray-500">{z.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Drivers Tab ───────────────────────────────────────────── */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Drivers ({drivers.length})</h2>
            <Button size="sm" onClick={() => setDriverFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Driver
            </Button>
          </div>

          {/* Workload overview */}
          {workload.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle className="text-sm">Driver Workload</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {workload.map(w => (
                    <div key={w.driver_id} className="flex items-center justify-between text-sm">
                      <span className="text-white">{w.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-white/10 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${w.utilization_pct > 80 ? 'bg-red-500' : w.utilization_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(w.utilization_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-400 w-20 text-right">
                          {w.active_deliveries}/{w.max_concurrent}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Driver create form */}
          {driverFormOpen && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle className="text-sm">New Driver</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Driver name" value={driverForm.name}
                    onChange={e => setDriverForm({ ...driverForm, name: e.target.value })}
                  />
                  <Input
                    placeholder="Phone number" value={driverForm.phone}
                    onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })}
                  />
                  <Input
                    placeholder="Vehicle type (optional)" value={driverForm.vehicle_type}
                    onChange={e => setDriverForm({ ...driverForm, vehicle_type: e.target.value })}
                  />
                  <Input
                    placeholder="License plate (optional)" value={driverForm.license_plate}
                    onChange={e => setDriverForm({ ...driverForm, license_plate: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateDriver} disabled={actionLoading === 'driver'}>
                    {actionLoading === 'driver' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDriverFormOpen(false)}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Driver list */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {drivers.map(d => (
              <Card key={d.id} className={`bg-white/5 border-white/10 ${!d.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">{d.name}</h3>
                    <button onClick={() => handleToggleAvailability(d.id)}>
                      {d.is_available
                        ? <ToggleRight className="h-5 w-5 text-green-400" />
                        : <ToggleLeft className="h-5 w-5 text-gray-500" />}
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {d.phone}
                  </p>
                  {d.vehicle_type && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Navigation className="h-3 w-3" /> {d.vehicle_type}
                      {d.license_plate && ` • ${d.license_plate}`}
                    </p>
                  )}
                  <span className={`inline-block text-xs px-2 py-0.5 rounded ${d.is_available ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {d.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Reports Tab ───────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[
              { key: 'delivery-times', label: 'Delivery Times' },
              { key: 'zone-performance', label: 'Zone Performance' },
              { key: 'cost-analysis', label: 'Cost Analysis' },
              { key: 'driver-comparison', label: 'Driver Comparison' },
            ].map(r => (
              <Button
                key={r.key}
                variant={activeReport === r.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => fetchReport(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>

          {actionLoading === 'report' ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : reportData ? (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm capitalize">
                  {activeReport.replace(/-/g, ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Delivery Times */}
                {activeReport === 'delivery-times' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Delivered', value: (reportData as Record<string, number>).total_delivered },
                      { label: 'Avg Variance (min)', value: (reportData as Record<string, number>).avg_diff_minutes },
                      { label: 'Fastest (min)', value: (reportData as Record<string, number>).fastest_diff_minutes },
                      { label: 'Slowest (min)', value: (reportData as Record<string, number>).slowest_diff_minutes },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <p className="text-2xl font-bold text-white">{m.value ?? '—'}</p>
                        <p className="text-xs text-gray-400">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zone Performance */}
                {activeReport === 'zone-performance' && Array.isArray(reportData) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400">
                          <th className="text-left py-2">Zone</th>
                          <th className="text-right py-2">Total</th>
                          <th className="text-right py-2">Delivered</th>
                          <th className="text-right py-2">Failed</th>
                          <th className="text-right py-2">Success %</th>
                          <th className="text-right py-2">Fees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData as unknown as Array<Record<string, unknown>>).map((r, i) => (
                          <tr key={i} className="border-b border-white/5 text-gray-300">
                            <td className="py-2">{r.zone_name as string}</td>
                            <td className="text-right">{r.total_deliveries as number}</td>
                            <td className="text-right">{r.delivered as number}</td>
                            <td className="text-right">{r.failed as number}</td>
                            <td className="text-right">{r.success_rate as number}%</td>
                            <td className="text-right">{formatCurrency(r.total_fees as number)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Cost Analysis */}
                {activeReport === 'cost-analysis' && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Total Deliveries', value: (reportData as Record<string, number>).total_deliveries },
                      { label: 'Total Fees', value: formatCurrency((reportData as Record<string, number>).total_fees || 0) },
                      { label: 'Avg Fee', value: formatCurrency((reportData as Record<string, number>).avg_fee || 0) },
                      { label: 'Collected', value: formatCurrency((reportData as Record<string, number>).collected_fees || 0) },
                      { label: 'Lost', value: formatCurrency((reportData as Record<string, number>).lost_fees || 0) },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <p className="text-xl font-bold text-white">{m.value}</p>
                        <p className="text-xs text-gray-400">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Driver Comparison */}
                {activeReport === 'driver-comparison' && Array.isArray(reportData) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400">
                          <th className="text-left py-2">Driver</th>
                          <th className="text-right py-2">Total</th>
                          <th className="text-right py-2">Delivered</th>
                          <th className="text-right py-2">Failed</th>
                          <th className="text-right py-2">Success %</th>
                          <th className="text-right py-2">Fees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData as unknown as Array<Record<string, unknown>>).map((r, i) => (
                          <tr key={i} className="border-b border-white/5 text-gray-300">
                            <td className="py-2">{r.driver_name as string}</td>
                            <td className="text-right">{r.total_deliveries as number}</td>
                            <td className="text-right">{r.delivered as number}</td>
                            <td className="text-right">{r.failed as number}</td>
                            <td className="text-right">{r.success_rate as number}%</td>
                            <td className="text-right">{formatCurrency(r.total_fees as number)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-12 text-center text-gray-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a report to view</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Assign Driver Modal ───────────────────────────────────── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAssignModalOpen(false)}>
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Assign Driver</h3>
            <select
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white mb-4"
            >
              <option value="">Select a driver…</option>
              {drivers.filter(d => d.is_available && d.is_active).map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAssignDriver} disabled={!selectedDriverId || actionLoading === 'assign'}>
                {actionLoading === 'assign' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
