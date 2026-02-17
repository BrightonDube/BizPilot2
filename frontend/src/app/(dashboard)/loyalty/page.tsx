'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Users,
  Star,
  Gift,
  Trophy,
  Settings,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
  Award,
  AlertTriangle,
  History,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { toNumber } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LoyaltyProgram {
  id: string;
  points_per_rand: number;
  redemption_rate: number;
  min_redemption_points: number;
  tier_thresholds: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

interface LoyaltyMember {
  id: string;
  customer_name: string;
  points_balance: number;
  tier: string;
  lifetime_points: number;
}

interface MemberListResponse {
  items: LoyaltyMember[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface LoyaltyStats {
  total_members: number;
  total_points_issued: number;
  points_redeemed: number;
  active_program: boolean;
}

interface PointsHistoryEntry {
  id: string;
  date: string;
  description: string;
  points: number;
  type: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  silver: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
  gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const statCardDefs = [
  { key: 'total_members', label: 'Total Members', icon: Users, color: 'blue' },
  { key: 'total_points_issued', label: 'Points Issued', icon: Star, color: 'purple' },
  { key: 'points_redeemed', label: 'Points Redeemed', icon: Gift, color: 'green' },
  { key: 'active_program', label: 'Program Status', icon: Trophy, color: 'yellow' },
] as const;

const colorMap: Record<string, { container: string; icon: string }> = {
  blue: { container: 'bg-blue-500/20 border-blue-500/30', icon: 'text-blue-400' },
  purple: { container: 'bg-purple-500/20 border-purple-500/30', icon: 'text-purple-400' },
  green: { container: 'bg-green-500/20 border-green-500/30', icon: 'text-green-400' },
  yellow: { container: 'bg-yellow-500/20 border-yellow-500/30', icon: 'text-yellow-400' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LoyaltyPage() {
  /* ---- program config ---- */
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [editProgram, setEditProgram] = useState<LoyaltyProgram | null>(null);
  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);

  /* ---- stats ---- */
  const [stats, setStats] = useState<LoyaltyStats>({ total_members: 0, total_points_issued: 0, points_redeemed: 0, active_program: false });

  /* ---- members list ---- */
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- history modal ---- */
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ---- bonus points modal ---- */
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusMemberId, setBonusMemberId] = useState<string | null>(null);
  const [bonusForm, setBonusForm] = useState({ points: '', description: '' });
  const [bonusSubmitting, setBonusSubmitting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch program & stats                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    async function load() {
      try {
        const [programRes, statsRes] = await Promise.all([
          apiClient.get<LoyaltyProgram>('/loyalty/program'),
          apiClient.get<LoyaltyStats>('/loyalty/stats'),
        ]);
        setProgram(programRes.data);
        setEditProgram(programRes.data);
        setStats(statsRes.data);
      } catch {
        /* stats will remain defaults */
      }
    }
    load();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Save program config                                              */
  /* ---------------------------------------------------------------- */

  const saveProgram = async () => {
    if (!editProgram) return;
    setSavingProgram(true);
    try {
      const res = await apiClient.put<LoyaltyProgram>('/loyalty/program', editProgram);
      setProgram(res.data);
      setEditProgram(res.data);
      setIsEditingProgram(false);
    } catch {
      /* keep editing */
    } finally {
      setSavingProgram(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Fetch members                                                    */
  /* ---------------------------------------------------------------- */

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: page.toString(), per_page: '20' });
      if (searchTerm) params.append('search', searchTerm);
      if (tierFilter !== 'all') params.append('tier', tierFilter);

      const res = await apiClient.get<MemberListResponse>(`/loyalty/members?${params}`);
      setMembers(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      setError('Failed to load loyalty members');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, tierFilter]);

  useEffect(() => {
    const id = setTimeout(fetchMembers, 300);
    return () => clearTimeout(id);
  }, [fetchMembers]);

  /* ---------------------------------------------------------------- */
  /*  History modal                                                    */
  /* ---------------------------------------------------------------- */

  const openHistory = async (member: LoyaltyMember) => {
    setSelectedMember(member);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const res = await apiClient.get<PointsHistoryEntry[]>(`/loyalty/members/${member.id}/history`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Bonus points                                                     */
  /* ---------------------------------------------------------------- */

  const openBonus = (memberId: string) => {
    setBonusMemberId(memberId);
    setBonusForm({ points: '', description: '' });
    setShowBonusModal(true);
  };

  const submitBonus = async () => {
    if (!bonusMemberId || !bonusForm.points) return;
    setBonusSubmitting(true);
    try {
      await apiClient.post('/loyalty/earn', {
        member_id: bonusMemberId,
        points: parseInt(bonusForm.points, 10),
        description: bonusForm.description,
      });
      setShowBonusModal(false);
      fetchMembers();
    } catch {
      /* keep modal open */
    } finally {
      setBonusSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Loyalty Program</h1>
          <p className="text-gray-400 text-sm mt-1">Manage rewards, tiers and member points</p>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCardDefs.map((s, i) => {
          const Icon = s.icon;
          const c = colorMap[s.color];
          const raw = stats[s.key];
          const display = s.key === 'active_program' ? (raw ? 'Active' : 'Inactive') : toNumber(raw).toLocaleString();
          return (
            <motion.div
              key={s.key}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg border ${c.container}`}>
                  <Icon className={`h-5 w-5 ${c.icon}`} />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-400">{s.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{display}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Program configuration */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/50 border border-gray-700 rounded-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Program Configuration</h2>
          </div>
          {!isEditingProgram ? (
            <Button variant="outline" size="sm" onClick={() => { setEditProgram(program); setIsEditingProgram(true); }}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditProgram(program); setIsEditingProgram(false); }}>
                Cancel
              </Button>
              <Button size="sm" disabled={savingProgram} onClick={saveProgram}>
                {savingProgram ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {editProgram && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Points per Rand</label>
              <Input
                type="number"
                min="0"
                step="0.1"
                disabled={!isEditingProgram}
                value={editProgram.points_per_rand}
                onChange={(e) => setEditProgram({ ...editProgram, points_per_rand: parseFloat(e.target.value) || 0 })}
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Redemption Rate</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={!isEditingProgram}
                value={editProgram.redemption_rate}
                onChange={(e) => setEditProgram({ ...editProgram, redemption_rate: parseFloat(e.target.value) || 0 })}
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Min Redemption Points</label>
              <Input
                type="number"
                min="0"
                disabled={!isEditingProgram}
                value={editProgram.min_redemption_points}
                onChange={(e) => setEditProgram({ ...editProgram, min_redemption_points: parseInt(e.target.value, 10) || 0 })}
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tier Thresholds</label>
              <div className="space-y-2">
                {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier) => (
                  <div key={tier} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${tierColors[tier]}`}>{tier}</span>
                    <Input
                      type="number"
                      min="0"
                      disabled={!isEditingProgram}
                      value={editProgram.tier_thresholds[tier]}
                      onChange={(e) =>
                        setEditProgram({
                          ...editProgram,
                          tier_thresholds: { ...editProgram.tier_thresholds, [tier]: parseInt(e.target.value, 10) || 0 },
                        })
                      }
                      className="bg-gray-900 border-gray-700 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Search & filter */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search members…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Tiers</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
      </motion.div>

      {/* Error */}
      {error && members.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">{error}</h3>
          <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && members.length === 0 && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && members.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No members found</h3>
          <p className="text-gray-400 text-sm mt-1">Adjust your search or filters</p>
        </motion.div>
      )}

      {/* Members table */}
      {members.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Points Balance</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3 text-right">Lifetime Points</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{m.customer_name}</td>
                    <td className="px-4 py-3 text-right text-white">{toNumber(m.points_balance).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${tierColors[m.tier] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {m.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{toNumber(m.lifetime_points).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openHistory(m)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="History">
                          <History className="h-4 w-4" />
                        </button>
                        <button onClick={() => openBonus(m.id)} className="p-1.5 rounded-lg hover:bg-purple-700/50 text-gray-400 hover:text-purple-300 transition-colors" title="Award Points">
                          <Award className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
              <span className="text-sm text-gray-400">Page {page} of {pages} ({total} members)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ============================================================= */}
      {/*  Points History Modal                                          */}
      {/* ============================================================= */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedMember.customer_name}</h2>
                <p className="text-sm text-gray-400">Points History</p>
              </div>
              <button onClick={() => setSelectedMember(null)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className="text-lg font-bold text-white">{toNumber(selectedMember.points_balance).toLocaleString()}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Tier</p>
                  <p className="text-lg font-bold">
                    <span className={`px-2 py-0.5 rounded-full text-sm font-medium border capitalize ${tierColors[selectedMember.tier] ?? ''}`}>
                      {selectedMember.tier}
                    </span>
                  </p>
                </div>
              </div>

              {/* History list */}
              {historyLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : history.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No history available</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-white">{h.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(h.date)}</p>
                      </div>
                      <p className={`text-sm font-medium ${h.type === 'earn' ? 'text-green-400' : 'text-red-400'}`}>
                        {h.type === 'earn' ? '+' : '-'}{toNumber(h.points).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Award Bonus Points Modal                                      */}
      {/* ============================================================= */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowBonusModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Award Bonus Points</h2>
              <button onClick={() => setShowBonusModal(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Points</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={bonusForm.points}
                  onChange={(e) => setBonusForm({ ...bonusForm, points: e.target.value })}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <Input
                  placeholder="Reason for bonus points"
                  value={bonusForm.description}
                  onChange={(e) => setBonusForm({ ...bonusForm, description: e.target.value })}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowBonusModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!bonusForm.points || bonusSubmitting} onClick={submitBonus}>
                  {bonusSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Award className="h-4 w-4 mr-2" />}
                  Award Points
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
