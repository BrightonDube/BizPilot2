'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { HeroSection } from '@/components/home/HeroSection'
import { MarketingLayoutClient } from '@/components/layout/MarketingLayoutClient'
import { 
  BarChart3, 
  Package, 
  Warehouse, 
  MessageSquare, 
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Receipt,
  DollarSign,
  Users,
  ShoppingCart,
  Globe,
  Star,
  Building2,
  Coffee,
  Hotel,
  Store
} from 'lucide-react'

const features = [
  {
    icon: Receipt,
    title: 'AI-Enhanced POS System',
    description: 'Lightning-fast transaction processing with intelligent sales insights, predictive customer preferences, automated upselling suggestions, and smart payment processing across mobile POS, table management, and kitchen display systems.'
  },
  {
    icon: Warehouse,
    title: 'Smart Inventory Intelligence',
    description: 'AI-powered inventory management that predicts demand, automates reordering, prevents stockouts, and optimizes stock levels across multiple locations. Get intelligent alerts and recommendations based on your business patterns.'
  },
  {
    icon: BarChart3,
    title: 'Predictive Analytics & AI Insights',
    description: 'Advanced AI-driven reporting that identifies trends, predicts future performance, and provides actionable business intelligence. Get smart recommendations for pricing, staffing, and inventory optimization.'
  },
  {
    icon: DollarSign,
    title: 'Intelligent Financial Management',
    description: 'AI-enhanced financial tracking with automated categorization, smart expense detection, predictive cash flow analysis, and seamless integration with Xero and Sage for intelligent bookkeeping.'
  },
  {
    icon: Package,
    title: 'Smart Recipe & Menu Engineering',
    description: 'AI-powered recipe costing and menu optimization that analyzes profitability, suggests pricing improvements, tracks ingredient costs, and recommends menu changes based on sales data and market trends.'
  },
  {
    icon: MessageSquare,
    title: 'AI-Driven Customer Intelligence',
    description: 'Intelligent CRM that automatically segments customers, predicts buying behavior, personalizes marketing campaigns, and identifies high-value customers with AI-powered loyalty program optimization.'
  },
  {
    icon: Users,
    title: 'Smart Staff Management',
    description: 'AI-optimized scheduling based on predicted demand, intelligent performance tracking, automated time management, and smart workforce planning that adapts to your business patterns and peak times.'
  },
  {
    icon: Globe,
    title: 'Intelligent E-commerce Integration',
    description: 'AI-powered online ordering with smart product recommendations, dynamic pricing optimization, predictive inventory sync, and intelligent customer journey optimization across all channels.'
  },
  {
    icon: Building2,
    title: 'AI-Powered Multi-Location Management',
    description: 'Centralized intelligence across all locations with predictive performance analysis, automated inter-location transfers, smart franchise management, and AI-driven operational optimization.'
  }
]

const benefits = [
  'AI-enhanced POS system with intelligent sales insights and predictive analytics',
  'Smart inventory management with automated reordering and demand forecasting',
  'Intelligent financial integration with Xero, Sage, and automated categorization',
  'AI-powered reporting with predictive insights and optimization recommendations',
  'Smart customer loyalty programs with AI-driven personalization and segmentation',
  'Intelligent staff management with AI-optimized scheduling and performance tracking',
  'AI-enhanced e-commerce integration with smart recommendations and dynamic pricing',
  'Predictive multi-location management with automated optimization and insights',
  'Smart recipe management with AI-powered costing and menu optimization',
  'Intelligent automation that learns your business patterns while you stay in control'
]

