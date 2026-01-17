'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Logo } from '@/components/common/Logo'
import { ShaderBackground } from '@/components/ui'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { useGuestOnly } from '@/hooks/useAuth'
import { 
  Receipt, 
  Warehouse, 
  BarChart3, 
  Users, 
  DollarSign, 
  Smartphone,
  Globe,
  CreditCard,
  Package,
  Clock,
  Target,
  FileText,
  Settings,
  Shield,
  Zap,
  ArrowRight,
  Menu,
  X,
  Building2
} from 'lucide-react'
import { useState } from 'react'

const featureCategories = [
  {
    title: 'Point of Sale & Transactions',
    description: 'Complete POS system with mobile and desktop support for all business types',
    icon: Receipt,
    features: [
      { name: 'Lightning-Fast Transaction Processing', description: 'Process sales in seconds with barcode scanning, quick product search, and streamlined checkout workflows' },
      { name: 'Mobile POS Application', description: 'Native mobile app for tablets and smartphones with offline-first capabilities and real-time sync' },
      { name: 'Table Management System', description: 'Visual floor plans, table status tracking, reservation management, and seamless order-to-table assignment' },
      { name: 'Multi-Channel Order Management', description: 'Handle dine-in, takeaway, delivery, and online orders from a single unified interface' },
      { name: 'Kitchen Display Integration', description: 'Real-time order display for kitchen staff with timing, priority management, and completion tracking' },
      { name: 'Flexible Payment Processing', description: 'Accept cards, mobile payments, cash, and split payments with integrated payment gateway support' },
      { name: 'Receipt & Invoice Generation', description: 'Professional receipts and invoices with customizable templates and automatic email delivery' },
      { name: 'Shift Management', description: 'User PIN authentication, shift open/close procedures, cash drawer management, and end-of-day reconciliation' }
    ]
  },
  {
    title: 'Inventory & Stock Control',
    description: 'Smart inventory management across all locations with automated optimization',
    icon: Warehouse,
    features: [
      { name: 'Real-Time Stock Tracking', description: 'Live inventory levels with automatic updates on every sale, purchase, and adjustment across all locations' },
      { name: 'Multi-Location Inventory Management', description: 'Centralized control of stock across multiple stores with inter-location transfer capabilities' },
      { name: 'Automated Reordering System', description: 'Set reorder points and automatically generate purchase orders when stock levels reach minimum thresholds' },
      { name: 'Advanced Barcode Scanning', description: 'Fast product identification, stock management, and receiving with support for multiple barcode formats' },
      { name: 'Comprehensive Waste Tracking', description: 'Monitor and reduce waste with detailed tracking, reason codes, and cost analysis reporting' },
      { name: 'Stock Adjustment Management', description: 'Easy stock adjustments with full audit trails, reason codes, and approval workflows' },
      { name: 'Supplier Integration', description: 'Direct integration with suppliers for automated ordering, receiving workflows, and cost management' },
      { name: 'Month-End Stock Procedures', description: 'Streamlined stock take workflows, variance reporting, period closing, and comprehensive audit trails' }
    ]
  },
  {
    title: 'Reporting & Business Intelligence',
    description: 'Comprehensive analytics and reporting for data-driven business decisions',
    icon: BarChart3,
    features: [
      { name: 'Advanced Sales Analytics', description: 'Daily, weekly, monthly sales analysis with trend identification, forecasting, and performance comparisons' },
      { name: 'Comprehensive Inventory Reports', description: 'Stock levels, movement analysis, valuation reports, and automated reorder recommendations' },
      { name: 'Staff Performance Tracking', description: 'Individual and team performance metrics, sales targets, commission tracking, and productivity analysis' },
      { name: 'Custom Dashboard Builder', description: 'Build personalized dashboards with drag-and-drop widgets showing key business metrics and KPIs' },
      { name: 'Detailed Profit Analysis', description: 'Product-level profit margins, cost analysis, pricing optimization, and profitability recommendations' },
      { name: 'Flexible Export Capabilities', description: 'Export all reports to Excel, PDF, CSV formats with scheduled delivery and automated distribution' },
      { name: 'Real-Time Business Intelligence', description: 'Live data visualization, trend analysis, and predictive analytics for proactive decision making' },
      { name: 'Multi-Location Reporting', description: 'Consolidated reporting across all locations with location comparison and performance benchmarking' }
    ]
  },
  {
    title: 'Customer Relationship Management',
    description: 'Complete CRM and loyalty program management to drive customer retention',
    icon: Users,
    features: [
      { name: 'Comprehensive Customer Profiles', description: 'Detailed customer information with purchase history, preferences, and behavioral analytics' },
      { name: 'Advanced Loyalty Programs', description: 'Points-based rewards system with tier management, personalized offers, and automated campaigns' },
      { name: 'Customer Account Management', description: 'Account balances, credit limits, payment tracking, and automated statement generation' },
      { name: 'Targeted Marketing Campaigns', description: 'Email and SMS marketing with segmentation, automation, and performance tracking' },
      { name: 'Customer Analytics & Insights', description: 'Customer lifetime value analysis, behavior patterns, and predictive modeling for retention' },
      { name: 'Feedback & Review Management', description: 'Collect, manage, and respond to customer feedback with sentiment analysis and improvement tracking' },
      { name: 'Customer Display Integration', description: 'Interactive customer displays showing order information, loyalty points, and promotional content' },
      { name: 'Personalization Engine', description: 'AI-powered recommendations and personalized experiences based on customer behavior and preferences' }
    ]
  },
  {
    title: 'Financial Management & Accounting',
    description: 'Integrated financial management with seamless accounting system integration',
    icon: DollarSign,
    features: [
      { name: 'Integrated Payment Processing', description: 'Accept all payment methods including cards, mobile payments, EFT, and cash with real-time processing' },
      { name: 'Professional Invoice Generation', description: 'Automated invoicing with customizable templates, payment tracking, and automated reminders' },
      { name: 'Seamless Accounting Integration', description: 'Direct integration with Xero, Sage, and other accounting systems with automated data synchronization' },
      { name: 'Automated Tax Management', description: 'Tax calculations, compliance reporting, and integration with tax authorities for seamless filing' },
      { name: 'Comprehensive Financial Reports', description: 'P&L statements, balance sheets, cash flow reports, and detailed financial analysis' },
      { name: 'Multi-Currency Support', description: 'Handle multiple currencies with real-time exchange rates and automated conversion' },
      { name: 'General Ledger Management', description: 'Complete chart of accounts, journal entries, period closing, and audit trail maintenance' },
      { name: 'Cost Center Accounting', description: 'Track profitability by location, department, or product category with detailed cost allocation' }
    ]
  },
  {
    title: 'Staff Management & Operations',
    description: 'Complete workforce management with scheduling, performance tracking, and payroll integration',
    icon: Clock,
    features: [
      { name: 'Time & Attendance Tracking', description: 'Digital clock in/out system with break tracking, overtime calculation, and attendance reporting' },
      { name: 'Advanced Staff Scheduling', description: 'Create and manage staff schedules with availability tracking, shift swapping, and labor cost optimization' },
      { name: 'Role-Based Access Control', description: 'Granular permissions system with role-based access to features, reports, and sensitive information' },
      { name: 'Performance Management', description: 'Monitor staff performance with sales targets, KPIs, performance reviews, and improvement tracking' },
      { name: 'Commission & Incentive Management', description: 'Calculate and track staff commissions, bonuses, and incentives with automated payroll integration' },
      { name: 'Training & Development Tracking', description: 'Track staff training progress, certifications, skill development, and compliance requirements' },
      { name: 'Department-Based Team Roles', description: 'Organize staff by departments with specialized roles, permissions, and reporting structures' },
      { name: 'Labor Cost Analysis', description: 'Analyze labor costs, productivity metrics, and optimize staffing levels for maximum efficiency' }
    ]
  },
  {
    title: 'Menu & Recipe Management',
    description: 'Advanced menu engineering and recipe management for hospitality businesses',
    icon: Package,
    features: [
      { name: 'Recipe Management & Costing', description: 'Detailed recipe creation with ingredient tracking, portion control, and accurate cost calculation' },
      { name: 'Menu Engineering Optimization', description: 'Analyze menu performance, optimize pricing, and identify high-profit items for promotion' },
      { name: 'Modifier & Add-On Management', description: 'Complex modifier groups with pricing rules, forced selections, and combo deal configurations' },
      { name: 'Ingredient Inventory Integration', description: 'Real-time ingredient tracking with automatic deduction from inventory on recipe production' },
      { name: 'Nutritional Information Tracking', description: 'Calculate and display nutritional information for menu items with allergen management' },
      { name: 'Yield Management', description: 'Track recipe yields, waste factors, and optimize portion sizes for cost control' },
      { name: 'Seasonal Menu Planning', description: 'Plan and manage seasonal menus with cost analysis and profitability forecasting' },
      { name: 'Menu Category Management', description: 'Organize menu items by categories with visual presentation and promotional features' }
    ]
  },
  {
    title: 'E-Commerce & Online Integration',
    description: 'Seamless omnichannel experience with e-commerce and online ordering integration',
    icon: Globe,
    features: [
      { name: 'WooCommerce Integration', description: 'Seamless integration with WooCommerce for product sync, order import, and inventory management' },
      { name: 'Online Ordering Platform', description: 'Custom online ordering system with menu display, order tracking, and payment processing' },
      { name: 'Delivery Management System', description: 'Manage delivery zones, driver assignment, order tracking, and delivery fee calculation' },
      { name: 'Digital Signage Integration', description: 'Content management for digital displays with menu boards, promotions, and real-time updates' },
      { name: 'Mobile App Integration', description: 'Customer mobile app for ordering, loyalty tracking, and account management' },
      { name: 'Social Media Integration', description: 'Connect with social media platforms for marketing, reviews, and customer engagement' },
      { name: 'Third-Party Marketplace Integration', description: 'Integration with delivery platforms like Uber Eats, DoorDash, and local delivery services' },
      { name: 'Omnichannel Inventory Sync', description: 'Real-time inventory synchronization across all sales channels to prevent overselling' }
    ]
  },
  {
    title: 'Multi-Location & Enterprise Features',
    description: 'Enterprise-grade features for multi-location businesses and franchise operations',
    icon: Building2,
    features: [
      { name: 'Centralized Multi-Location Dashboard', description: 'Unified dashboard for managing multiple locations with real-time performance monitoring' },
      { name: 'Location Performance Comparison', description: 'Compare performance metrics across locations with benchmarking and best practice identification' },
      { name: 'Consolidated Financial Reporting', description: 'Combined financial reports across all locations with drill-down capabilities to individual stores' },
      { name: 'Inter-Location Stock Transfers', description: 'Manage stock transfers between locations with automated workflows and tracking' },
      { name: 'Franchise Management Tools', description: 'Specialized tools for franchise operations including royalty tracking and brand compliance' },
      { name: 'Brand Consistency Controls', description: 'Ensure consistent pricing, promotions, and operations across all locations' },
      { name: 'Hierarchical User Management', description: 'Multi-level user management with location-specific permissions and corporate oversight' },
      { name: 'Enterprise Security & Compliance', description: 'Advanced security features, audit trails, and compliance reporting for enterprise requirements' }
    ]
  }
]

