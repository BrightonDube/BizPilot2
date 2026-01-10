'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Logo } from '@/components/common/Logo'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { Check, X } from 'lucide-react'
import { subscriptionApi, type SubscriptionTier } from '@/lib/subscription-api'

interface Benefit {
  text: string
  checked: boolean
}

interface PricingCardProps {
  tier: string
  price: string
  bestFor: string
  cta: string
  benefits: Benefit[]
  featured?: boolean
}

function PricingCard({ tier, price, bestFor, cta, benefits, featured = false }: PricingCardProps) {
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
        <Link
          href="/auth/register"
          className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition-all ${
            featured
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30'
              : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
        >
          {cta}
        </Link>
      </div>
    </motion.div>
  )
}

export default function PricingPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    subscriptionApi
      .getTiers()
      .then((data) => {
        const sorted = [...data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setTiers(sorted)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatCents = (cents: number, currency: string) => {
    if (!cents) return 'Free'
    if (currency === 'ZAR') {
      return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`
    }
    return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
  }

  const displayTiers = useMemo(() => {
    // Pricing page expects 3 plans; fall back gracefully if fewer.
    return tiers.slice(0, 3)
  }, [tiers])

  return (
    <motion.section 
      className="min-h-screen relative overflow-hidden bg-slate-950 text-gray-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Logo width={32} height={32} />
              <span className="text-xl font-bold text-white">BizPilot</span>
            </Link>
            <div className="flex items-center space-x-8">
              <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link 
                href="/auth/register" 
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-20 md:px-8">
        <motion.div 
          className="mb-12 space-y-3"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <motion.h2 
            className="text-center text-3xl font-semibold leading-tight sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight text-gray-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            Choose Your Plan
          </motion.h2>
          <motion.p 
            className="text-center text-base text-gray-400 md:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          >
            Start with our free tier and scale as your business grows. 
            Get the tools you need to manage costs, inventory, and pricing.
          </motion.p>
        </motion.div>

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
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          {loading ? (
            <div className="md:col-span-3 text-center text-gray-400">Loading plans...</div>
          ) : (
            displayTiers.map((tier) => {
              const isFeatured = tier.name === 'professional'
              const cents = billingCycle === 'monthly' ? tier.price_monthly_cents : tier.price_yearly_cents
              const priceLabel = cents === 0 ? 'Free' : `${formatCents(cents, tier.currency)}/${billingCycle === 'monthly' ? 'mo' : 'yr'}`

              // If tier has feature flags, show a small list; otherwise show an empty list.
              const benefits = Object.entries(tier.feature_flags || {})
                .slice(0, 8)
                .map(([key, enabled]) => ({
                  text: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
                  checked: Boolean(enabled),
                }))

              return (
                <PricingCard
                  key={tier.id}
                  tier={tier.display_name}
                  price={priceLabel}
                  bestFor={tier.description || ''}
                  cta={tier.price_monthly_cents === 0 ? 'Get Started Free' : 'Get Started'}
                  featured={isFeatured}
                  benefits={benefits}
                />
              )
            })
          )}
        </motion.div>

        {/* FAQ Section */}
        <motion.div 
          className="mt-20"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
        >
          <motion.h3 
            className="text-center text-2xl font-semibold text-gray-100 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9, ease: "easeOut" }}
          >
            Frequently Asked Questions
          </motion.h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                question: "Can I change plans anytime?",
                answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately."
              },
              {
                question: "Is there a free trial?",
                answer: "Yes, all paid plans come with a 14-day free trial. No credit card required."
              },
              {
                question: "What payment methods do you accept?",
                answer: "We accept all major credit cards, PayPal, and bank transfers for annual plans."
              },
              {
                question: "Do you offer discounts for annual billing?",
                answer: "Yes, save 20% when you pay annually. Contact us for custom enterprise pricing."
              }
            ].map((faq, index) => (
              <motion.div 
                key={faq.question}
                className="bg-slate-900 rounded-lg p-6 border border-slate-700"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.1, 
                  ease: "easeOut" 
                }}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <h4 className="font-semibold text-gray-100 mb-2">{faq.question}</h4>
                <p className="text-gray-400 text-sm">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <MarketingFooter />
    </motion.section>
  )
}
