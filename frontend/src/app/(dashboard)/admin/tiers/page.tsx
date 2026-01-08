'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Check,
  X,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { adminApi, SubscriptionTier } from '@/lib/admin-api'

export default function AdminTiersPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const loadTiers = async () => {
    try {
      const data = await adminApi.listTiers(true)
      setTiers(data)
    } catch (error) {
      console.error('Failed to load tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTiers()
  }, [])

  const handleSeedTiers = async () => {
    setSeeding(true)
    try {
      await adminApi.seedDefaultTiers()
      await loadTiers()
    } catch (error) {
      console.error('Failed to seed tiers:', error)
    } finally {
      setSeeding(false)
    }
  }

  const handleDelete = async (tier: SubscriptionTier) => {
    if (!confirm(`Are you sure you want to delete the "${tier.display_name}" tier?`)) {
      return
    }
    try {
      await adminApi.deleteTier(tier.id)
      await loadTiers()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete tier'
      alert(message)
    }
  }

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
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
              <TrendingUp className="w-7 h-7 text-purple-500" />
              Subscription Tiers
            </h1>
            <p className="text-gray-400 mt-1">Manage pricing tiers and features</p>
          </div>
        </div>
        <div className="flex gap-3">
          {tiers.length === 0 && (
            <button
              onClick={handleSeedTiers}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {seeding ? 'Seeding...' : 'Seed Default Tiers'}
            </button>
          )}
        </div>
      </div>

      {tiers.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Tiers Configured</h3>
          <p className="text-gray-400 mb-6">
            Click &quot;Seed Default Tiers&quot; to create the standard Free, Professional, and Enterprise tiers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-slate-800/50 border rounded-xl overflow-hidden ${
                tier.is_active ? 'border-slate-700/50' : 'border-red-500/30 opacity-60'
              }`}
            >
              <div className={`p-6 ${tier.is_default ? 'bg-purple-900/20' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{tier.display_name}</h3>
                    <p className="text-sm text-gray-400">{tier.name}</p>
                  </div>
                  {tier.is_default && (
                    <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-1 rounded-full">
                      Default
                    </span>
                  )}
                  {!tier.is_active && (
                    <span className="text-xs bg-red-500/30 text-red-300 px-2 py-1 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-400 mb-4">{tier.description}</p>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly</span>
                    <span className="text-white font-bold">
                      {tier.price_monthly_cents === 0 ? 'Free' : formatPrice(tier.price_monthly_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Yearly</span>
                    <span className="text-white font-bold">
                      {tier.price_yearly_cents === 0 ? 'Free' : formatPrice(tier.price_yearly_cents)}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-sm font-medium text-gray-300 mb-3">Features</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Object.entries(tier.feature_flags || {}).map(([feature, enabled]) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        {enabled ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-gray-600" />
                        )}
                        <span className={enabled ? 'text-gray-300' : 'text-gray-500'}>
                          {feature.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Limits */}
                {tier.features && Object.keys(tier.features).length > 0 && (
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <p className="text-sm font-medium text-gray-300 mb-3">Limits</p>
                    <div className="space-y-1">
                      {Object.entries(tier.features).map(([limit, value]) => (
                        <div key={limit} className="flex justify-between text-sm">
                          <span className="text-gray-400">{limit.replace(/_/g, ' ')}</span>
                          <span className="text-white">
                            {value === -1 ? 'Unlimited' : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex border-t border-slate-700">
                <button
                  onClick={() => handleDelete(tier)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
