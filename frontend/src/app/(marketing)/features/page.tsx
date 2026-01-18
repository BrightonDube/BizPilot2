import Link from 'next/link'
import { Metadata } from 'next'
import { 
  Receipt, 
  Warehouse, 
  BarChart3, 
  Users, 
  DollarSign, 
  Globe,
  Package,
  Clock,
  ArrowRight,
  Building2,
  Brain,
  Shield,
  Zap
} from 'lucide-react'
import { 
  AIValuePropositions,
  AIPrivacyControl,
  AIAutomationBenefits,
  AIContentCallout
} from '@/components/marketing/AIMessagingComponents'

export const metadata: Metadata = {
  title: 'AI-Powered Features - Intelligent Business Management',
  description: 'Discover BizPilot&apos;s AI-powered feature set including intelligent POS systems, smart inventory management, predictive analytics, and automated business insights that put you in control.',
  keywords: ['AI business features', 'intelligent POS system', 'smart inventory management', 'predictive analytics', 'AI automation', 'business intelligence'],
}

const featureCategories = [
  {
    title: 'AI-Powered Point of Sale & Transactions',
    description: 'Intelligent POS system with AI-driven insights, predictive analytics, and smart automation that learns your business patterns',
    icon: Receipt,
    aiPowered: true,
    aiCapabilities: ['Smart transaction analysis', 'Predictive customer behavior', 'Automated pricing suggestions', 'Intelligent inventory alerts'],
    features: [
      { 
        name: 'Lightning-Fast AI-Enhanced Processing', 
        description: 'Process sales in seconds with AI-powered barcode recognition, intelligent product search, and predictive checkout workflows that learn from your patterns',
        aiEnhanced: true,
        aiFeatures: ['Smart product suggestions', 'Predictive text search', 'Automated discount application']
      },
      { 
        name: 'Intelligent Mobile POS Application', 
        description: 'Native mobile app with AI-powered offline capabilities, smart sync optimization, and predictive inventory alerts based on sales patterns',
        aiEnhanced: true,
        aiFeatures: ['Predictive offline mode', 'Smart sync prioritization', 'AI-driven alerts']
      },
      { 
        name: 'Smart Table Management System', 
        description: 'AI-optimized floor plans with predictive table turnover, intelligent reservation management, and automated order-to-table assignment',
        aiEnhanced: true,
        aiFeatures: ['Predictive table availability', 'Smart seating optimization', 'Automated workflow suggestions']
      },
      { 
        name: 'AI-Driven Multi-Channel Order Management', 
        description: 'Intelligently handle dine-in, takeaway, delivery, and online orders with AI-powered priority optimization and predictive fulfillment timing',
        aiEnhanced: true,
        aiFeatures: ['Smart order prioritization', 'Predictive delivery times', 'Automated channel optimization']
      },
      { 
        name: 'Intelligent Kitchen Display Integration', 
        description: 'AI-enhanced order display with predictive timing, smart priority management, and automated completion tracking that learns from kitchen performance',
        aiEnhanced: true,
        aiFeatures: ['Predictive cooking times', 'Smart priority algorithms', 'Performance learning']
      },
      { 
        name: 'Smart Payment Processing', 
        description: 'Accept all payment methods with AI-powered fraud detection, intelligent payment routing, and automated reconciliation',
        aiEnhanced: true,
        aiFeatures: ['Fraud detection', 'Smart payment routing', 'Automated reconciliation']
      },
      { 
        name: 'AI-Generated Receipts & Invoices', 
        description: 'Professional receipts and invoices with AI-powered template optimization, smart delivery timing, and personalized customer messaging',
        aiEnhanced: true,
        aiFeatures: ['Template optimization', 'Smart delivery timing', 'Personalized messaging']
      },
      { 
        name: 'Intelligent Shift Management', 
        description: 'AI-optimized shift procedures with predictive cash flow management, smart reconciliation, and automated performance tracking',
        aiEnhanced: true,
        aiFeatures: ['Predictive cash flow', 'Smart reconciliation', 'Performance insights']
      }
    ]
  },
  {
    title: 'Smart Inventory & AI-Powered Stock Control',
    description: 'Revolutionary inventory management with AI that predicts demand, optimizes stock levels, and automates reordering while keeping you in complete control',
    icon: Warehouse,
    aiPowered: true,
    aiCapabilities: ['Predictive demand forecasting', 'Automated reorder optimization', 'Smart waste reduction', 'Intelligent stock alerts'],
    features: [
      { 
        name: 'AI-Powered Real-Time Stock Tracking', 
        description: 'Live inventory with AI that predicts stock movements, identifies patterns, and provides intelligent alerts before you run out',
        aiEnhanced: true,
        aiFeatures: ['Predictive stock alerts', 'Pattern recognition', 'Smart movement analysis']
      },
      { 
        name: 'Intelligent Multi-Location Inventory', 
        description: 'AI-optimized stock distribution across locations with predictive transfer suggestions and automated rebalancing recommendations',
        aiEnhanced: true,
        aiFeatures: ['Smart transfer suggestions', 'Predictive rebalancing', 'Automated optimization']
      },
      { 
        name: 'AI-Driven Automated Reordering', 
        description: 'Smart reordering system that learns your business patterns, predicts demand fluctuations, and automatically generates optimized purchase orders',
        aiEnhanced: true,
        aiFeatures: ['Demand prediction', 'Pattern learning', 'Optimized order quantities']
      },
      { 
        name: 'Smart Barcode Scanning & Recognition', 
        description: 'AI-enhanced barcode scanning with intelligent product identification, automated data entry, and smart error correction',
        aiEnhanced: true,
        aiFeatures: ['Intelligent recognition', 'Automated data entry', 'Smart error correction']
      },
      { 
        name: 'AI-Powered Waste Tracking & Reduction', 
        description: 'Intelligent waste monitoring that identifies patterns, predicts waste hotspots, and provides actionable recommendations to reduce losses',
        aiEnhanced: true,
        aiFeatures: ['Waste pattern analysis', 'Predictive hotspot identification', 'Reduction recommendations']
      },
      { 
        name: 'Intelligent Stock Adjustment Management', 
        description: 'Smart stock adjustments with AI-powered variance analysis, automated reason detection, and intelligent approval workflows',
        aiEnhanced: true,
        aiFeatures: ['Variance analysis', 'Automated reason detection', 'Smart workflows']
      },
      { 
        name: 'AI-Enhanced Supplier Integration', 
        description: 'Intelligent supplier management with predictive ordering, automated cost optimization, and smart vendor performance analysis',
        aiEnhanced: true,
        aiFeatures: ['Predictive ordering', 'Cost optimization', 'Performance analysis']
      },
      { 
        name: 'Smart Month-End Stock Procedures', 
        description: 'AI-streamlined stock take workflows with intelligent variance detection, predictive adjustments, and automated audit trail generation',
        aiEnhanced: true,
        aiFeatures: ['Variance detection', 'Predictive adjustments', 'Automated auditing']
      }
    ]
  },
  {
    title: 'AI-Driven Reporting & Business Intelligence',
    description: 'Advanced AI analytics that transform your data into actionable insights, predictive forecasts, and intelligent recommendations for data-driven decisions',
    icon: BarChart3,
    aiPowered: true,
    aiCapabilities: ['Predictive analytics', 'Intelligent trend analysis', 'Automated insights generation', 'Smart forecasting'],
    features: [
      { 
        name: 'AI-Powered Sales Analytics', 
        description: 'Advanced sales analysis with AI-driven trend identification, predictive forecasting, and intelligent performance comparisons that reveal hidden opportunities',
        aiEnhanced: true,
        aiFeatures: ['Trend prediction', 'Opportunity identification', 'Performance insights']
      },
      { 
        name: 'Intelligent Inventory Reports', 
        description: 'Smart inventory reporting with AI-powered movement analysis, predictive valuation, and automated reorder recommendations based on your business patterns',
        aiEnhanced: true,
        aiFeatures: ['Movement prediction', 'Smart valuation', 'Automated recommendations']
      },
      { 
        name: 'AI-Enhanced Staff Performance Tracking', 
        description: 'Intelligent performance metrics with AI-driven productivity analysis, predictive target setting, and personalized improvement recommendations',
        aiEnhanced: true,
        aiFeatures: ['Productivity analysis', 'Predictive targets', 'Personalized recommendations']
      },
      { 
        name: 'Smart Dashboard Builder with AI Insights', 
        description: 'Build intelligent dashboards with AI-powered widget recommendations, automated KPI selection, and predictive metric highlighting',
        aiEnhanced: true,
        aiFeatures: ['Widget recommendations', 'Automated KPI selection', 'Predictive highlighting']
      },
      { 
        name: 'AI-Driven Profit Analysis', 
        description: 'Intelligent profit analysis with AI-powered margin optimization, predictive pricing recommendations, and automated profitability insights',
        aiEnhanced: true,
        aiFeatures: ['Margin optimization', 'Pricing recommendations', 'Profitability insights']
      },
      { 
        name: 'Smart Export & Distribution', 
        description: 'Intelligent report distribution with AI-powered scheduling, automated recipient optimization, and smart format selection',
        aiEnhanced: true,
        aiFeatures: ['Smart scheduling', 'Recipient optimization', 'Format selection']
      },
      { 
        name: 'Real-Time AI Business Intelligence', 
        description: 'Live AI-powered data visualization with predictive analytics, intelligent trend analysis, and proactive decision-making recommendations',
        aiEnhanced: true,
        aiFeatures: ['Predictive visualization', 'Trend analysis', 'Decision recommendations']
      },
      { 
        name: 'AI-Enhanced Multi-Location Reporting', 
        description: 'Intelligent consolidated reporting with AI-powered location comparison, predictive benchmarking, and automated performance insights',
        aiEnhanced: true,
        aiFeatures: ['Smart comparisons', 'Predictive benchmarking', 'Performance insights']
      }
    ]
  },
  {
    title: 'Intelligent Customer Relationship Management',
    description: 'AI-powered CRM that understands your customers, predicts their needs, and automates personalized experiences while respecting their privacy',
    icon: Users,
    aiPowered: true,
    aiCapabilities: ['Customer behavior prediction', 'Personalized recommendations', 'Automated segmentation', 'Intelligent loyalty optimization'],
    features: [
      { 
        name: 'AI-Enhanced Customer Profiles', 
        description: 'Intelligent customer profiles with AI-powered behavioral analysis, predictive preferences, and automated insight generation that respects privacy',
        aiEnhanced: true,
        aiFeatures: ['Behavioral analysis', 'Predictive preferences', 'Automated insights']
      },
      { 
        name: 'Smart Loyalty Programs', 
        description: 'AI-optimized loyalty programs with intelligent tier management, personalized offers, and predictive campaign automation',
        aiEnhanced: true,
        aiFeatures: ['Smart tier management', 'Personalized offers', 'Predictive campaigns']
      },
      { 
        name: 'Intelligent Account Management', 
        description: 'AI-powered account management with predictive balance monitoring, smart credit limit optimization, and automated statement generation',
        aiEnhanced: true,
        aiFeatures: ['Predictive monitoring', 'Credit optimization', 'Automated statements']
      },
      { 
        name: 'AI-Driven Marketing Campaigns', 
        description: 'Intelligent marketing automation with AI-powered segmentation, predictive timing optimization, and smart performance tracking',
        aiEnhanced: true,
        aiFeatures: ['Smart segmentation', 'Timing optimization', 'Performance tracking']
      },
      { 
        name: 'Predictive Customer Analytics', 
        description: 'AI-powered customer analytics with lifetime value prediction, behavioral modeling, and intelligent retention recommendations',
        aiEnhanced: true,
        aiFeatures: ['Lifetime value prediction', 'Behavioral modeling', 'Retention recommendations']
      },
      { 
        name: 'Smart Feedback & Review Management', 
        description: 'Intelligent feedback collection with AI-powered sentiment analysis, automated response suggestions, and predictive improvement tracking',
        aiEnhanced: true,
        aiFeatures: ['Sentiment analysis', 'Response suggestions', 'Improvement tracking']
      },
      { 
        name: 'AI-Enhanced Customer Display Integration', 
        description: 'Smart customer displays with AI-powered content personalization, predictive offer timing, and intelligent engagement optimization',
        aiEnhanced: true,
        aiFeatures: ['Content personalization', 'Predictive timing', 'Engagement optimization']
      },
      { 
        name: 'Advanced AI Personalization Engine', 
        description: 'Sophisticated AI that learns customer preferences, predicts needs, and delivers personalized experiences while maintaining complete privacy control',
        aiEnhanced: true,
        aiFeatures: ['Preference learning', 'Need prediction', 'Privacy-first personalization']
      }
    ]
  },
  {
    title: 'Smart Financial Management & AI Accounting',
    description: 'Intelligent financial management with AI-powered insights, automated processes, and predictive analytics that integrate seamlessly with your accounting systems',
    icon: DollarSign,
    aiPowered: true,
    aiCapabilities: ['Automated financial analysis', 'Predictive cash flow', 'Smart tax optimization', 'Intelligent reconciliation'],
    features: [
      { 
        name: 'AI-Enhanced Payment Processing', 
        description: 'Intelligent payment processing with AI-powered fraud detection, smart routing optimization, and predictive transaction analysis',
        aiEnhanced: true,
        aiFeatures: ['Fraud detection', 'Routing optimization', 'Transaction analysis']
      },
      { 
        name: 'Smart Invoice Generation', 
        description: 'AI-powered invoicing with intelligent template optimization, predictive payment timing, and automated reminder scheduling',
        aiEnhanced: true,
        aiFeatures: ['Template optimization', 'Payment prediction', 'Smart reminders']
      },
      { 
        name: 'Intelligent Accounting Integration', 
        description: 'Smart integration with accounting systems featuring AI-powered data mapping, automated reconciliation, and predictive error detection',
        aiEnhanced: true,
        aiFeatures: ['Smart data mapping', 'Automated reconciliation', 'Error prediction']
      },
      { 
        name: 'AI-Driven Tax Management', 
        description: 'Intelligent tax calculations with AI-powered compliance monitoring, predictive filing optimization, and automated reporting',
        aiEnhanced: true,
        aiFeatures: ['Compliance monitoring', 'Filing optimization', 'Automated reporting']
      },
      { 
        name: 'Smart Financial Reports', 
        description: 'AI-enhanced financial reporting with intelligent analysis, predictive insights, and automated variance detection',
        aiEnhanced: true,
        aiFeatures: ['Intelligent analysis', 'Predictive insights', 'Variance detection']
      },
      { 
        name: 'AI-Powered Multi-Currency Support', 
        description: 'Intelligent currency management with AI-driven exchange rate optimization, predictive hedging suggestions, and automated conversion',
        aiEnhanced: true,
        aiFeatures: ['Rate optimization', 'Hedging suggestions', 'Smart conversion']
      },
      { 
        name: 'Smart General Ledger Management', 
        description: 'AI-enhanced ledger management with intelligent account mapping, automated journal entries, and predictive audit trail analysis',
        aiEnhanced: true,
        aiFeatures: ['Account mapping', 'Automated entries', 'Audit analysis']
      },
      { 
        name: 'Intelligent Cost Center Accounting', 
        description: 'AI-powered cost tracking with smart allocation algorithms, predictive profitability analysis, and automated cost optimization',
        aiEnhanced: true,
        aiFeatures: ['Smart allocation', 'Profitability prediction', 'Cost optimization']
      }
    ]
  },
  {
    title: 'AI-Enhanced Staff Management & Operations',
    description: 'Intelligent workforce management with AI-powered scheduling optimization, predictive performance analysis, and automated operational insights',
    icon: Clock,
    aiPowered: true,
    aiCapabilities: ['Predictive scheduling', 'Performance optimization', 'Automated compliance', 'Smart workforce analytics'],
    features: [
      { 
        name: 'AI-Powered Time & Attendance Tracking', 
        description: 'Intelligent time tracking with AI-powered pattern recognition, predictive overtime alerts, and automated attendance analysis',
        aiEnhanced: true,
        aiFeatures: ['Pattern recognition', 'Overtime prediction', 'Attendance analysis']
      },
      { 
        name: 'Smart Staff Scheduling', 
        description: 'AI-optimized scheduling with predictive demand forecasting, intelligent availability matching, and automated labor cost optimization',
        aiEnhanced: true,
        aiFeatures: ['Demand forecasting', 'Availability matching', 'Cost optimization']
      },
      { 
        name: 'Intelligent Role-Based Access Control', 
        description: 'AI-enhanced security with smart permission optimization, predictive access patterns, and automated compliance monitoring',
        aiEnhanced: true,
        aiFeatures: ['Permission optimization', 'Access prediction', 'Compliance monitoring']
      },
      { 
        name: 'AI-Driven Performance Management', 
        description: 'Intelligent performance tracking with AI-powered goal optimization, predictive improvement recommendations, and automated review scheduling',
        aiEnhanced: true,
        aiFeatures: ['Goal optimization', 'Improvement predictions', 'Automated reviews']
      },
      { 
        name: 'Smart Commission & Incentive Management', 
        description: 'AI-powered commission tracking with intelligent calculation optimization, predictive earning forecasts, and automated payroll integration',
        aiEnhanced: true,
        aiFeatures: ['Calculation optimization', 'Earning forecasts', 'Payroll integration']
      },
      { 
        name: 'Intelligent Training & Development Tracking', 
        description: 'AI-enhanced training management with smart skill gap analysis, predictive development paths, and automated compliance tracking',
        aiEnhanced: true,
        aiFeatures: ['Skill gap analysis', 'Development paths', 'Compliance tracking']
      },
      { 
        name: 'Smart Department-Based Team Roles', 
        description: 'AI-optimized team organization with intelligent role matching, predictive workflow optimization, and automated reporting structures',
        aiEnhanced: true,
        aiFeatures: ['Role matching', 'Workflow optimization', 'Automated reporting']
      },
      { 
        name: 'AI-Powered Labor Cost Analysis', 
        description: 'Intelligent labor analysis with AI-driven productivity optimization, predictive cost forecasting, and automated efficiency recommendations',
        aiEnhanced: true,
        aiFeatures: ['Productivity optimization', 'Cost forecasting', 'Efficiency recommendations']
      }
    ]
  },
  {
    title: 'Intelligent Menu & Recipe Management',
    description: 'AI-powered menu optimization with smart recipe costing, predictive demand analysis, and automated profitability recommendations',
    icon: Package,
    aiPowered: true,
    aiCapabilities: ['Menu optimization', 'Predictive costing', 'Smart ingredient tracking', 'Automated profitability analysis'],
    features: [
      { 
        name: 'AI-Enhanced Recipe Management & Costing', 
        description: 'Intelligent recipe creation with AI-powered cost optimization, predictive ingredient pricing, and automated portion control',
        aiEnhanced: true,
        aiFeatures: ['Cost optimization', 'Price prediction', 'Portion control']
      },
      { 
        name: 'Smart Menu Engineering Optimization', 
        description: 'AI-driven menu analysis with intelligent performance tracking, predictive profitability optimization, and automated promotion recommendations',
        aiEnhanced: true,
        aiFeatures: ['Performance tracking', 'Profitability optimization', 'Promotion recommendations']
      },
      { 
        name: 'Intelligent Modifier & Add-On Management', 
        description: 'AI-powered modifier optimization with smart pricing rules, predictive selection patterns, and automated combo deal suggestions',
        aiEnhanced: true,
        aiFeatures: ['Pricing optimization', 'Selection prediction', 'Combo suggestions']
      },
      { 
        name: 'Smart Ingredient Inventory Integration', 
        description: 'AI-enhanced ingredient tracking with predictive usage patterns, intelligent deduction algorithms, and automated reorder suggestions',
        aiEnhanced: true,
        aiFeatures: ['Usage prediction', 'Smart deduction', 'Reorder suggestions']
      },
      { 
        name: 'AI-Powered Nutritional Information Tracking', 
        description: 'Intelligent nutritional analysis with automated calculation, smart allergen management, and predictive health trend integration',
        aiEnhanced: true,
        aiFeatures: ['Automated calculation', 'Allergen management', 'Health trend integration']
      },
      { 
        name: 'Smart Yield Management', 
        description: 'AI-optimized yield tracking with intelligent waste factor analysis, predictive portion optimization, and automated cost control',
        aiEnhanced: true,
        aiFeatures: ['Waste analysis', 'Portion optimization', 'Cost control']
      },
      { 
        name: 'Intelligent Seasonal Menu Planning', 
        description: 'AI-powered seasonal planning with predictive demand analysis, smart cost forecasting, and automated profitability optimization',
        aiEnhanced: true,
        aiFeatures: ['Demand prediction', 'Cost forecasting', 'Profitability optimization']
      },
      { 
        name: 'Smart Menu Category Management', 
        description: 'AI-enhanced category organization with intelligent presentation optimization, predictive promotional features, and automated visual management',
        aiEnhanced: true,
        aiFeatures: ['Presentation optimization', 'Promotional predictions', 'Visual management']
      }
    ]
  },
  {
    title: 'AI-Powered E-Commerce & Online Integration',
    description: 'Intelligent omnichannel experience with AI-driven optimization, predictive customer behavior analysis, and automated cross-platform synchronization',
    icon: Globe,
    aiPowered: true,
    aiCapabilities: ['Omnichannel optimization', 'Predictive customer behavior', 'Smart inventory sync', 'Automated marketing'],
    features: [
      { 
        name: 'Smart WooCommerce Integration', 
        description: 'AI-enhanced WooCommerce integration with intelligent product sync, predictive order management, and automated inventory optimization',
        aiEnhanced: true,
        aiFeatures: ['Smart sync', 'Order prediction', 'Inventory optimization']
      },
      { 
        name: 'Intelligent Online Ordering Platform', 
        description: 'AI-powered ordering system with smart menu personalization, predictive order suggestions, and automated payment optimization',
        aiEnhanced: true,
        aiFeatures: ['Menu personalization', 'Order suggestions', 'Payment optimization']
      },
      { 
        name: 'Smart Delivery Management System', 
        description: 'AI-optimized delivery management with intelligent route planning, predictive delivery times, and automated driver assignment',
        aiEnhanced: true,
        aiFeatures: ['Route optimization', 'Time prediction', 'Driver assignment']
      },
      { 
        name: 'AI-Enhanced Digital Signage Integration', 
        description: 'Intelligent digital signage with AI-powered content optimization, predictive display timing, and automated promotional management',
        aiEnhanced: true,
        aiFeatures: ['Content optimization', 'Display timing', 'Promotional automation']
      },
      { 
        name: 'Smart Mobile App Integration', 
        description: 'AI-powered mobile app with intelligent user experience optimization, predictive feature recommendations, and automated engagement',
        aiEnhanced: true,
        aiFeatures: ['UX optimization', 'Feature recommendations', 'Engagement automation']
      },
      { 
        name: 'Intelligent Social Media Integration', 
        description: 'AI-enhanced social media management with smart content optimization, predictive engagement analysis, and automated customer interaction',
        aiEnhanced: true,
        aiFeatures: ['Content optimization', 'Engagement prediction', 'Interaction automation']
      },
      { 
        name: 'Smart Third-Party Marketplace Integration', 
        description: 'AI-optimized marketplace management with intelligent platform optimization, predictive performance analysis, and automated order routing',
        aiEnhanced: true,
        aiFeatures: ['Platform optimization', 'Performance prediction', 'Order routing']
      },
      { 
        name: 'AI-Powered Omnichannel Inventory Sync', 
        description: 'Intelligent inventory synchronization with AI-driven demand prediction, smart allocation optimization, and automated overselling prevention',
        aiEnhanced: true,
        aiFeatures: ['Demand prediction', 'Allocation optimization', 'Overselling prevention']
      }
    ]
  },
  {
    title: 'AI-Enhanced Multi-Location & Enterprise Features',
    description: 'Enterprise-grade AI capabilities for multi-location businesses with intelligent centralized management, predictive analytics, and automated optimization',
    icon: Building2,
    aiPowered: true,
    aiCapabilities: ['Centralized AI analytics', 'Predictive performance optimization', 'Smart resource allocation', 'Automated compliance monitoring'],
    features: [
      { 
        name: 'AI-Powered Centralized Multi-Location Dashboard', 
        description: 'Intelligent unified dashboard with AI-driven performance monitoring, predictive analytics, and automated alert systems across all locations',
        aiEnhanced: true,
        aiFeatures: ['Performance monitoring', 'Predictive analytics', 'Automated alerts']
      },
      { 
        name: 'Smart Location Performance Comparison', 
        description: 'AI-enhanced performance analysis with intelligent benchmarking, predictive improvement recommendations, and automated best practice identification',
        aiEnhanced: true,
        aiFeatures: ['Smart benchmarking', 'Improvement predictions', 'Best practice identification']
      },
      { 
        name: 'AI-Driven Consolidated Financial Reporting', 
        description: 'Intelligent financial consolidation with AI-powered variance analysis, predictive trend identification, and automated drill-down capabilities',
        aiEnhanced: true,
        aiFeatures: ['Variance analysis', 'Trend prediction', 'Automated drill-down']
      },
      { 
        name: 'Smart Inter-Location Stock Transfers', 
        description: 'AI-optimized stock transfers with intelligent demand prediction, automated workflow optimization, and smart tracking systems',
        aiEnhanced: true,
        aiFeatures: ['Demand prediction', 'Workflow optimization', 'Smart tracking']
      },
      { 
        name: 'Intelligent Franchise Management Tools', 
        description: 'AI-powered franchise operations with smart royalty tracking, automated brand compliance monitoring, and predictive performance analysis',
        aiEnhanced: true,
        aiFeatures: ['Smart royalty tracking', 'Compliance monitoring', 'Performance prediction']
      },
      { 
        name: 'AI-Enhanced Brand Consistency Controls', 
        description: 'Intelligent brand management with automated consistency monitoring, smart pricing optimization, and predictive promotional coordination',
        aiEnhanced: true,
        aiFeatures: ['Consistency monitoring', 'Pricing optimization', 'Promotional coordination']
      },
      { 
        name: 'Smart Hierarchical User Management', 
        description: 'AI-optimized user management with intelligent permission optimization, predictive access patterns, and automated corporate oversight',
        aiEnhanced: true,
        aiFeatures: ['Permission optimization', 'Access prediction', 'Corporate oversight']
      },
      { 
        name: 'AI-Powered Enterprise Security & Compliance', 
        description: 'Advanced AI security with intelligent threat detection, predictive compliance monitoring, and automated audit trail analysis',
        aiEnhanced: true,
        aiFeatures: ['Threat detection', 'Compliance prediction', 'Audit analysis']
      }
    ]
  }
]

