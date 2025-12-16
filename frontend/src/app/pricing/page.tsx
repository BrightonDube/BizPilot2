'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Logo } from '@/components/common/Logo'
import { Check, X } from 'lucide-react'

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
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          <PricingCard
            tier="Starter"
            price="Free"
            bestFor="Perfect for getting started"
            cta="Get Started Free"
            benefits={[
              { text: "Up to 5 products", checked: true },
              { text: "Basic inventory tracking", checked: true },
              { text: "Cost calculations", checked: true },
              { text: "Email support", checked: true },
              { text: "Advanced analytics", checked: false },
              { text: "AI business insights", checked: false },
              { text: "Custom categories", checked: false },
              { text: "Priority support", checked: false }
            ]}
          />
          <PricingCard
            tier="Professional"
            price="$29/mo"
            bestFor="Best for growing businesses"
            cta="Start Free Trial"
            featured={true}
            benefits={[
              { text: "Unlimited products", checked: true },
              { text: "Advanced inventory management", checked: true },
              { text: "Smart pricing calculator", checked: true },
              { text: "Email support", checked: true },
              { text: "Advanced analytics", checked: true },
              { text: "AI business insights", checked: true },
              { text: "Custom categories & suppliers", checked: true },
              { text: "Priority support", checked: false }
            ]}
          />
          <PricingCard
            tier="Enterprise"
            price="$99/mo"
            bestFor="For established businesses"
            cta="Contact Sales"
            benefits={[
              { text: "Everything in Professional", checked: true },
              { text: "Multi-location support", checked: true },
              { text: "Team collaboration", checked: true },
              { text: "API access", checked: true },
              { text: "Custom integrations", checked: true },
              { text: "Advanced reporting", checked: true },
              { text: "Custom categories & suppliers", checked: true },
              { text: "Priority support", checked: true }
            ]}
          />
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
      <footer className="bg-slate-900 border-t border-slate-800 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Logo width={24} height={24} />
              <span className="ml-2 font-semibold text-white">BizPilot</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2025 BizPilot. Built with ❤️ for businesses everywhere.
            </p>
          </div>
        </div>
      </footer>
    </motion.section>
  )
}
