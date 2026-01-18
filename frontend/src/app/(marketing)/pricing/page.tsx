import Link from 'next/link'
import { Metadata } from 'next'
import { Check, X } from 'lucide-react'
import { PRICING_PLANS, PricingUtils, type PricingPlan, type BillingCycle } from '@/lib/pricing-config'
import { PricingClientWrapper } from '@/components/pricing/PricingClientWrapper'

export const metadata: Metadata = {
  title: 'AI-Powered Pricing Plans - Smart Business Management Solutions',
  description: 'Choose the perfect AI-powered business management plan for your needs. Start free and scale with intelligent automation, predictive analytics, smart inventory management, and AI-driven insights that grow with your business.',
  keywords: ['BizPilot AI pricing', 'AI business management plans', 'smart POS pricing', 'intelligent inventory costs', 'business automation pricing', 'predictive analytics pricing', 'AI-powered business tools'],
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
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-20 md:px-8">
        <div className="mb-12 space-y-3">
          <h2 className="text-center text-3xl font-semibold leading-tight sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight text-gray-100">
            AI-Powered Plans That Scale With Your Business
          </h2>
          <p className="text-center text-base text-gray-400 md:text-lg">
            Start with intelligent automation and grow with advanced AI capabilities. 
            Get predictive analytics, smart inventory management, and AI-driven insights that put you in control.
          </p>
          <div className="flex justify-center mt-6">
            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4 max-w-2xl">
              <p className="text-center text-sm text-purple-200">
                ✨ <strong>AI-Powered Features:</strong> Predictive inventory tracking, intelligent pricing optimization, 
                automated reordering suggestions, and smart customer insights across all plans
              </p>
            </div>
          </div>
        </div>

        {/* Billing cycle toggle and pricing cards wrapped in client component */}
        <PricingClientWrapper 
          monthlyCards={generatePricingCards('monthly')}
          yearlyCards={generatePricingCards('yearly')}
        />

        {/* AI Benefits Section */}
        <div className="mt-20 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-8">
          <h3 className="text-center text-2xl font-semibold text-gray-100 mb-8">
            Why Choose AI-Powered Business Management?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🤖</div>
              <h4 className="font-semibold text-purple-200 mb-2">Intelligent Automation</h4>
              <p className="text-gray-300 text-sm">Reduce manual work by 80% with AI that learns your business patterns</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📊</div>
              <h4 className="font-semibold text-blue-200 mb-2">Predictive Analytics</h4>
              <p className="text-gray-300 text-sm">Forecast demand 2-4 weeks ahead with 90%+ accuracy</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">💰</div>
              <h4 className="font-semibold text-green-200 mb-2">Smart Optimization</h4>
              <p className="text-gray-300 text-sm">Increase profit margins by 15-25% with intelligent pricing</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🎛️</div>
              <h4 className="font-semibold text-orange-200 mb-2">You Stay in Control</h4>
              <p className="text-gray-300 text-sm">Override any AI decision and customize automation to your style</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h3 className="text-center text-2xl font-semibold text-gray-100 mb-12">
            AI-Powered Pricing Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                question: "What AI features are included in each plan?",
                answer: "All plans include AI-powered inventory tracking and smart analytics. Professional adds predictive insights, automated reordering, and intelligent pricing. Enterprise includes custom AI models and advanced predictive analytics."
              },
              {
                question: "Can I control how the AI works in my business?",
                answer: "Absolutely! You have complete control over AI behavior. Set custom thresholds, override recommendations, choose automation levels, and customize AI settings to match your business style."
              },
              {
                question: "Is there a free trial for AI-powered features?",
                answer: "Yes! Our Starter plan includes basic AI features at no cost. Paid plans come with a 14-day free trial including full AI capabilities. Experience intelligent automation before you commit."
              },
              {
                question: "How accurate are the AI predictions and insights?",
                answer: "Our AI typically achieves 85-95% accuracy for inventory forecasting and 80-90% for demand prediction. Accuracy improves as the system learns your business patterns, and you can always override predictions with your expertise."
              },
              {
                question: "Do you offer discounts for annual AI-powered billing?",
                answer: "Yes, save 20% when you pay annually for full AI access. Contact us for custom enterprise pricing with advanced AI features and dedicated support."
              },
              {
                question: "How does the AI protect my business data?",
                answer: "Your data privacy is our priority. All AI processing happens with your consent, data is encrypted, and we never share your information. You maintain complete ownership and can export or delete data anytime."
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
    </section>
  )
}