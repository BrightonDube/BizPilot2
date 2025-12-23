'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Logo } from '@/components/common/Logo'
import { HeroSection } from '@/components/home/HeroSection'
import { ShaderBackground } from '@/components/ui'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { useGuestOnly } from '@/hooks/useAuth'
import { 
  BarChart3, 
  Package, 
  Warehouse, 
  MessageSquare, 
  QrCode, 
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Menu,
  X,
  Receipt,
  DollarSign
} from 'lucide-react'

const features = [
  {
    icon: DollarSign,
    title: 'Smart Cost Calculations',
    description: 'Calculate product costs with precision, including ingredients, labor, and overhead.'
  },
  {
    icon: BarChart3,
    title: 'Intelligent Pricing',
    description: 'Get AI-powered pricing recommendations based on costs, market data, and profit margins.'
  },
  {
    icon: Warehouse,
    title: 'Inventory Management',
    description: 'Track stock levels, set reorder points, and never run out of essential supplies.'
  },
  {
    icon: Receipt,
    title: 'Invoice Generation',
    description: 'Create professional invoices instantly and track payments with ease.'
  },
  {
    icon: Package,
    title: 'Product Analytics',
    description: 'Understand which products are most profitable and optimize your offerings.'
  },
  {
    icon: MessageSquare,
    title: 'AI Business Assistant',
    description: 'Chat with our AI to get instant insights and recommendations for your business.'
  },
]

const benefits = [
  'Track real-time profitability',
  'Make data-driven pricing decisions',
  'Reduce waste and overhead costs',
  'Scale your business with confidence'
]

export default function HomePage() {
  useGuestOnly('/dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* WebGL Shader Background - placed at root for persistent animation */}
      <ShaderBackground />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Logo width={32} height={32} />
              <span className="text-xl font-bold text-white">BizPilot</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link 
                href="/auth/register" 
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden overflow-hidden"
              >
                <div className="py-4 space-y-2">
                  <Link 
                    href="/auth/login" 
                    className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/pricing" 
                    className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  <Link 
                    href="/auth/register" 
                    className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <div className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything you need to run and grow your business
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Track costs, price with confidence, control inventory, and get AI guidance so every decision improves profit.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index} 
                className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg flex items-center justify-center mb-4 border border-purple-500/30">
                  <motion.div
                    whileHover={{ rotate: 5, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <feature.icon className="h-6 w-6 text-purple-400" />
                  </motion.div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Stop guessing. Start growing with clear, profitable decisions.
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                Make confident moves with live cost tracking, AI-powered pricing, and clear inventory signals that keep you in stock and in profit.
              </p>
              
              <div className="space-y-4">
                {[
                  'Know your true margins across products and channels.',
                  'Price with confidence using AI and live cost data.',
                  'Prevent stockouts and waste with smart inventory alerts.',
                  'Get paid faster with invoices and payment tracking.',
                ].map((benefit, index) => (
                  <motion.div 
                    key={index} 
                    className="flex items-center"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    </motion.div>
                    <span className="text-gray-200">{benefit}</span>
                  </motion.div>
                ))}
              </div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Link 
                  href="/auth/register" 
                  className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all group"
                >
                  Get Started Now
                  <motion.div
                    className="ml-2"
                    whileHover={{ x: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.div>
                </Link>
              </motion.div>
            </div>
            
            <motion.div 
              className="relative"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-600">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Profit Analysis</h3>
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </motion.div>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Product Cost:', value: '$XX.XX' },
                    { label: 'Selling Price:', value: '$XX.XX' },
                    { label: 'Profit Margin:', value: 'XX%', highlight: true }
                  ].map((item, index) => (
                    <motion.div 
                      key={item.label}
                      className={`flex justify-between ${item.highlight ? 'border-t border-slate-600 pt-2' : ''}`}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <span className="text-gray-400">{item.label}</span>
                      <motion.span 
                        className={`font-semibold ${item.highlight ? 'text-green-400' : 'text-white'}`}
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        {item.value}
                      </motion.span>
                    </motion.div>
                  ))}
                  
                  <motion.div 
                    className="bg-gradient-to-r from-green-900/20 to-green-800/20 rounded-lg p-3 mt-4 border border-green-700/30"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  >
                    <p className="text-sm text-green-300">
                      💡 AI insights help optimize your pricing strategy based on real market data
                    </p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to turn every product into profit?
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join teams using BizPilot to turn their costs, prices, and inventory into an advantage.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link 
              href="/auth/register" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 group"
            >
              Start Your Free Trial
              <motion.div
                className="ml-2"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <ArrowRight className="h-5 w-5" />
              </motion.div>
            </Link>
          </motion.div>
          <motion.p 
            className="text-gray-500 mt-4 text-sm"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            No credit card required • 14-day free trial • Cancel anytime
          </motion.p>
        </div>
      </div>

      {/* Footer */}
      <MarketingFooter />
    </div>
  )
}
