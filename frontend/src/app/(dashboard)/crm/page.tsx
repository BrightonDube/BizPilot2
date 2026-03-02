'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader, StatCard, Badge, LoadingSpinner, EmptyState } from '@/components/ui/bizpilot';
import {
  Users, AlertTriangle, TrendingUp, MessageSquare, Phone, Mail, Calendar,
  StickyNote, Plus, Check, ChevronDown, ChevronUp, Tag,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  name: string;
  description: string;
  color: string;
  member_count: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  total_spend: number;
}

interface Interaction {
  id: string;
  customer_id: string;
  customer_name: string;
  type: string;
  subject: string;
  content: string;
  follow_up_date: string | null;
  completed: boolean;
  created_at: string;
}

interface FollowUp {
  id: string;
  customer_name: string;
  subject: string;
  follow_up_date: string;
  completed: boolean;
}

type TabKey = 'overview' | 'segments' | 'interactions' | 'follow-ups';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'overview', label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'segments', label: 'Segments', icon: <Tag className="w-4 h-4" /> },
  { key: 'interactions', label: 'Interactions', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'follow-ups', label: 'Follow-ups', icon: <Calendar className="w-4 h-4" /> },
];

const INTERACTION_TYPES = ['note', 'call', 'email', 'meeting', 'follow_up'];

const INTERACTION_ICONS: Record<string, React.ReactNode> = {
  note: <StickyNote className="w-4 h-4" />,
  call: <Phone className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  meeting: <Calendar className="w-4 h-4" />,
  follow_up: <Calendar className="w-4 h-4" />,
};

