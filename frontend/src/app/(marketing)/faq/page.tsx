'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Logo } from '@/components/common/Logo'
import { ShaderBackground } from '@/components/ui'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { useGuestOnly } from '@/hooks/useAuth'
import { 
  ChevronDown,
  Menu,
  X,
  ArrowRight
} from 'lucide-react'
import { useState } from 'react'

const faqCategories = [
  {
    title: 'Getting Started',
    faqs: [
      {
        question: 'How quickly can I get started with BizPilot?',
        answer: 'You can be up and running in under 10 minutes. Simply sign up for your free trial, complete the quick setup wizard, and start processing transactions immediately. Our onboarding team provides personalized support to ensure smooth implementation.'
      },
      {
        question: 'Do I need any special hardware?',
        answer: 'BizPilot works on any device with a web browser - computers, tablets, or smartphones. For optimal POS experience, we recommend tablets with barcode scanners and receipt printers, but you can start with just your existing devices.'
      },
      {
        question: 'Can I import my existing data?',
        answer: 'Yes! We provide free data migration services for products, customers, and inventory from most POS systems. Our team handles the entire process, ensuring zero downtime during the transition.'
      },
      {
        question: 'Is training provided?',
        answer: 'Absolutely. We offer comprehensive training including video tutorials, live webinars, and one-on-one sessions. Your team will be fully trained before going live, with ongoing support available 24/7.'
      }
    ]
  },
  {
    title: 'Features & Functionality',
    faqs: [
      {
        question: 'Does BizPilot work offline?',
        answer: 'Yes, our mobile POS app works completely offline. All transactions are stored locally and automatically sync when internet connection is restored. You never have to worry about losing sales due to connectivity issues.'
      },
      {
        question: 'Can I manage multiple locations?',
        answer: 'Absolutely. BizPilot is designed for multi-location businesses. Get real-time visibility across all locations, manage inventory transfers, compare performance, and maintain brand consistency from a single dashboard.'
      },
      {
        question: 'What payment methods are supported?',
        answer: 'We support all major payment methods including credit/debit cards, mobile payments (Apple Pay, Google Pay), EFT, cash, and split payments. Integration with local payment providers like Yoco, SnapScan, and Netcash is included.'
      },
      {
        question: 'Does it integrate with my accounting software?',
        answer: 'Yes, we have direct integrations with Xero, Sage, and other popular accounting systems. All sales, payments, and inventory transactions automatically sync, eliminating double data entry and ensuring accurate financial records.'
      }
    ]
  },
  {
    title: 'Pricing & Plans',
    faqs: [
      {
        question: 'Is there a free trial?',
        answer: 'Yes, we offer a 14-day free trial with full access to all features. No credit card required to start. You can test everything including POS, inventory management, reporting, and integrations.'
      },
      {
        question: 'Can I change plans anytime?',
        answer: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately, and you only pay for what you use. No long-term contracts or cancellation fees.'
      },
      {
        question: 'Are there any setup or hidden fees?',
        answer: 'No hidden fees ever. Our pricing is transparent with no setup costs, no transaction fees, and no additional charges for updates or support. What you see is what you pay.'
      },
      {
        question: 'Do you offer discounts for annual billing?',
        answer: 'Yes, save 20% when you pay annually. We also offer custom enterprise pricing for large organizations and franchise groups. Contact our sales team for volume discounts.'
      }
    ]
  },
  {
    title: 'Support & Security',
    faqs: [
      {
        question: 'What kind of support do you provide?',
        answer: '24/7 support via chat, email, and phone. Our support team consists of POS experts who understand your business needs. We also provide free onboarding, training, and data migration services.'
      },
      {
        question: 'Is my data secure?',
        answer: 'Absolutely. We use bank-level encryption, secure cloud hosting, and comply with all data protection regulations. Your data is backed up multiple times daily and stored in secure, geographically distributed data centers.'
      },
      {
        question: 'What happens if I want to cancel?',
        answer: 'You can cancel anytime with no penalties. We provide full data export in standard formats, ensuring you retain complete ownership of your business data. Our team assists with smooth transitions if needed.'
      },
      {
        question: 'Do you provide regular updates?',
        answer: 'Yes, we continuously improve BizPilot with regular updates and new features. All updates are automatic and included in your subscription at no additional cost. You always have access to the latest features.'
      }
    ]
  },
  {
    title: 'Industry Specific',
    faqs: [
      {
        question: 'Is BizPilot suitable for restaurants?',
        answer: 'Absolutely! We have specialized features for restaurants including table management, kitchen display systems, menu engineering, recipe costing, and integration with delivery platforms. Perfect for cafes, restaurants, and food service businesses.'
      },
      {
        question: 'Can retail stores use BizPilot?',
        answer: 'Yes, BizPilot is perfect for retail with features like barcode scanning, layby management, e-commerce integration, multi-location inventory, and customer loyalty programs. Ideal for fashion, electronics, and specialty retail.'
      },
      {
        question: 'What about service-based businesses?',
        answer: 'BizPilot works great for service businesses with appointment scheduling, service tracking, customer management, and invoicing. Perfect for salons, repair shops, consulting firms, and professional services.'
      },
      {
        question: 'Do you support franchise operations?',
        answer: 'Yes, we specialize in franchise management with centralized control, location performance comparison, brand consistency tools, and consolidated reporting. Many franchise groups trust BizPilot for their operations.'
      }
    ]
  }
]

export default function FAQPage() {
  useGuestOnly('/dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (id: string) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen">
      <ShaderBackground />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Logo width={32} height={32} />
              <span className="text-xl font-bold text-white">BizPilot</span>
            </Link>

            <div className="hidden md:flex items-center space-x-8">
              <Link href="/features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="/industries" className="text-gray-300 hover:text-white transition-colors">
                Industries
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/faq" className="text-purple-400 font-medium">
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

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1 
            className="text-4xl md:text-6xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Frequently Asked Questions
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Find answers to common questions about BizPilot's features, pricing, and implementation. Can't find what you're looking for? Contact our support team.
          </motion.p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {faqCategories.map((category, categoryIndex) => (
              <motion.div 
                key={categoryIndex}
                className="relative"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
              >
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
                  {category.title}
                </h2>

                <div className="space-y-4">
                  {category.faqs.map((faq, faqIndex) => {
                    const itemId = `${categoryIndex}-${faqIndex}`
                    const isOpen = openItems.includes(itemId)
                    
                    return (
                      <motion.div 
                        key={faqIndex}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: faqIndex * 0.05 }}
                      >
                        <button
                          onClick={() => toggleItem(itemId)}
                          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                        >
                          <h3 className="text-lg font-semibold text-white pr-4">
                            {faq.question}
                          </h3>
                          <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-5 w-5 text-purple-400 flex-shrink-0" />
                          </motion.div>
                        </button>
                        
                        <motion.div
                          initial={false}
                          animate={{ 
                            height: isOpen ? 'auto' : 0,
                            opacity: isOpen ? 1 : 0
                          }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-4">
                            <p className="text-gray-300 leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        </motion.div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Still Have Questions?
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Our support team is here to help. Get personalized answers and see BizPilot in action with a free demo.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/auth/register" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 group"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <a 
                href="mailto:support@bizpilot.com" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-purple-500/50 hover:bg-slate-800/50 transition-all"
              >
                Contact Support
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}