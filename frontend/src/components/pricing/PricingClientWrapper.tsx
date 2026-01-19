'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import Link from 'next/link'
import { subscriptionApi } from '@/lib/subscription-api'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

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
  planId,
  onCtaClick 
}: PricingCardData & { onCtaClick?: () => void }) {
  return (
    <motion.div
      initial={{ filter: "blur(2px)", opacity: 0, y: 20 }}
      whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="h-full"
    >
      <div
        className={`relative h-full w-full overflow-hidden rounded-xl border p-6 ${
          featured 
            ? "border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20 shadow-xl shadow-purple-500/20" 
            : "border-slate-700/50 bg-slate-900"
        }`}
      >
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
                <span className="grid size-5 place-content-center rounded-full bg-purple-600 text-sm text-white">
                  <Check className="size-3" />
                </span>
              ) : (
                <span className="grid size-5 place-content-center rounded-full bg-slate-800 text-sm text-gray-500">
                  <X className="size-3" />
                </span>
              )}
              <span className="text-sm text-gray-300">{benefit.text}</span>
            </div>
          ))}
        </div>
        {onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition-all ${
              featured
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            {cta}
          </button>
        ) : (
          <Link
            href={ctaHref}
            className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition-all ${
              featured
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
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

  useEffect(() => {
    const cycle = new URLSearchParams(window.location.search).get('cycle')
    if (cycle === 'monthly' || cycle === 'yearly') setBillingCycle(cycle)
  }, [])

  const handleSelectTier = async (planId: string) => {
    // Handle Enterprise tier differently - redirect to contact sales
    if (planId === 'enterprise') {
      // For Enterprise tier, redirect to contact sales
      window.location.href = 'mailto:sales@bizpilot.co.za?subject=Enterprise%20Plan%20Inquiry&body=Hi,%0A%0AI%27m%20interested%20in%20learning%20more%20about%20the%20Enterprise%20plan.%20Please%20contact%20me%20to%20discuss%20custom%20pricing%20and%20features.%0A%0AThank%20you!';
      return;
    }

    if (!user) {
      router.push('/auth/register')
      return
    }

    setIsPurchasing(planId)
    try {
      const resp = await subscriptionApi.selectTier(planId, billingCycle)

      if (!resp.requires_payment) {
        router.push('/settings?tab=billing')
        return
      }

      const checkoutResp = await apiClient.post('/payments/checkout/initiate', {
        tier_id: planId,
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

  return (
    <>
      <motion.div
        className="mb-8 flex justify-center"
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
        <p className="text-xs text-gray-400 mt-2 text-center">
          * Enterprise pricing is custom - contact sales for details
        </p>
      </motion.div>

      <motion.div 
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      >
        {currentCards.map((card) => {
          const isProcessing = isPurchasing === card.planId
          const isEnterprise = card.planId === 'enterprise'
          const ctaText = user
            ? (isProcessing ? 'Processing...' : card.cta)
            : card.cta

          return (
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
              onCtaClick={isEnterprise || user ? () => handleSelectTier(card.planId) : undefined}
            />
          )
        })}
      </motion.div>
    </>
  )
}