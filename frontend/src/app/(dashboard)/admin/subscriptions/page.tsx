'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  Search,
  Edit2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { RequireAdmin } from '@/components/subscription/FeatureGate'
import { Select } from '@/components/ui'

type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'expired'
type TierName = 'free' | 'starter' | 'professional' | 'enterprise'

interface BusinessSubscription {
  id: string
  business_name: string
  tier: TierName
  status: SubscriptionStatus
  valid_until: string | null
}

interface SubscriptionListResponse {
  items: BusinessSubscription[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const TIER_OPTIONS: TierName[] = ['free', 'starter', 'professional', 'enterprise']
const STATUS_OPTIONS: SubscriptionStatus[] = ['active', 'suspended', 'cancelled', 'expired']

const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function TierBadge({ tier }: { tier: TierName }) {
  const colors: Record<TierName, string> = {
    free: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    professional: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${colors[tier]}`}>
      {tier}
    </span>
  )
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const colors: Record<SubscriptionStatus, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    suspended: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${colors[status]}`}>
      {status}
    </span>
  )
}

interface EditModalProps {
  subscription: BusinessSubscription
  onClose: () => void
  onSave: () => void
}

function EditSubscriptionModal({ subscription, onClose, onSave }: EditModalProps) {
  const [formData, setFormData] = useState({
    tier: subscription.tier,
    status: subscription.status,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiClient.put(`/admin/subscriptions/${subscription.id}`, formData)
      onSave()
    } catch (err) {
      console.error('Failed to update subscription:', err)
      setError('Failed to update subscription. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md"
      >
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Edit Subscription</h2>
          <p className="text-sm text-gray-400 mt-1">{subscription.business_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tier</label>
            <Select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value as TierName })}
              className="w-full"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as SubscriptionStatus })}
              className="w-full"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function AdminSubscriptionsContent() {
  const [data, setData] = useState<SubscriptionListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('')
  const [page, setPage] = useState(1)
  const [editingSub, setEditingSub] = useState<BusinessSubscription | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)

  const loadSubscriptions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: result } = await apiClient.get('/admin/subscriptions', {
        params: {
          page,
          per_page: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        },
      })
      setData(result)
    } catch (err) {
      console.error('Failed to load subscriptions:', err)
      setError('Failed to load subscriptions.')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadSubscriptions()
  }

  const handleReactivate = async (sub: BusinessSubscription) => {
    if (!confirm(`Reactivate subscription for "${sub.business_name}"?`)) return
    setReactivatingId(sub.id)
    try {
      await apiClient.post(`/admin/subscriptions/${sub.id}/reactivate`)
      loadSubscriptions()
    } catch (err) {
      console.error('Failed to reactivate subscription:', err)
    } finally {
      setReactivatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-purple-500" />
              Subscription Management
            </h1>
            <p className="text-gray-400 mt-1">
              {data?.total || 0} total subscriptions
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search businesses..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </form>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as SubscriptionStatus | '')
            setPage(1)
          }}
          className="w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Business</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Valid Until</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                    </div>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                data.items.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{sub.business_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={sub.tier} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {sub.valid_until
                        ? dateFormatter.format(new Date(sub.valid_until))
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingSub(sub)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(sub.status === 'cancelled' || sub.status === 'expired' || sub.status === 'suspended') && (
                          <button
                            onClick={() => handleReactivate(sub)}
                            disabled={reactivatingId === sub.id}
                            className="p-2 text-gray-400 hover:text-green-400 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Reactivate"
                          >
                            <RefreshCw className={`w-4 h-4 ${reactivatingId === sub.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <div className="text-sm text-gray-400">
              Page {data.page} of {data.total_pages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= data.total_pages}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingSub && (
        <EditSubscriptionModal
          subscription={editingSub}
          onClose={() => setEditingSub(null)}
          onSave={() => {
            setEditingSub(null)
            loadSubscriptions()
          }}
        />
      )}
    </div>
  )
}

export default function AdminSubscriptionsPage() {
  return (
    <RequireAdmin>
      <AdminSubscriptionsContent />
    </RequireAdmin>
  )
}