const industries = [
  {
    icon: Building2,
    title: 'Restaurants & Cafes',
    description: 'Complete restaurant management from table service to kitchen operations with specialized hospitality features.',
    features: ['Table Management & Floor Plans', 'Menu Engineering & Recipe Costing', 'Kitchen Display System', 'Order Management (Dine-in, Takeaway, Delivery)', 'Staff Scheduling & Performance', 'Ingredient Inventory Tracking', 'PMS Integration for Hotels']
  },
  {
    icon: ShoppingCart,
    title: 'Retail Stores',
    description: 'Comprehensive retail management for single and multi-location stores with advanced inventory control.',
    features: ['Multi-Location Stock Control', 'Barcode Scanning & SKU Management', 'Layby & Payment Plans', 'E-commerce Integration', 'Customer Loyalty Programs', 'Supplier Management', 'Automated Reordering']
  },
  {
    icon: Users,
    title: 'Multi-Location Chains',
    description: 'Centralized management for franchise and chain operations with enterprise-grade features.',
    features: ['Central Dashboard & Reporting', 'Location Performance Comparison', 'Consolidated Financial Reports', 'Inter-Location Transfers', 'Franchise Management', 'Brand Consistency Controls', 'Digital Signage Management']
  },
  {
    icon: Coffee,
    title: 'Coffee Shops & Bakeries',
    description: 'Specialized features for coffee shops and bakery operations with fresh product management.',
    features: ['Recipe Management & Costing', 'Fresh Product Tracking', 'Loyalty Card Integration', 'Mobile Ordering & Pickup', 'Waste Tracking & Reporting', 'Supplier Integration']
  },
  {
    icon: Hotel,
    title: 'Hotels & Hospitality',
    description: 'Integrated POS and property management for hospitality businesses with guest management.',
    features: ['PMS Integration', 'Room Service Management', 'Guest Profile Management', 'Event & Banquet Management', 'Multi-Outlet Reporting', 'Guest Billing Integration']
  },
  {
    icon: Store,
    title: 'Specialty Retail',
    description: 'Tailored solutions for specialty retail businesses with complex product management needs.',
    features: ['Product Variant Management', 'Seasonal Inventory Planning', 'Customer Special Orders', 'Consignment Management', 'Repair & Service Tracking', 'Vendor Management']
  }
]

const testimonials = [
  {
    name: 'Sarah Mitchell',
    role: 'Restaurant Owner',
    company: 'The Garden Bistro',
    content: 'BizPilot transformed our operations. We now know our exact food costs and can price confidently. Our profit margins improved by 15% in just 3 months.',
    rating: 5
  },
  {
    name: 'David Chen',
    role: 'Retail Manager',
    company: 'Urban Fashion Co.',
    content: 'The multi-location inventory management is incredible. We never run out of stock and our waste has dropped significantly. The ROI was immediate.',
    rating: 5
  },
  {
    name: 'Maria Rodriguez',
    role: 'Operations Director',
    company: 'Coffee Culture Chain',
    content: 'Managing 12 locations was a nightmare before BizPilot. Now we have real-time visibility across all stores and our staff productivity has increased by 25%.',
    rating: 5
  }
]

