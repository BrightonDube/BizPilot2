'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Logo } from '@/components/common/Logo'
import { 
  Check, 
  ArrowRight,
  Zap,
  Building2,
  Rocket
} from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    icon: Zap,
    price: 'Free',
    period: 'forever',
    description: 'Perfect for getting started with your small business',
    features: [
      'Up to 50 products',
      'Basic inventory tracking',
      'Invoice generation',
      'Single user',
      'Email support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Professional',
    icon: Building2,
    price: 'R299',
    period: '/month',
    description: 'For growing businesses that need more power',
    features: [
      'Unlimited products',
      'Advanced inventory management',
      'Invoice & payment tracking',
      'Up to 5 team members',
      'AI business assistant',
      'Priority support',
      'Custom reports',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    icon: Rocket,
    price: 'Custom',
    period: '',
    description: 'For large businesses with custom requirements',
    features: [
      'Everything in Professional',
      'Unlimited team members',
      'Multi-business support',
      'API access',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
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

      {/* Header */}
      <div className="py-16 text-center">
        <motion.h1 
          className="text-4xl md:text-5xl font-bold text-white mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Simple, Transparent Pricing
        </motion.h1>
        <motion.p 
          className="text-xl text-gray-400 max-w-2xl mx-auto px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Choose the plan that fits your business. Start free and scale as you grow.
        </motion.p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`relative rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-purple-900/50 to-slate-800 border-2 border-purple-500'
                  : 'bg-slate-800/50 border border-slate-700'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  plan.highlighted 
                    ? 'bg-purple-500/20 border border-purple-500/30' 
                    : 'bg-slate-700/50 border border-slate-600'
                }`}>
                  <plan.icon className={`h-5 w-5 ${plan.highlighted ? 'text-purple-400' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              </div>

              <div className="mb-4">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>

              <p className="text-gray-400 mb-6">{plan.description}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className={`h-5 w-5 ${plan.highlighted ? 'text-purple-400' : 'text-green-400'}`} />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/register"
                className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 bg-slate-900/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I change my plan later?',
                a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes, the Professional plan comes with a 14-day free trial. No credit card required.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and EFT payments for South African customers.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Absolutely. You can cancel your subscription at any time with no questions asked.',
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                className="bg-slate-800/50 rounded-lg p-6 border border-slate-700"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                <p className="text-gray-400">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Logo width={24} height={24} />
              <span className="ml-2 font-semibold text-white">BizPilot</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2025 BizPilot. Built with ❤️ for small businesses.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