export default function FeaturesPage() {
  useGuestOnly('/dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
              <Link href="/features" className="text-purple-400 font-medium">
                Features
              </Link>
              <Link href="/industries" className="text-gray-300 hover:text-white transition-colors">
                Industries
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
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
            Powerful Features for Modern Businesses
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Discover how BizPilot's comprehensive feature set can transform your business operations, increase efficiency, and drive growth.
          </motion.p>
        </div>
      </section>

      {/* Features Categories */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-20">
            {featureCategories.map((category, categoryIndex) => (
              <motion.div 
                key={categoryIndex}
                className="relative"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
              >
                <div className="text-center mb-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                    <category.icon className="h-8 w-8 text-purple-400" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{category.title}</h2>
                  <p className="text-xl text-gray-300 max-w-2xl mx-auto">{category.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.features.map((feature, featureIndex) => (
                    <motion.div 
                      key={featureIndex}
                      className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: featureIndex * 0.05 }}
                      whileHover={{ y: -4 }}
                    >
                      <h3 className="text-lg font-semibold text-white mb-3">{feature.name}</h3>
                      <p className="text-gray-300">{feature.description}</p>
                    </motion.div>
                  ))}
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
            Ready to Transform Your Business?
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-400 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join thousands of businesses already using BizPilot to streamline operations and increase profits.
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
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}