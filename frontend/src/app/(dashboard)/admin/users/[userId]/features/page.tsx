'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Settings, Check, X, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { adminApi, AdminUser, SubscriptionTier } from '@/lib/admin-api'

const ALL_FEATURES = [
  { key: 'basic_reports', label: 'Basic Reports', description: 'Access to basic reporting features' },
  { key: 'inventory_tracking', label: 'Inventory Tracking', description: 'Track inventory levels' },
  { key: 'cost_calculations', label: 'Cost Calculations', description: 'Calculate product costs' },
  { key: 'email_support', label: 'Email Support', description: 'Access to email support' },
  { key: 'export_reports', label: 'Export Reports', description: 'Export reports to Excel/PDF' },
  { key: 'ai_insights', label: 'AI Business Insights', description: 'AI-powered business recommendations' },
  { key: 'custom_categories', label: 'Custom Categories', description: 'Create custom product categories' },
  { key: 'priority_support', label: 'Priority Support', description: '24/7 priority support' },
  { key: 'multi_location', label: 'Multi-Location', description: 'Manage multiple business locations' },
  { key: 'api_access', label: 'API Access', description: 'Access to BizPilot API' },
  { key: 'team_collaboration', label: 'Team Collaboration', description: 'Invite team members' },
  { key: 'custom_integrations', label: 'Custom Integrations', description: 'Connect third-party services' },
  { key: 'advanced_reporting', label: 'Advanced Reporting', description: 'Advanced analytics and reports' },
]

export default function UserFeaturesPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string
  
  const [user, setUser] = useState<AdminUser | null>(null)
  const [tier, setTier] = useState<SubscriptionTier | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await adminApi.getUser(userId)
        setUser(userData)
        setOverrides(userData.feature_overrides || {})
        
        if (userData.current_tier_id) {
          const tiers = await adminApi.listTiers(true)
          const userTier = tiers.find(t => t.id === userData.current_tier_id)
          setTier(userTier || null)
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [userId])

  const getTierFeatureValue = (feature: string): boolean => {
    return tier?.feature_flags?.[feature] ?? false
  }

  const getEffectiveValue = (feature: string): boolean => {
    if (feature in overrides) {
      return overrides[feature]
    }
    return getTierFeatureValue(feature)
  }

  const hasOverride = (feature: string): boolean => {
    return feature in overrides
  }

  const toggleOverride = (feature: string, value: boolean) => {
    setOverrides(prev => ({ ...prev, [feature]: value }))
  }

  const removeOverride = async (feature: string) => {
    try {
      await adminApi.removeFeatureOverride(userId, feature)
      setOverrides(prev => {
        const newOverrides = { ...prev }
        delete newOverrides[feature]
        return newOverrides
      })
    } catch (error) {
      console.error('Failed to remove override:', error)
    }
  }

  const saveOverrides = async () => {
    setSaving(true)
    try {
      await adminApi.updateFeatureOverrides(userId, overrides)
      router.push('/admin/users')
    } catch (error) {
      console.error('Failed to save overrides:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">User not found</p>
        <Link href="/admin/users" className="text-purple-400 hover:text-purple-300 mt-2 inline-block">
          Back to Users
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users" className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-purple-500" />
            Feature Overrides
          </h1>
          <p className="text-gray-400 mt-1">
            {user.first_name} {user.last_name} ({user.email})
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-400">Current Tier</p>
            <p className="text-lg font-semibold text-white">
              {tier?.display_name || 'Free (No Tier)'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Overrides Active</p>
            <p className="text-lg font-semibold text-purple-400">
              {Object.keys(overrides).length}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Override specific features for this user regardless of their subscription tier.
          Overridden features are highlighted in purple.
        </p>

        <div className="space-y-3">
          {ALL_FEATURES.map((feature) => {
            const tierValue = getTierFeatureValue(feature.key)
            const effectiveValue = getEffectiveValue(feature.key)
            const isOverridden = hasOverride(feature.key)

            return (
              <motion.div
                key={feature.key}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isOverridden
                    ? 'bg-purple-900/20 border-purple-500/50'
                    : 'bg-slate-900/50 border-slate-700/50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{feature.label}</span>
                    {isOverridden && (
                      <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
                        Overridden
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                  {!isOverridden && (
                    <p className="text-xs text-gray-500 mt-1">
                      Tier default: {tierValue ? 'Enabled' : 'Disabled'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isOverridden && (
                    <button
                      onClick={() => removeOverride(feature.key)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Reset to tier default"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="flex rounded-lg overflow-hidden border border-slate-600">
                    <button
                      onClick={() => toggleOverride(feature.key, false)}
                      className={`p-2 transition-colors ${
                        !effectiveValue
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleOverride(feature.key, true)}
                      className={`p-2 transition-colors ${
                        effectiveValue
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-700">
          <Link
            href="/admin/users"
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={saveOverrides}
            disabled={saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  )
}
