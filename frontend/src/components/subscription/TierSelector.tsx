'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Zap, Crown, Building2 } from 'lucide-react'
import { subscriptionApi, SubscriptionTier } from '@/lib/subscription-api'

interface TierSelectorProps {
  selectedTierId?: string
  onSelect: (tier: SubscriptionTier, billingCycle: 'monthly' | 'yearly') => void
  showBillingToggle?: boolean
}

const tierIcons: Record<string, React.ElementType> = {
  free: Zap,
  professional: Crown,
  enterprise: Building2,
}

export function TierSelector({ selectedTierId, onSelect, showBillingToggle = true }: TierSelectorProps) {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    subscriptionApi.getTiers()
      .then(setTiers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`
  }

  const getPrice = (tier: SubscriptionTier) => {
    return billingCycle === 'monthly' ? tier.price_monthly_cents : tier.price_yearly_cents
  }

  const getMonthlyEquivalent = (tier: SubscriptionTier) => {
    if (billingCycle === 'monthly') return tier.price_monthly_cents
    return Math.round(tier.price_yearly_cents / 12)
  }

  const getSavings = (tier: SubscriptionTier) => {
    if (tier.price_monthly_cents === 0) return 0
    const yearlyMonthly = tier.price_yearly_cents / 12
    const savings = ((tier.price_monthly_cents - yearlyMonthly) / tier.price_monthly_cents) * 100
    return Math.round(savings)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      {showBillingToggle && (
        <div className="flex justify-center">
          <div className="bg-slate-800 rounded-lg p-1 flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-400">Save 20%</span>
            </button>
          </div>
        </div>
      )}

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier, index) => {
          const Icon = tierIcons[tier.name] || Zap
          const isSelected = selectedTierId === tier.id
          const isProfessional = tier.name === 'professional'
          const savings = getSavings(tier)

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(tier, billingCycle)}
              className={`relative cursor-pointer rounded-xl border p-6 transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-900/20 ring-2 ring-purple-500/50'
                  : isProfessional
                  ? 'border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20 hover:border-purple-400'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              {isProfessional && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-medium text-white rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isProfessional ? 'bg-purple-600' : 'bg-slate-700'}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{tier.display_name}</h3>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">
                    {formatPrice(getMonthlyEquivalent(tier))}
                  </span>
                  {tier.price_monthly_cents > 0 && (
                    <span className="text-gray-400">/mo</span>
                  )}
                </div>
                {billingCycle === 'yearly' && savings > 0 && (
                  <p className="text-sm text-green-400 mt-1">
                    Save {savings}% with annual billing
                  </p>
                )}
                {billingCycle === 'yearly' && tier.price_yearly_cents > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatPrice(tier.price_yearly_cents)} billed annually
                  </p>
                )}
              </div>

              <p className="text-sm text-gray-400 mb-6">{tier.description}</p>

              {/* Features */}
              <div className="space-y-2">
                {Object.entries(tier.feature_flags || {}).slice(0, 6).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    {enabled ? (
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    )}
                    <span className={enabled ? 'text-gray-300' : 'text-gray-500'}>
                      {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>

              {/* Limits */}
              {tier.features && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  {Object.entries(tier.features).slice(0, 3).map(([limit, value]) => (
                    <div key={limit} className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        {limit.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-white font-medium">
                        {value === -1 ? 'Unlimited' : value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default TierSelector
