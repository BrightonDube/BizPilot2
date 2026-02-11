'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import Link from 'next/link'
import { subscriptionApi } from '@/lib/subscription-api'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type TierTheme = {
  cardClassName: string
  iconCheckedClassName: string
  iconUncheckedClassName: string
  buttonClassName: string
}

interface Benefit {
  text: string
  checked: boolean
}

interface PricingCardData {
  key: string
  tier: string
  price: string
  bestFor: string
  cta: string
  featured: boolean
  benefits: Benefit[]
  ctaHref: string
  planId: string
}

interface PricingClientWrapperProps {
  monthlyCards: PricingCardData[]
  yearlyCards: PricingCardData[]
}

function PricingCard({ 
  tier, 
  price, 
  bestFor, 
  cta, 
  benefits, 
  featured = false, 
  ctaHref, 
  onCtaClick,
  isCurrentPlan = false,
  theme,
}: PricingCardData & { onCtaClick?: () => void; isCurrentPlan?: boolean; theme: TierTheme }) {
  return (
    <motion.div
      initial={{ filter: "blur(2px)", opacity: 0, y: 20 }}
      whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="h-full"
    >
      <div className={`relative h-full w-full overflow-hidden rounded-xl border p-6 ${theme.cardClassName}`}>
        {featured && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-medium text-white rounded-b-md">
              Most Popular
            </div>
          </div>
        )}
        <div className="flex flex-col items-center border-b pb-6 border-slate-700">
          <span className="mb-6 inline-block text-gray-100 font-medium">
            {tier}
          </span>
          <span className="mb-3 inline-block text-4xl font-bold text-gray-100">
            {price}
          </span>
          <span className="bg-gradient-to-br from-gray-300 to-gray-500 bg-clip-text text-center text-transparent">
            {bestFor}
          </span>
        </div>
        <div className="space-y-4 py-9">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-3">
              {benefit.checked ? (
                <span className={`grid size-5 place-content-center rounded-full text-sm text-white ${theme.iconCheckedClassName}`}>
                  <Check className="size-3" />
                </span>
              ) : (
                <span className={`grid size-5 place-content-center rounded-full text-sm text-gray-500 ${theme.iconUncheckedClassName}`}>
                  <X className="size-3" />
                </span>
              )}
              <span className="text-sm text-gray-300">{benefit.text}</span>
            </div>
          ))}
        </div>
        {isCurrentPlan ? (
          <div className="block w-full py-3 px-4 rounded-lg font-medium text-center bg-slate-800/60 text-gray-200 border border-slate-600 cursor-default">
            Current Plan
          </div>
        ) : onCtaClick ? (
          <button type="button" onClick={onCtaClick} className={theme.buttonClassName}>
            {cta}
          </button>
        ) : (
          <Link href={ctaHref} className={theme.buttonClassName}>
            {cta}
          </Link>
        )}
      </div>
    </motion.div>
  )
}

