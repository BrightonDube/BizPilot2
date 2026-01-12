'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  Ban, 
  CheckCircle,
  Shield,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Settings,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { adminApi, AdminUser, UserListResponse, SubscriptionTier, UserStatus, SubscriptionStatus } from '@/lib/admin-api'
import { Select } from '@/components/ui'

function UserStatusBadge({ status }: { status: UserStatus }) {
  const colors: Record<UserStatus, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
      {status}
    </span>
  )
}

function UserBusinesses({ user }: { user: AdminUser }) {
  const businesses = user.businesses || []
  if (businesses.length === 0) {
    return <div className="text-xs text-gray-500">No business</div>
  }

  const primary = businesses.find((b) => b.is_primary)
  const names = businesses.map((b) => b.business.name)

  return (
    <div className="text-xs text-gray-500">
      {primary ? (
        <span>Primary: {primary.business.name}</span>
      ) : (
        <span>Businesses: {names.join(', ')}</span>
      )}
    </div>
  )
}

function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status || status === 'none') {
    return <span className="text-gray-500 text-sm">Free</span>
  }
  const colors: Record<string, string> = {
    active: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    paused: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.active}`}>
      {status}
    </span>
  )
}

interface EditUserModalProps {
  user: AdminUser
  tiers: SubscriptionTier[]
  onClose: () => void
  onSave: (user: AdminUser) => void
}

function EditUserModal({ user, tiers, onClose, onSave }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone || '',
    status: user.status,
    is_admin: user.is_admin,
    subscription_status: user.subscription_status || 'none',
    current_tier_id: user.current_tier_id || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Update basic info
      const updatedUser = await adminApi.updateUser(user.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || undefined,
        status: formData.status,
        is_admin: formData.is_admin,
      })
      
      // Update subscription
      await adminApi.updateSubscription(user.id, {
        subscription_status: formData.subscription_status as SubscriptionStatus,
        current_tier_id: formData.current_tier_id || null,
      })
      
      onSave(updatedUser)
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Edit User</h2>
          <p className="text-sm text-gray-400 mt-1">{user.email}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Account Status</label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                className="w-full"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Subscription Status</label>
              <Select
                value={formData.subscription_status}
                onChange={(e) => setFormData({ ...formData, subscription_status: e.target.value as SubscriptionStatus })}
                className="w-full"
              >
                <option value="none">None (Free)</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </Select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subscription Tier</label>
            <Select
              value={formData.current_tier_id}
              onChange={(e) => setFormData({ ...formData, current_tier_id: e.target.value })}
              className="w-full"
              disabled={tiers.length === 0}
            >
              <option value="">No Tier (Free)</option>
              {tiers.length === 0 && <option value="" disabled>Loading tiers...</option>}
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.display_name} - R{tier.price_monthly_cents / 100}/mo
                </option>
              ))}
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_admin"
              checked={formData.is_admin}
              onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
              className="rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="is_admin" className="text-sm text-gray-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              Admin Access
            </label>
          </div>
          
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

export default function AdminUsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null)
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [updatingTierUserId, setUpdatingTierUserId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const users = await adminApi.listUsers({
        page,
        per_page: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      })
      setData(users)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    adminApi.listTiers(true).then(setTiers).catch(console.error)
  }, [])

  const ensureTiersLoaded = async () => {
    if (tiers.length > 0) return
    try {
      const next = await adminApi.listTiers(true)
      setTiers(next)
    } catch (error) {
      console.error('Failed to load tiers:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadUsers()
  }

  const handleBlock = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to ${user.status === 'suspended' ? 'unblock' : 'block'} ${user.email}?`)) {
      return
    }
    try {
      if (user.status === 'suspended') {
        await adminApi.unblockUser(user.id)
      } else {
        await adminApi.blockUser(user.id)
      }
      loadUsers()
    } catch (error) {
      console.error('Failed to block/unblock user:', error)
    }
  }

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
      return
    }
    try {
      await adminApi.deleteUser(user.id)
      loadUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  const handlePauseSubscription = async (user: AdminUser) => {
    try {
      if (user.subscription_status === 'paused') {
        await adminApi.unpauseSubscription(user.id)
      } else {
        await adminApi.pauseSubscription(user.id)
      }
      loadUsers()
    } catch (error) {
      console.error('Failed to pause/unpause subscription:', error)
    }
  }

  const handleTierChange = async (user: AdminUser, nextTierId: string) => {
    setUpdatingTierUserId(user.id)
    try {
      await adminApi.updateSubscription(user.id, {
        current_tier_id: nextTierId || null,
        subscription_status: nextTierId ? 'active' : 'none',
      })
      loadUsers()
    } catch (error) {
      console.error('Failed to update subscription tier:', error)
    } finally {
      setUpdatingTierUserId(null)
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
              <Users className="w-7 h-7 text-purple-500" />
              User Management
            </h1>
            <p className="text-gray-400 mt-1">
              {data?.total || 0} total users
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
              placeholder="Search users..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </form>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as UserStatus | '')
            setPage(1)
          }}
          className="w-auto"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Subscription</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Joined</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                data?.users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                          {user.first_name[0]}{user.last_name[0]}
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            {user.first_name} {user.last_name}
                            {user.is_admin && (
                              <Shield className="w-4 h-4 text-purple-500" aria-label="Admin" />
                            )}
                          </div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                          <UserBusinesses user={user} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <UserStatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionStatusBadge status={user.subscription_status} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.current_tier_id || ''}
                          onChange={(e) => handleTierChange(user, e.target.value)}
                          disabled={updatingTierUserId === user.id}
                          className="w-auto"
                        >
                          <option value="">Free</option>
                          {tiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.display_name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={async () => {
                            await ensureTiersLoaded()
                            setEditingUser(user)
                          }}
                          className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user.subscription_status && user.subscription_status !== 'none' && (
                          <button
                            onClick={() => handlePauseSubscription(user)}
                            className="p-2 text-gray-400 hover:text-orange-400 hover:bg-slate-700 rounded-lg transition-colors"
                            title={user.subscription_status === 'paused' ? 'Unpause Subscription' : 'Pause Subscription'}
                          >
                            {user.subscription_status === 'paused' ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <Link
                          href={`/admin/users/${user.id}/features`}
                          className="p-2 text-gray-400 hover:text-purple-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Feature Overrides"
                        >
                          <Settings className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleBlock(user)}
                          className={`p-2 hover:bg-slate-700 rounded-lg transition-colors ${
                            user.status === 'suspended' 
                              ? 'text-green-400 hover:text-green-300' 
                              : 'text-gray-400 hover:text-red-400'
                          }`}
                          title={user.status === 'suspended' ? 'Unblock' : 'Block'}
                        >
                          {user.status === 'suspended' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      {editingUser && (
        <EditUserModal
          user={editingUser}
          tiers={tiers}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            setEditingUser(null)
            loadUsers()
          }}
        />
      )}
    </div>
  )
}