function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  // Overview state
  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const [atRiskCustomers, setAtRiskCustomers] = useState<Customer[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<Interaction[]>([]);

  // Segments state
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentForm, setSegmentForm] = useState({ name: '', description: '', color: '#9333ea' });
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentMembers, setSegmentMembers] = useState<Customer[]>([]);

  // Interactions state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [interactionForm, setInteractionForm] = useState({
    customer_id: '', type: 'note', subject: '', content: '', follow_up_date: '',
  });

  // Follow-ups state
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [topRes, riskRes] = await Promise.all([
        apiClient.get<{ items: Customer[] }>('/crm/top-customers'),
        apiClient.get<{ items: Customer[] }>('/crm/at-risk-customers'),
      ]);
      setTopCustomers(topRes.data.items || []);
      setAtRiskCustomers(riskRes.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: Segment[] }>('/crm/segments');
      setSegments(res.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchInteractions = useCallback(async () => {
    setLoading(true);
    try {
      const [intRes, custRes] = await Promise.all([
        apiClient.get<{ items: Interaction[] }>('/crm/interactions?per_page=20'),
        apiClient.get<{ items: Customer[] }>('/customers?per_page=100'),
      ]);
      setRecentInteractions(intRes.data.items || []);
      setCustomers(custRes.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: FollowUp[] }>('/crm/follow-ups');
      setFollowUps(res.data.items || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'segments') fetchSegments();
    else if (activeTab === 'interactions') fetchInteractions();
    else if (activeTab === 'follow-ups') fetchFollowUps();
  }, [activeTab, fetchOverview, fetchSegments, fetchInteractions, fetchFollowUps]);

  const handleAddSegment = async () => {
    if (!segmentForm.name) return;
    try {
      await apiClient.post('/crm/segments', segmentForm);
      setSegmentForm({ name: '', description: '', color: '#9333ea' });
      fetchSegments();
    } catch { /* empty */ }
  };

  const handleViewSegmentMembers = async (segmentId: string) => {
    if (selectedSegment === segmentId) {
      setSelectedSegment(null);
      return;
    }
    setSelectedSegment(segmentId);
    try {
      const res = await apiClient.get<{ items: Customer[] }>(`/crm/segments/${segmentId}/members`);
      setSegmentMembers(res.data.items || []);
    } catch { /* empty */ }
  };

  const handleLogInteraction = async () => {
    if (!interactionForm.customer_id || !interactionForm.subject) return;
    try {
      const payload: Record<string, string> = { ...interactionForm };
      if (!payload.follow_up_date) delete payload.follow_up_date;
      await apiClient.post('/crm/interactions', payload);
      setInteractionForm({ customer_id: '', type: 'note', subject: '', content: '', follow_up_date: '' });
      fetchInteractions();
    } catch { /* empty */ }
  };

  const handleCompleteFollowUp = async (id: string) => {
    try {
      await apiClient.patch(`/crm/interactions/${id}/complete`);
      fetchFollowUps();
    } catch { /* empty */ }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" description="Customer relationship management" />

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

      {/* ── Overview Tab ──────────────────────────────────────────────────── */}
      {!loading && activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Top Customers" value={topCustomers.length} icon={<Users className="w-5 h-5" />} />
            <StatCard title="At-Risk Customers" value={atRiskCustomers.length} icon={<AlertTriangle className="w-5 h-5" />} />
            <StatCard
              title="Top Spend"
              value={topCustomers.length > 0 ? formatCurrency(topCustomers[0]?.total_spend ?? 0) : 'R 0.00'}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Top 10 Customers by Spend</h3>
              {topCustomers.length === 0 ? (
                <p className="text-gray-400 text-sm">No customer data available.</p>
              ) : (
                <div className="space-y-3">
                  {topCustomers.slice(0, 10).map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div>
                        <p className="text-white text-sm font-medium">{c.name}</p>
                        <p className="text-gray-400 text-xs">{c.email}</p>
                      </div>
                      <span className="text-green-400 font-medium text-sm">{formatCurrency(c.total_spend)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">At-Risk Customers</h3>
              {atRiskCustomers.length === 0 ? (
                <p className="text-gray-400 text-sm">No at-risk customers.</p>
              ) : (
                <div className="space-y-3">
                  {atRiskCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div>
                        <p className="text-white text-sm font-medium">{c.name}</p>
                        <p className="text-gray-400 text-xs">{c.email}</p>
                      </div>
                      <Badge variant="warning">At Risk</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Interactions</h3>
            {recentInteractions.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent interactions.</p>
            ) : (
              <div className="space-y-3">
                {recentInteractions.slice(0, 10).map((i) => (
                  <div key={i.id} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
                    <div className="text-gray-400">{INTERACTION_ICONS[i.type] ?? <MessageSquare className="w-4 h-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{i.subject}</p>
                      <p className="text-gray-400 text-xs">{i.customer_name} · {formatDate(i.created_at)}</p>
                    </div>
                    <Badge variant="default">{i.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Segments Tab ──────────────────────────────────────────────────── */}
      {!loading && activeTab === 'segments' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Add Segment</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Segment name"
                value={segmentForm.name}
                onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Input
                placeholder="Description"
                value={segmentForm.description}
                onChange={(e) => setSegmentForm({ ...segmentForm, description: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <div className="flex items-center gap-2">
                <label className="text-gray-400 text-sm">Color:</label>
                <input
                  type="color"
                  value={segmentForm.color}
                  onChange={(e) => setSegmentForm({ ...segmentForm, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
              </div>
              <Button onClick={handleAddSegment} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Segment
              </Button>
            </div>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Segments</h3>
            {segments.length === 0 ? (
              <EmptyState icon={Tag} title="No Segments" description="Create a segment to group customers." />
            ) : (
              <div className="space-y-2">
                {segments.map((seg) => (
                  <div key={seg.id}>
                    <button
                      onClick={() => handleViewSegmentMembers(seg.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                        <div className="text-left">
                          <p className="text-white text-sm font-medium">{seg.name}</p>
                          <p className="text-gray-400 text-xs">{seg.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{seg.member_count} members</Badge>
                        {selectedSegment === seg.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {selectedSegment === seg.id && (
                      <div className="ml-6 mt-2 space-y-1">
                        {segmentMembers.length === 0 ? (
                          <p className="text-gray-400 text-sm py-2">No members in this segment.</p>
                        ) : (
                          segmentMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-gray-800/80 rounded border border-gray-700">
                              <p className="text-white text-sm">{m.name}</p>
                              <p className="text-gray-400 text-xs">{m.email}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Interactions Tab ──────────────────────────────────────────────── */}
      {!loading && activeTab === 'interactions' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Log Interaction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={interactionForm.customer_id}
                onChange={(e) => setInteractionForm({ ...interactionForm, customer_id: e.target.value })}
                className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={interactionForm.type}
                onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })}
                className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
                ))}
              </select>
              <Input
                placeholder="Subject"
                value={interactionForm.subject}
                onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Input
                type="date"
                placeholder="Follow-up date (optional)"
                value={interactionForm.follow_up_date}
                onChange={(e) => setInteractionForm({ ...interactionForm, follow_up_date: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <div className="md:col-span-2">
                <textarea
                  placeholder="Content"
                  value={interactionForm.content}
                  onChange={(e) => setInteractionForm({ ...interactionForm, content: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={handleLogInteraction} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Log Interaction
                </Button>
              </div>
            </div>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Interactions</h3>
            {recentInteractions.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No Interactions" description="Log your first interaction above." />
            ) : (
              <div className="space-y-3">
                {recentInteractions.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 py-3 px-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="text-gray-400">{INTERACTION_ICONS[i.type] ?? <MessageSquare className="w-4 h-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{i.subject}</p>
                      <p className="text-gray-400 text-xs">{i.customer_name} · {formatDate(i.created_at)}</p>
                      {i.content && <p className="text-gray-500 text-xs mt-1 truncate">{i.content}</p>}
                    </div>
                    <Badge variant="default">{i.type.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Follow-ups Tab ────────────────────────────────────────────────── */}
      {!loading && activeTab === 'follow-ups' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pending Follow-ups</h3>
            {followUps.length === 0 ? (
              <EmptyState icon={Calendar} title="No Follow-ups" description="All follow-ups are completed." />
            ) : (
              <div className="space-y-3">
                {followUps.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-3 px-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{f.subject}</p>
                      <p className="text-gray-400 text-xs">{f.customer_name} · Due: {formatDate(f.follow_up_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {new Date(f.follow_up_date) < new Date() && (
                        <Badge variant="danger">Overdue</Badge>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleCompleteFollowUp(f.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="w-4 h-4 mr-1" /> Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