export function PricingClientWrapper({ monthlyCards, yearlyCards }: PricingClientWrapperProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null)
  const [tierIdBySlug, setTierIdBySlug] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    const loadTiers = async () => {
      try {
        const tiers = await subscriptionApi.getTiers()
        if (cancelled) return

        const map: Record<string, string> = {}
        for (const t of tiers) {
          if (t?.name && t?.id) {
            map[String(t.name).toLowerCase()] = String(t.id)
          }
        }
        setTierIdBySlug(map)
      } catch (e) {
        console.error('Failed to load subscription tiers:', e)
      }
    }

    loadTiers()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const cycle = new URLSearchParams(window.location.search).get('cycle')
    if (cycle === 'monthly' || cycle === 'yearly') setBillingCycle(cycle)
  }, [])

  const handleSelectTier = async (planId: string) => {
    // Handle Enterprise tier differently - redirect to contact sales
    if (planId === 'enterprise') {
      router.push('/contact?topic=sales&tier=enterprise')
      return
    }

    if (!user) {
      router.push('/auth/register')
      return
    }

    setIsPurchasing(planId)
    try {
      const slug = String(planId).toLowerCase()
      let tierUuid = tierIdBySlug[slug]
      if (!tierUuid) {
        try {
          const tiers = await subscriptionApi.getTiers()
          const map: Record<string, string> = {}
          for (const t of tiers) {
            if (t?.name && t?.id) {
              map[String(t.name).toLowerCase()] = String(t.id)
            }
          }
          setTierIdBySlug(map)
          tierUuid = map[slug]
        } catch (e) {
          console.error('Failed to refresh tiers for checkout:', e)
        }
      }

      if (!tierUuid) {
        console.error('Unknown tier id for plan:', planId)
        return
      }

      const resp = await subscriptionApi.selectTier(tierUuid, billingCycle)

      if (!resp.requires_payment) {
        router.push('/settings?tab=billing')
        return
      }

      const checkoutResp = await apiClient.post('/payments/checkout/initiate', {
        tier_id: tierUuid,
        billing_cycle: billingCycle,
      })

      const url = checkoutResp.data?.authorization_url
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error selecting tier:', error)
    } finally {
      setIsPurchasing(null)
    }
  }

  const currentCards = billingCycle === 'monthly' ? monthlyCards : yearlyCards

  const currentTierName = String(user?.current_tier_name || '').toLowerCase()

  const getTheme = (planId: string, featured: boolean): TierTheme => {
    const id = String(planId).toLowerCase()

    const baseButton =
      'block w-full py-3 px-4 rounded-lg font-medium text-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950'

    if (featured) {
      return {
        cardClassName:
          'border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20 shadow-xl shadow-purple-500/20',
        iconCheckedClassName: 'bg-purple-600',
        iconUncheckedClassName: 'bg-slate-800',
        buttonClassName:
          `${baseButton} bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30 focus:ring-purple-500/60`,
      }
    }

    if (id === 'pilot_solo') {
      return {
        cardClassName: 'border-slate-700/50 bg-slate-900 hover:border-slate-600/70',
        iconCheckedClassName: 'bg-slate-600',
        iconUncheckedClassName: 'bg-slate-800',
        buttonClassName: `${baseButton} bg-slate-700 text-white hover:bg-slate-600 focus:ring-slate-500/60`,
      }
    }

    if (id === 'pilot_lite') {
      return {
        cardClassName: 'border-blue-500/30 bg-slate-900 hover:border-blue-400/50',
        iconCheckedClassName: 'bg-blue-600',
        iconUncheckedClassName: 'bg-slate-800',
        buttonClassName: `${baseButton} bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 focus:ring-blue-500/60`,
      }
    }

    if (id === 'pilot_core') {
      return {
        cardClassName: 'border-violet-500/30 bg-slate-900 hover:border-violet-400/50',
        iconCheckedClassName: 'bg-violet-600',
        iconUncheckedClassName: 'bg-slate-800',
        buttonClassName: `${baseButton} bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/20 focus:ring-violet-500/60`,
      }
    }

    if (id === 'pilot_pro') {
      return {
        cardClassName: 'border-rose-500/30 bg-slate-900 hover:border-rose-400/50',
        iconCheckedClassName: 'bg-rose-600',
        iconUncheckedClassName: 'bg-slate-800',
        buttonClassName: `${baseButton} bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-500/20 focus:ring-rose-500/60`,
      }
    }

    // enterprise
    return {
      cardClassName: 'border-amber-500/30 bg-slate-900 hover:border-amber-400/50',
      iconCheckedClassName: 'bg-amber-600',
      iconUncheckedClassName: 'bg-slate-800',
      buttonClassName: `${baseButton} bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-500/20 focus:ring-amber-500/60`,
    }
  }

  return (
    <>
      <motion.div
        className="mb-8 flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
      >
        <div className="bg-slate-800 rounded-lg p-1 flex">
          <button
            type="button"
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
            type="button"
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
        <p className="text-xs text-gray-400 text-center">
          * Enterprise pricing is custom - contact sales for details
        </p>
      </motion.div>

      {/* Responsive Grid Layout */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      >
        {currentCards.map((card) => {
          const isProcessing = isPurchasing === card.planId
          const isEnterprise = card.planId === 'enterprise'
          const isCurrentPlan = !!currentTierName && currentTierName === String(card.planId).toLowerCase()
          const ctaText = user
            ? (isProcessing ? 'Processing...' : card.cta)
            : card.cta

          const theme = getTheme(card.planId, card.featured)

          return (
            <div key={card.key} className={card.featured ? 'lg:scale-105 lg:z-10' : ''}>
              <PricingCard
                key={card.key}
                tier={card.tier}
                price={card.price}
                bestFor={card.bestFor}
                cta={ctaText}
                featured={card.featured}
                benefits={card.benefits}
                ctaHref={card.ctaHref}
                planId={card.planId}
                isCurrentPlan={isCurrentPlan}
                theme={theme}
                onCtaClick={isCurrentPlan ? undefined : (isEnterprise || user ? () => handleSelectTier(card.planId) : undefined)}
              />
            </div>
          )
        })}
      </motion.div>
    </>
  )
}