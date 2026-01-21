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
    title: 'Complete POS System',
    description: 'Lightning-fast transaction processing with comprehensive payment handling, mobile POS capabilities, table management, and kitchen display systems. Enhanced with intelligent sales insights and automated upselling suggestions to maximize revenue.'
  },
  {
    icon: Warehouse,
    title: 'Advanced Inventory Management',
    description: 'Comprehensive inventory control across multiple locations with real-time tracking, supplier management, and automated reordering. Smart features predict demand patterns and prevent stockouts while optimizing stock levels.'
  },
  {
    icon: BarChart3,
    title: 'Business Analytics & Reporting',
    description: 'Powerful reporting suite with customizable dashboards, financial analysis, and performance tracking. Enhanced with predictive insights that identify trends and provide actionable recommendations for business growth.'
  },
  {
    icon: DollarSign,
    title: 'Financial Management & Integration',
    description: 'Complete financial tracking with automated categorization, expense management, and seamless integration with Xero and Sage. Smart features enhance bookkeeping accuracy and provide cash flow predictions.'
  },
  {
    icon: Package,
    title: 'Recipe & Menu Management',
    description: 'Comprehensive recipe costing and menu optimization tools that track ingredient costs, analyze profitability, and manage supplier relationships. Smart pricing suggestions help maximize margins while staying competitive.'
  },
  {
    icon: MessageSquare,
    title: 'Customer Relationship Management',
    description: 'Complete CRM system with customer profiles, purchase history, and loyalty program management. Enhanced with intelligent customer segmentation and personalized marketing campaign recommendations.'
  },
  {
    icon: Users,
    title: 'Staff Management & Scheduling',
    description: 'Comprehensive staff management with time tracking, performance monitoring, and payroll integration. Smart scheduling features optimize staffing based on predicted demand and business patterns.'
  },
  {
    icon: Globe,
    title: 'E-commerce & Online Ordering',
    description: 'Full e-commerce integration with online ordering, inventory synchronization, and multi-channel management. Smart features provide product recommendations and optimize the customer journey.'
  },
  {
    icon: Building2,
    title: 'Multi-Location Management',
    description: 'Centralized control across all business locations with consolidated reporting, inter-location transfers, and franchise management. Smart analytics provide performance comparisons and optimization insights.'
  }
]

const benefits = [
  'Complete POS system with comprehensive payment processing and mobile capabilities',
  'Advanced inventory management with automated reordering and smart demand forecasting',
  'Seamless financial integration with Xero, Sage, and automated categorization',
  'Powerful reporting suite with predictive insights and optimization recommendations',
  'Customer loyalty programs with intelligent segmentation and personalized campaigns',
  'Staff management system with smart scheduling and performance tracking',
  'E-commerce integration with intelligent recommendations and inventory synchronization',
  'Multi-location management with predictive analytics and automated optimization',
  'Recipe management with smart costing and menu optimization tools',
  'Comprehensive business intelligence that learns your patterns while you stay in control'
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

      {/* Features Section */}
      <div className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Complete Business Management with Smart Automation
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-6">
              Everything you need to run your business efficiently, enhanced with intelligent features that learn your patterns and provide helpful insights. From POS to inventory, reporting to customer management—all in one comprehensive platform.
            </p>
            
            {/* Smart Features Callout */}
            <motion.div 
              className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-500/30 max-w-4xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center justify-center mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-lg">🚀</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Comprehensive Platform, Smart Enhancements</h3>
              </div>
              <p className="text-gray-300 text-sm">
                Get all essential business management tools in one platform, enhanced with intelligent automation that learns your business patterns. 
                Smart features provide helpful suggestions while you maintain complete control over all decisions.
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
                
                {/* Smart Enhancement Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center mr-2">
                      <span className="text-white text-xs">⚡</span>
                    </div>
                    <span className="text-xs text-blue-400 font-medium">Smart-Enhanced</span>
                  </div>
                  <div className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 text-white hover:border-blue-400/70 hover:bg-gradient-to-r hover:from-blue-600/30 hover:to-purple-600/30 transition-all group"
              >
                <span className="text-lg font-medium">Explore All Business Features</span>
                <motion.div
                  className="ml-2"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <ArrowRight className="h-5 w-5 group-hover:text-blue-300 transition-colors" />
                </motion.div>
              </Link>
            </motion.div>
            <p className="text-sm text-gray-400 mt-3">
              Discover how comprehensive business management with smart automation can transform your operations
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
                Complete Business Intelligence That Grows With You
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                From your first sale to multi-location expansion, BizPilot provides comprehensive business management tools enhanced with intelligent features that learn your unique patterns. Experience smart automation that enhances your expertise while keeping you in complete control.
              </p>
              
              {/* Smart Features Control Emphasis */}
              <motion.div 
                className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30 mb-6"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center mb-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-sm">🎯</span>
                  </div>
                  <h4 className="text-white font-semibold">Complete Solution, Smart Enhancements</h4>
                </div>
                <p className="text-gray-300 text-sm">
                  Get all essential business tools in one platform, enhanced with intelligent automation that provides helpful insights and recommendations. 
                  Customize smart features, set your own rules, and override any suggestion at any time.
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
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all group"
                  >
                    Start Your Free Trial
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
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-600 text-white hover:border-blue-500/50 hover:bg-slate-800/50 transition-all"
                  >
                    Explore All Features
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
            Ready to Experience Complete Business Management?
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join thousands of businesses using BizPilot&apos;s comprehensive platform to streamline operations, optimize performance, and make smarter decisions. 
            Experience the power of complete business management enhanced with intelligent automation that works for you.
          </motion.p>
          
          {/* Balanced Benefits Highlight */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30">
              <div className="text-2xl mb-2">🏢</div>
              <h4 className="text-white font-semibold text-sm mb-1">Complete Platform</h4>
              <p className="text-gray-300 text-xs">All business tools in one integrated solution</p>
            </div>
            <div className="bg-gradient-to-r from-purple-900/30 to-green-900/30 rounded-lg p-4 border border-purple-500/30">
              <div className="text-2xl mb-2">🤖</div>
              <h4 className="text-white font-semibold text-sm mb-1">Smart Automation</h4>
              <p className="text-gray-300 text-xs">Intelligent features that enhance your expertise</p>
            </div>
            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-lg p-4 border border-green-500/30">
              <div className="text-2xl mb-2">🎛️</div>
              <h4 className="text-white font-semibold text-sm mb-1">Full Control</h4>
              <p className="text-gray-300 text-xs">Customize features and override any decision</p>
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
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 group"
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
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/features" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-blue-500/50 hover:bg-slate-800/50 transition-all"
              >
                Explore All Features
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
            <span>✓ 14-day free trial with smart features</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Setup in under 10 minutes</span>
          </motion.div>
        </div>
      </div>
    </MarketingLayoutClient>
  )
}
