import Link from 'next/link'
import { Metadata } from 'next'
import { Logo } from '@/components/common/Logo'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { Check, X } from 'lucide-react'
import { PRICING_PLANS, PricingUtils, type PricingPlan, type BillingCycle } from '@/lib/pricing-config'
import { PricingClientWrapper } from '@/components/pricing/PricingClientWrapper'

export const metadata: Metadata = {
  title: 'Pricing - AI-Powered Business Management Plans',
  description: 'Choose the perfect AI-powered business management plan for your needs. Start free and scale with intelligent automation, predictive analytics, and smart inventory management.',
  keywords: ['BizPilot pricing', 'AI business management plans', 'smart POS pricing', 'intelligent inventory costs', 'business automation pricing'],
}

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
  ctaHref?: string
  planId: string
}

function PricingCard({ tier, price, bestFor, cta, benefits, featured = false, ctaHref, planId }: PricingCardProps) {
  return (
    <div className="h-full">
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
        {ctaHref ? (
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
        ) : (
          <div 
            data-plan-id={planId}
            className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition-all cursor-pointer ${
              featured
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            {cta}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  // Use centralized pricing configuration instead of API calls
  const displayTiers = PRICING_PLANS.slice(0, 3) // Show first 3 plans

  const generatePricingCards = (billingCycle: BillingCycle) => {
    return displayTiers.map((plan) => {
      const isFeatured = plan.recommended || false
      const priceLabel = PricingUtils.formatPriceWithCycle(plan, billingCycle)
      
      // Convert plan features to benefits format
      const benefits = PricingUtils.convertFeaturesToBenefits(plan)

      return {
        key: plan.id,
        tier: plan.displayName,
        price: priceLabel,
        bestFor: plan.description,
        cta: plan.monthlyPrice === 0 ? 'Get Started Free' : 'Get Started',
        featured: isFeatured,
        benefits: benefits,
        ctaHref: '/auth/register',
        planId: plan.id
      }
    })
  }

  return (
    <section className="min-h-screen relative overflow-hidden bg-slate-950 text-gray-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Logo width={32} height={32} />
              <span className="text-xl font-bold text-white">BizPilot</span>
            </Link>
            <div className="flex items-center space-x-8">
              <Link href="/features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="/industries" className="text-gray-300 hover:text-white transition-colors">
                Industries
              </Link>
              <Link href="/pricing" className="text-purple-400 font-medium">
                Pricing
              </Link>
              <Link href="/faq" className="text-gray-300 hover:text-white transition-colors">
                FAQ
              </Link>
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
        <div className="mb-12 space-y-3">
          <h2 className="text-center text-3xl font-semibold leading-tight sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight text-gray-100">
            Choose Your AI-Powered Plan
          </h2>
          <p className="text-center text-base text-gray-400 md:text-lg">
            Start with our free tier and scale as your business grows. 
            Get intelligent automation, predictive analytics, and smart inventory management.
          </p>
        </div>

        {/* Billing cycle toggle and pricing cards wrapped in client component */}
        <PricingClientWrapper 
          monthlyCards={generatePricingCards('monthly')}
          yearlyCards={generatePricingCards('yearly')}
        />

        {/* FAQ Section */}
        <div className="mt-20">
          <h3 className="text-center text-2xl font-semibold text-gray-100 mb-12">
            Frequently Asked Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                question: "Can I change plans anytime?",
                answer: "Yes, you can upgrade or downgrade your AI-powered plan at any time. Changes take effect immediately with full access to new AI features."
              },
              {
                question: "Is there a free trial for AI features?",
                answer: "Yes, all paid plans come with a 14-day free trial including full AI capabilities. No credit card required to start."
              },
              {
                question: "What payment methods do you accept?",
                answer: "We accept all major credit cards, PayPal, and bank transfers for annual plans. All payments are secure and encrypted."
              },
              {
                question: "Do you offer discounts for annual AI-powered billing?",
                answer: "Yes, save 20% when you pay annually for full AI access. Contact us for custom enterprise pricing with advanced AI features."
              }
            ].map((faq, index) => (
              <div 
                key={faq.question}
                className="bg-slate-900 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <h4 className="font-semibold text-gray-100 mb-2">{faq.question}</h4>
                <p className="text-gray-400 text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <MarketingFooter />
    </section>
  )
}