export default function FeaturesPage() {
  return (
    <div className="relative">
      {/* Navigation is handled by the marketing layout */}

      {/* AI-Enhanced Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Brain className="h-8 w-8 text-purple-400" />
            <span className="text-purple-400 font-semibold text-lg">AI-Powered</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in-up">
            Intelligent Features for Modern Businesses
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            Discover how BizPilot&apos;s AI-powered feature set transforms your business operations with intelligent automation, predictive insights, and smart decision-making tools that keep you in complete control.
          </p>
          
          {/* AI Value Proposition Callout */}
          <div className="animate-fade-in-up animation-delay-300">
            <AIContentCallout 
              componentId="hero-ai-tagline" 
              variant="highlighted"
              className="max-w-2xl mx-auto mb-8"
            />
          </div>
        </div>
      </section>

      {/* AI Value Propositions Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <AIValuePropositions 
            context="features"
            title="AI-Powered Features That Work For You"
            className="animate-fade-in-up"
          />
        </div>
      </section>

      {/* Features Categories */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-20">
            {featureCategories.map((category, categoryIndex) => (
              <div 
                key={categoryIndex}
                className="relative animate-fade-in-up"
                style={{ animationDelay: `${categoryIndex * 100}ms` }}
              >
                <div className="text-center mb-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                    <category.icon className="h-8 w-8 text-purple-400" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{category.title}</h2>
                  <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-6">{category.description}</p>
                  
                  {/* AI Capabilities Highlight */}
                  {category.aiPowered && (
                    <div className="flex flex-wrap justify-center gap-3 mb-8">
                      {category.aiCapabilities.map((capability, idx) => (
                        <span 
                          key={idx}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full border border-blue-500/30 text-blue-300 text-sm"
                        >
                          <Zap className="h-4 w-4" />
                          {capability}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.features.map((feature, featureIndex) => (
                    <div 
                      key={featureIndex}
                      className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-1 animate-fade-in-up"
                      style={{ animationDelay: `${(categoryIndex * 100) + (featureIndex * 50)}ms` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white flex-1">{feature.name}</h3>
                        {feature.aiEnhanced && (
                          <div className="flex-shrink-0 ml-2">
                            <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                              <Brain className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-300 mb-4">{feature.description}</p>
                      
                      {/* AI Features Highlight */}
                      {feature.aiEnhanced && feature.aiFeatures && (
                        <div className="border-t border-slate-600 pt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-blue-400">AI-Enhanced</span>
                          </div>
                          <ul className="space-y-1">
                            {feature.aiFeatures.map((aiFeature, aiIdx) => (
                              <li key={aiIdx} className="text-xs text-gray-400 flex items-center gap-2">
                                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                {aiFeature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Privacy & Control Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-6xl mx-auto">
          <AIPrivacyControl 
            showBoth={true}
            className="animate-fade-in-up"
          />
        </div>
      </section>

      {/* AI Automation Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <AIAutomationBenefits 
            title="How AI Automation Transforms Your Business"
            showMetrics={true}
            className="animate-fade-in-up"
          />
        </div>
      </section>

      {/* User Control Emphasis */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-green-400" />
            <span className="text-green-400 font-semibold text-lg">You&apos;re in Control</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
            AI That Respects Your Business Style
          </h2>
          <p className="text-xl text-gray-300 mb-8 animate-fade-in-up animation-delay-100">
            Our AI provides intelligent recommendations and insights - you make the final decisions. 
            Customize AI behavior, override suggestions, or disable features entirely. Your business, your rules.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎛️</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Customizable Settings</h3>
              <p className="text-gray-300 text-sm">Adjust AI sensitivity, set custom thresholds, and configure automation levels to match your preferences.</p>
            </div>
            
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✋</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Manual Override</h3>
              <p className="text-gray-300 text-sm">Override any AI recommendation with your business knowledge and experience at any time.</p>
            </div>
            
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Transparent Decisions</h3>
              <p className="text-gray-300 text-sm">Understand exactly how AI makes recommendations with clear explanations and confidence scores.</p>
            </div>
          </div>

          <AIContentCallout 
            componentId="control-emphasis" 
            variant="highlighted"
            className="animate-fade-in-up animation-delay-200"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Brain className="h-8 w-8 text-purple-400" />
            <span className="text-purple-400 font-semibold text-lg">Ready to Get Started?</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
            Experience AI-Powered Business Management
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-up animation-delay-100">
            Join thousands of businesses already using BizPilot&apos;s intelligent automation to streamline operations, increase profits, and make smarter decisions.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <div className="animate-fade-in-up animation-delay-200">
              <Link 
                href="/auth/register" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-105 group"
              >
                Start Your Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            
            <div className="animate-fade-in-up animation-delay-300">
              <Link 
                href="/pricing" 
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/20 hover:scale-105"
              >
                View AI Features & Pricing
              </Link>
            </div>
          </div>

          <AIContentCallout 
            componentId="privacy-assurance" 
            variant="minimal"
            className="animate-fade-in-up animation-delay-400 text-center"
          />
        </div>
      </section>
    </div>
  )
}