export default function HomePage() {
  return (
    <MarketingLayoutClient>
      {/* Hero Section */}
      <HeroSection />

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <div className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              AI-Powered Business Management That Puts You in Control
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-6">
              Experience intelligent automation that learns your business patterns while keeping you in complete control. From predictive analytics to smart decision-making, our AI enhances every aspect of your operations.
            </p>
            
            {/* AI Emphasis Callout */}
            <motion.div 
              className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/30 max-w-4xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center justify-center mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-lg">🤖</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Smart Automation, Human Control</h3>
              </div>
              <p className="text-gray-300 text-sm">
                Our AI handles routine tasks and provides intelligent insights, while you maintain complete control over all business decisions. 
                Customize AI behavior, override recommendations, and ensure your business runs exactly how you want it.
              </p>
            </motion.div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index} 
                className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20 group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg flex items-center justify-center mb-4 border border-purple-500/30 group-hover:border-purple-400/50 transition-colors">
                  <motion.div
                    whileHover={{ rotate: 5, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <feature.icon className="h-6 w-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
                  </motion.div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-200 transition-colors">{feature.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">{feature.description}</p>
                
                {/* AI Enhancement Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-blue-400 rounded-full flex items-center justify-center mr-2">
                      <span className="text-white text-xs">✨</span>
                    </div>
                    <span className="text-xs text-green-400 font-medium">AI-Enhanced</span>
                  </div>
                  <div className="text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn More →
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Call-to-Action for Features Page */}
          <motion.div 
            className="text-center mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/features" 
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/50 text-white hover:border-purple-400/70 hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-blue-600/30 transition-all group"
              >
                <span className="text-lg font-medium">Explore All AI-Powered Features</span>
                <motion.div
                  className="ml-2"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <ArrowRight className="h-5 w-5 group-hover:text-purple-300 transition-colors" />
                </motion.div>
              </Link>
            </motion.div>
            <p className="text-sm text-gray-400 mt-3">
              Discover how AI automation can transform your business operations while keeping you in complete control
            </p>
          </motion.div>
        </div>
      </div>

      {/* Industries Section */}
      <div className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for Every Industry
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Whether you&apos;re running a restaurant, retail store, or multi-location chain, BizPilot adapts to your specific needs.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {industries.map((industry, index) => (
              <motion.div 
                key={index} 
                className="p-8 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl flex items-center justify-center mb-6 border border-purple-500/30">
                  <motion.div
                    whileHover={{ rotate: 5, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <industry.icon className="h-8 w-8 text-purple-400" />
                  </motion.div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{industry.title}</h3>
                <p className="text-gray-300 mb-6 text-sm leading-relaxed">{industry.description}</p>
                
                <div className="space-y-2">
                  {industry.features.slice(0, 4).map((feature, featureIndex) => (
                    <motion.div 
                      key={featureIndex} 
                      className="flex items-center"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: (index * 0.1) + (featureIndex * 0.05) }}
                    >
                      <CheckCircle className="h-4 w-4 text-green-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </motion.div>
                  ))}
                  {industry.features.length > 4 && (
                    <div className="text-xs text-purple-400 mt-2">
                      +{industry.features.length - 4} more features
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by Businesses Worldwide
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              See how BizPilot is helping businesses increase profits, reduce costs, and scale efficiently.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div 
                key={index} 
                className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-purple-500/30 transition-all"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <p className="text-gray-300 mb-6 italic">&quot;{testimonial.content}&quot;</p>
                
                <div className="border-t border-slate-700 pt-4">
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-gray-400">{testimonial.role}</p>
                  <p className="text-sm text-purple-400">{testimonial.company}</p>
                </div>
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
                AI-Powered Business Intelligence That Grows With You
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                From your first sale to multi-location expansion, BizPilot&apos;s AI learns your unique business patterns and provides intelligent automation that adapts to your needs. Experience smart decision-making support that enhances your expertise while keeping you in complete control.
              </p>
              
              {/* AI Control Emphasis */}
              <motion.div 
                className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30 mb-6"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center mb-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-sm">🎛️</span>
                  </div>
                  <h4 className="text-white font-semibold">You&apos;re Always in Control</h4>
                </div>
                <p className="text-gray-300 text-sm">
                  Our AI provides intelligent recommendations and insights - you make the final decisions. 
                  Customize AI behavior, set your own rules, and override any suggestion at any time.
                </p>
              </motion.div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <motion.div 
                    key={index} 
                    className="flex items-start"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    </motion.div>
                    <span className="text-gray-200 text-sm leading-relaxed">{benefit}</span>
                  </motion.div>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Link 
                    href="/auth/register" 
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all group"
                  >
                    Start Your AI-Powered Trial
                    <motion.div
                      className="ml-2"
                      whileHover={{ x: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  </Link>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Link 
                    href="/features" 
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-600 text-white hover:border-purple-500/50 hover:bg-slate-800/50 transition-all"
                  >
                    Explore AI Features
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
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
                  <h3 className="text-lg font-semibold text-white">AI Profit Analysis</h3>
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
            Ready to Experience AI-Powered Business Management?
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join thousands of businesses using BizPilot&apos;s intelligent automation to predict trends, optimize operations, and make smarter decisions. 
            Experience the power of AI that works for you - not against you - with complete control and transparency.
          </motion.p>
          
          {/* AI Benefits Highlight */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
              <div className="text-2xl mb-2">🤖</div>
              <h4 className="text-white font-semibold text-sm mb-1">Smart Automation</h4>
              <p className="text-gray-300 text-xs">AI handles routine tasks while you focus on growth</p>
            </div>
            <div className="bg-gradient-to-r from-blue-900/30 to-green-900/30 rounded-lg p-4 border border-blue-500/30">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="text-white font-semibold text-sm mb-1">Predictive Insights</h4>
              <p className="text-gray-300 text-xs">Know what your business needs before you run out</p>
            </div>
            <div className="bg-gradient-to-r from-green-900/30 to-purple-900/30 rounded-lg p-4 border border-green-500/30">
              <div className="text-2xl mb-2">🎛️</div>
              <h4 className="text-white font-semibold text-sm mb-1">Full Control</h4>
              <p className="text-gray-300 text-xs">Customize AI behavior and override any decision</p>
            </div>
          </motion.div>
          
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/auth/register" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 group"
              >
                Start Your AI-Powered Trial
                <motion.div
                  className="ml-2"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.div>
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/features" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-purple-500/50 hover:bg-slate-800/50 transition-all"
              >
                Explore AI Features
                <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>
          </motion.div>
          <motion.div 
            className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-8 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <span>✓ No credit card required</span>
            <span>✓ 14-day free trial with AI features</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Setup in under 10 minutes</span>
          </motion.div>
        </div>
      </div>
    </MarketingLayoutClient>
  )
}
