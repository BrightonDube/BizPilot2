'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Clock,
  Shield,
  UserCheck,
  UserX,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { adminApi, AdminStats } from '@/lib/admin-api'

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  href 
}: { 
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  href?: string
}) {
  const content = (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className={`bg-card border border-border rounded-xl p-6 ${href ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await adminApi.getStats()
        setStats(data)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load stats'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
        {error}
      </div>
    )
  }

  const formatCurrency = (cents: number) => {
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-purple-500" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage users, subscriptions, and system settings</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.total_users || 0}
          icon={Users}
          color="bg-blue-600"
          href="/admin/users"
        />
        <StatCard
          title="Active Users"
          value={stats?.active_users || 0}
          icon={UserCheck}
          color="bg-green-600"
        />
        <StatCard
          title="Subscribed Users"
          value={stats?.subscribed_users || 0}
          icon={CreditCard}
          color="bg-purple-600"
        />
        <StatCard
          title="Trial Users"
          value={stats?.trial_users || 0}
          icon={Clock}
          color="bg-yellow-600"
        />
      </div>

      {/* Revenue Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Revenue This Month</p>
            <p className="text-3xl font-bold text-foreground">
              {formatCurrency(stats?.revenue_this_month_cents || 0)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-purple-600/30">
            <DollarSign className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/users">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-card border border-border rounded-xl p-6 cursor-pointer hover:border-purple-500/50 transition-colors"
          >
            <Users className="w-8 h-8 text-purple-500 mb-3" />
            <h3 className="text-lg font-semibold text-foreground">User Management</h3>
            <p className="text-sm text-muted-foreground mt-1">View, edit, and manage all users</p>
          </motion.div>
        </Link>

        <Link href="/admin/tiers">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-card border border-border rounded-xl p-6 cursor-pointer hover:border-purple-500/50 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-blue-500 mb-3" />
            <h3 className="text-lg font-semibold text-foreground">Subscription Tiers</h3>
            <p className="text-sm text-muted-foreground mt-1">Manage pricing tiers and features</p>
          </motion.div>
        </Link>

        <Link href="/admin/transactions">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-card border border-border rounded-xl p-6 cursor-pointer hover:border-purple-500/50 transition-colors"
          >
            <CreditCard className="w-8 h-8 text-green-500 mb-3" />
            <h3 className="text-lg font-semibold text-foreground">Transactions</h3>
            <p className="text-sm text-muted-foreground mt-1">View payment history</p>
          </motion.div>
        </Link>
      </div>

      {/* Users by Tier */}
      {stats?.users_by_tier && Object.keys(stats.users_by_tier).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">Users by Tier</h3>
          <div className="space-y-3">
            {Object.entries(stats.users_by_tier).map(([tier, count]) => (
              <div key={tier} className="flex items-center justify-between">
                <span className="text-muted-foreground capitalize">{tier}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min((count / stats.total_users) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <span className="text-foreground font-medium w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Users by Status */}
      {stats?.users_by_status && Object.keys(stats.users_by_status).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">Users by Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.users_by_status).map(([status, count]) => {
              const statusColors: Record<string, string> = {
                active: 'text-green-400',
                pending: 'text-yellow-400',
                inactive: 'text-muted-foreground',
                suspended: 'text-red-400',
              }
              return (
                <div key={status} className="text-center">
                  <p className={`text-2xl font-bold ${statusColors[status] || 'text-foreground'}`}>
                    {count}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">{status}</p>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
