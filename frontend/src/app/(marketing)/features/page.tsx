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
  AIPrivacyControl,
  AIAutomationBenefits,
  AIContentCallout
} from '@/components/marketing/AIMessagingComponents'
import HeroStarsBackground from '@/components/home/HeroStarsBackground'
import { CarouselNavigation } from '@/components/marketing/CarouselNavigation'

export const metadata: Metadata = {
  title: 'Complete Business Management Features - BizPilot',
  description: 'Discover BizPilot&apos;s comprehensive business management features including POS systems, inventory management, reporting, customer management, and smart automation that enhances your operations.',
  keywords: ['business management features', 'POS system', 'inventory management', 'business reporting', 'customer management', 'smart automation', 'business intelligence'],
}

const featureCategories = [
  {
    title: 'Point of Sale & Transaction Management',
    description: 'Complete POS system with fast processing, multiple payment options, and smart features that help optimize your sales operations',
    icon: Receipt,
    aiPowered: false,
    smartFeatures: ['Smart transaction analysis', 'Predictive customer suggestions', 'Automated pricing rules', 'Intelligent inventory alerts'],
    features: [
      { 
        name: 'Lightning-Fast Transaction Processing', 
        description: 'Process sales in seconds with barcode scanning, product search, and streamlined checkout workflows. Handle high-volume periods with ease.',
        aiEnhanced: false,
        traditionalFeatures: ['Barcode scanning', 'Product search', 'Quick checkout', 'Receipt printing']
      },
      { 
        name: 'Mobile POS Application', 
        description: 'Native mobile app with offline capabilities, automatic sync, and real-time inventory updates. Take your POS anywhere in your store.',
        aiEnhanced: false,
        traditionalFeatures: ['Offline mode', 'Auto sync', 'Mobile payments', 'Real-time updates']
      },
      { 
        name: 'Table Management System', 
        description: 'Comprehensive table management with floor plans, reservation handling, and order-to-table assignment for restaurants.',
        aiEnhanced: true,
        smartFeatures: ['Predictive table availability', 'Smart seating optimization'],
        traditionalFeatures: ['Floor plan management', 'Reservation system', 'Order tracking', 'Table status']
      },
      { 
        name: 'Multi-Channel Order Management', 
        description: 'Handle dine-in, takeaway, delivery, and online orders from one unified system with priority management and timing controls.',
        aiEnhanced: true,
        smartFeatures: ['Smart order prioritization', 'Predictive delivery times'],
        traditionalFeatures: ['Order queue management', 'Channel integration', 'Status tracking', 'Customer notifications']
      },
      { 
        name: 'Kitchen Display Integration', 
        description: 'Digital kitchen displays with order management, timing controls, and completion tracking to streamline kitchen operations.',
        aiEnhanced: true,
        smartFeatures: ['Predictive cooking times', 'Smart priority management'],
        traditionalFeatures: ['Order display', 'Timer management', 'Status updates', 'Kitchen workflow']
      },
      { 
        name: 'Payment Processing', 
        description: 'Accept all payment methods including cash, cards, mobile payments, and digital wallets with secure processing and automatic reconciliation.',
        aiEnhanced: true,
        smartFeatures: ['Fraud detection', 'Smart payment routing'],
        traditionalFeatures: ['Multiple payment types', 'Secure processing', 'Auto reconciliation', 'Payment reporting']
      },
      { 
        name: 'Receipts & Invoicing', 
        description: 'Professional receipts and invoices with customizable templates, automatic delivery options, and customer communication features.',
        aiEnhanced: false,
        traditionalFeatures: ['Custom templates', 'Email delivery', 'Print options', 'Customer details']
      },
      { 
        name: 'Shift Management', 
        description: 'Complete shift procedures with cash management, reconciliation tools, and performance tracking for staff accountability.',
        aiEnhanced: true,
        smartFeatures: ['Predictive cash flow', 'Performance insights'],
        traditionalFeatures: ['Cash counting', 'Shift reports', 'Till reconciliation', 'Staff tracking']
      }
    ]
  },
  {
    title: 'Inventory Management & Stock Control',
    description: 'Comprehensive inventory system with real-time tracking, automated processes, and smart insights to optimize your stock levels',
    icon: Warehouse,
    aiPowered: false,
    smartFeatures: ['Predictive demand forecasting', 'Automated reorder suggestions', 'Smart waste reduction', 'Intelligent stock alerts'],
    features: [
      { 
        name: 'Real-Time Stock Tracking', 
        description: 'Live inventory monitoring with automatic updates from sales, deliveries, and adjustments. Always know your exact stock levels.',
        aiEnhanced: true,
        smartFeatures: ['Predictive stock alerts', 'Pattern recognition'],
        traditionalFeatures: ['Real-time updates', 'Stock level monitoring', 'Movement tracking', 'Audit trails']
      },
      { 
        name: 'Multi-Location Inventory', 
        description: 'Manage stock across multiple locations with centralized control, transfer management, and consolidated reporting.',
        aiEnhanced: true,
        smartFeatures: ['Smart transfer suggestions', 'Predictive rebalancing'],
        traditionalFeatures: ['Multi-location tracking', 'Transfer management', 'Centralized control', 'Location reporting']
      },
      { 
        name: 'Automated Reordering System', 
        description: 'Set reorder points and automatic purchase order generation based on sales patterns, lead times, and business rules.',
        aiEnhanced: true,
        smartFeatures: ['Demand prediction', 'Optimized order quantities'],
        traditionalFeatures: ['Reorder points', 'Purchase orders', 'Supplier management', 'Lead time tracking']
      },
      { 
        name: 'Barcode Scanning & Product Management', 
        description: 'Comprehensive product database with barcode scanning, category management, and detailed product information tracking.',
        aiEnhanced: false,
        traditionalFeatures: ['Barcode scanning', 'Product database', 'Category management', 'Product details']
      },
      { 
        name: 'Waste Tracking & Loss Prevention', 
        description: 'Monitor and track waste, spoilage, and losses with detailed reporting and analysis to identify improvement opportunities.',
        aiEnhanced: true,
        smartFeatures: ['Waste pattern analysis', 'Reduction recommendations'],
        traditionalFeatures: ['Waste logging', 'Loss tracking', 'Spoilage monitoring', 'Waste reporting']
      },
      { 
        name: 'Stock Adjustment Management', 
        description: 'Handle stock adjustments, corrections, and variance management with approval workflows and detailed audit trails.',
        aiEnhanced: false,
        traditionalFeatures: ['Stock adjustments', 'Variance tracking', 'Approval workflows', 'Audit trails']
      },
      { 
        name: 'Supplier Management', 
        description: 'Comprehensive supplier database with contact management, order history, performance tracking, and cost analysis.',
        aiEnhanced: true,
        smartFeatures: ['Performance analysis', 'Cost optimization'],
        traditionalFeatures: ['Supplier database', 'Contact management', 'Order history', 'Performance tracking']
      },
      { 
        name: 'Stock Take & Auditing', 
        description: 'Streamlined stock take procedures with mobile scanning, variance detection, and automated reporting for accurate inventory counts.',
        aiEnhanced: true,
        smartFeatures: ['Variance detection', 'Automated auditing'],
        traditionalFeatures: ['Mobile stock take', 'Count verification', 'Variance reporting', 'Audit procedures']
      }
    ]
  },
  {
    title: 'Business Reporting & Analytics',
    description: 'Powerful reporting suite with comprehensive analytics, customizable dashboards, and intelligent insights for data-driven decisions',
    icon: BarChart3,
    aiPowered: false,
    smartFeatures: ['Predictive analytics', 'Intelligent trend analysis', 'Automated insights generation', 'Smart forecasting'],
    features: [
      { 
        name: 'Sales Analytics & Reporting', 
        description: 'Comprehensive sales analysis with detailed reports, performance tracking, and trend identification across all channels and time periods.',
        aiEnhanced: true,
        smartFeatures: ['Trend prediction', 'Opportunity identification'],
        traditionalFeatures: ['Sales reports', 'Performance tracking', 'Channel analysis', 'Time period comparisons']
      },
      { 
        name: 'Inventory Reports & Analysis', 
        description: 'Detailed inventory reporting with movement analysis, valuation reports, and reorder recommendations based on historical data.',
        aiEnhanced: true,
        smartFeatures: ['Movement prediction', 'Smart recommendations'],
        traditionalFeatures: ['Stock reports', 'Movement analysis', 'Valuation reports', 'Reorder analysis']
      },
      { 
        name: 'Staff Performance Tracking', 
        description: 'Monitor staff performance with sales tracking, productivity metrics, and detailed performance reports for better management.',
        aiEnhanced: false,
        traditionalFeatures: ['Performance metrics', 'Sales tracking', 'Productivity reports', 'Staff comparisons']
      },
      { 
        name: 'Custom Dashboard Builder', 
        description: 'Build personalized dashboards with drag-and-drop widgets, custom KPIs, and real-time data visualization.',
        aiEnhanced: true,
        smartFeatures: ['Widget recommendations', 'Automated KPI selection'],
        traditionalFeatures: ['Custom dashboards', 'Drag-and-drop builder', 'Real-time data', 'Custom KPIs']
      },
      { 
        name: 'Profit & Loss Analysis', 
        description: 'Detailed profitability analysis with margin tracking, cost analysis, and profit optimization recommendations.',
        aiEnhanced: true,
        smartFeatures: ['Margin optimization', 'Profitability insights'],
        traditionalFeatures: ['P&L reports', 'Margin tracking', 'Cost analysis', 'Profit calculations']
      },
      { 
        name: 'Report Export & Distribution', 
        description: 'Export reports in multiple formats and set up automated distribution to stakeholders with customizable scheduling.',
        aiEnhanced: false,
        traditionalFeatures: ['Multiple export formats', 'Automated distribution', 'Custom scheduling', 'Email delivery']
      },
      { 
        name: 'Real-Time Business Intelligence', 
        description: 'Live data visualization with interactive charts, real-time KPIs, and comprehensive business intelligence dashboards.',
        aiEnhanced: true,
        smartFeatures: ['Predictive visualization', 'Decision recommendations'],
        traditionalFeatures: ['Real-time charts', 'Interactive dashboards', 'Live KPIs', 'Data visualization']
      },
      { 
        name: 'Multi-Location Consolidated Reporting', 
        description: 'Unified reporting across all locations with consolidated views, location comparisons, and centralized performance tracking.',
        aiEnhanced: true,
        smartFeatures: ['Smart comparisons', 'Performance insights'],
        traditionalFeatures: ['Consolidated reports', 'Location comparisons', 'Centralized tracking', 'Multi-location KPIs']
      }
    ]
  },
  {
    title: 'Customer Relationship Management',
    description: 'Complete CRM system with customer profiles, loyalty programs, and marketing tools to build stronger customer relationships',
    icon: Users,
    aiPowered: false,
    smartFeatures: ['Customer behavior insights', 'Personalized recommendations', 'Automated segmentation', 'Intelligent loyalty optimization'],
    features: [
      { 
        name: 'Customer Profiles & Database', 
        description: 'Comprehensive customer database with contact information, purchase history, preferences, and detailed customer insights.',
        aiEnhanced: true,
        smartFeatures: ['Behavioral analysis', 'Predictive preferences'],
        traditionalFeatures: ['Customer database', 'Contact management', 'Purchase history', 'Customer notes']
      },
      { 
        name: 'Loyalty Programs & Rewards', 
        description: 'Flexible loyalty program management with points, tiers, rewards, and promotional campaigns to increase customer retention.',
        aiEnhanced: true,
        smartFeatures: ['Smart tier management', 'Personalized offers'],
        traditionalFeatures: ['Points system', 'Tier management', 'Reward tracking', 'Promotional campaigns']
      },
      { 
        name: 'Customer Account Management', 
        description: 'Manage customer accounts with credit limits, payment terms, account balances, and automated statement generation.',
        aiEnhanced: false,
        traditionalFeatures: ['Account management', 'Credit limits', 'Payment terms', 'Statement generation']
      },
      { 
        name: 'Marketing Campaign Management', 
        description: 'Create and manage marketing campaigns with customer segmentation, targeted messaging, and performance tracking.',
        aiEnhanced: true,
        smartFeatures: ['Smart segmentation', 'Timing optimization'],
        traditionalFeatures: ['Campaign creation', 'Customer segmentation', 'Message templates', 'Performance tracking']
      },
      { 
        name: 'Customer Analytics & Insights', 
        description: 'Analyze customer behavior with lifetime value calculations, purchase patterns, and retention analysis for better decision making.',
        aiEnhanced: true,
        smartFeatures: ['Lifetime value prediction', 'Retention recommendations'],
        traditionalFeatures: ['Customer analytics', 'Purchase patterns', 'Retention analysis', 'Value calculations']
      },
      { 
        name: 'Feedback & Review Management', 
        description: 'Collect and manage customer feedback with review tracking, response management, and improvement action planning.',
        aiEnhanced: true,
        smartFeatures: ['Sentiment analysis', 'Response suggestions'],
        traditionalFeatures: ['Feedback collection', 'Review tracking', 'Response management', 'Action planning']
      },
      { 
        name: 'Customer Display Integration', 
        description: 'Customer-facing displays with promotional content, loyalty information, and interactive features for enhanced engagement.',
        aiEnhanced: false,
        traditionalFeatures: ['Customer displays', 'Promotional content', 'Loyalty display', 'Interactive features']
      },
      { 
        name: 'Customer Communication Tools', 
        description: 'Integrated communication tools with email marketing, SMS notifications, and automated customer messaging.',
        aiEnhanced: true,
        smartFeatures: ['Personalized messaging', 'Engagement optimization'],
        traditionalFeatures: ['Email marketing', 'SMS notifications', 'Automated messaging', 'Communication tracking']
      }
    ]
  },
  {
    title: 'Financial Management & Accounting',
    description: 'Comprehensive financial tools with payment processing, invoicing, and seamless integration with popular accounting systems',
    icon: DollarSign,
    aiPowered: false,
    smartFeatures: ['Automated financial analysis', 'Predictive cash flow', 'Smart tax optimization', 'Intelligent reconciliation'],
    features: [
      { 
        name: 'Payment Processing & Management', 
        description: 'Secure payment processing with multiple payment methods, automatic reconciliation, and detailed transaction tracking.',
        aiEnhanced: true,
        smartFeatures: ['Fraud detection', 'Smart routing'],
        traditionalFeatures: ['Multiple payment methods', 'Secure processing', 'Transaction tracking', 'Payment reconciliation']
      },
      { 
        name: 'Invoice Generation & Management', 
        description: 'Professional invoice creation with customizable templates, automatic delivery, and payment tracking for better cash flow.',
        aiEnhanced: false,
        traditionalFeatures: ['Invoice creation', 'Custom templates', 'Automatic delivery', 'Payment tracking']
      },
      { 
        name: 'Accounting System Integration', 
        description: 'Seamless integration with popular accounting systems like Xero, Sage, and QuickBooks for streamlined financial management.',
        aiEnhanced: true,
        smartFeatures: ['Smart data mapping', 'Automated reconciliation'],
        traditionalFeatures: ['Xero integration', 'Sage integration', 'QuickBooks sync', 'Data mapping']
      },
      { 
        name: 'Tax Management & Compliance', 
        description: 'Automated tax calculations, compliance monitoring, and reporting tools to ensure accurate tax management and filing.',
        aiEnhanced: false,
        traditionalFeatures: ['Tax calculations', 'Compliance monitoring', 'Tax reporting', 'Filing assistance']
      },
      { 
        name: 'Financial Reporting Suite', 
        description: 'Comprehensive financial reports including P&L, balance sheets, cash flow statements, and custom financial analysis.',
        aiEnhanced: true,
        smartFeatures: ['Intelligent analysis', 'Predictive insights'],
        traditionalFeatures: ['P&L reports', 'Balance sheets', 'Cash flow reports', 'Financial analysis']
      },
      { 
        name: 'Multi-Currency Support', 
        description: 'Handle multiple currencies with automatic conversion, exchange rate management, and multi-currency reporting.',
        aiEnhanced: false,
        traditionalFeatures: ['Multi-currency support', 'Exchange rates', 'Currency conversion', 'Multi-currency reports']
      },
      { 
        name: 'General Ledger Management', 
        description: 'Complete general ledger with chart of accounts, journal entries, and detailed financial transaction tracking.',
        aiEnhanced: false,
        traditionalFeatures: ['Chart of accounts', 'Journal entries', 'Transaction tracking', 'Ledger management']
      },
      { 
        name: 'Cost Center & Department Accounting', 
        description: 'Track costs by department or cost center with detailed allocation, profitability analysis, and budget management.',
        aiEnhanced: true,
        smartFeatures: ['Smart allocation', 'Profitability prediction'],
        traditionalFeatures: ['Cost center tracking', 'Department accounting', 'Budget management', 'Allocation rules']
      }
    ]
  },
  {
    title: 'Staff Management & Operations',
    description: 'Complete workforce management with time tracking, scheduling, performance management, and operational controls',
    icon: Clock,
    aiPowered: false,
    smartFeatures: ['Predictive scheduling', 'Performance optimization', 'Automated compliance', 'Smart workforce analytics'],
    features: [
      { 
        name: 'Time & Attendance Tracking', 
        description: 'Comprehensive time tracking with clock in/out, break management, overtime tracking, and detailed attendance reporting.',
        aiEnhanced: true,
        smartFeatures: ['Pattern recognition', 'Overtime prediction'],
        traditionalFeatures: ['Time clock', 'Break tracking', 'Overtime management', 'Attendance reports']
      },
      { 
        name: 'Staff Scheduling System', 
        description: 'Advanced scheduling tools with shift planning, availability management, and labor cost optimization for efficient staffing.',
        aiEnhanced: true,
        smartFeatures: ['Demand forecasting', 'Cost optimization'],
        traditionalFeatures: ['Shift planning', 'Availability tracking', 'Schedule templates', 'Labor cost tracking']
      },
      { 
        name: 'Role-Based Access Control', 
        description: 'Secure access management with customizable user roles, permission settings, and activity monitoring for system security.',
        aiEnhanced: false,
        traditionalFeatures: ['User roles', 'Permission settings', 'Access control', 'Activity monitoring']
      },
      { 
        name: 'Performance Management Tools', 
        description: 'Track staff performance with goal setting, performance reviews, and detailed analytics for better team management.',
        aiEnhanced: true,
        smartFeatures: ['Goal optimization', 'Improvement recommendations'],
        traditionalFeatures: ['Performance tracking', 'Goal setting', 'Review management', 'Performance analytics']
      },
      { 
        name: 'Commission & Incentive Management', 
        description: 'Automated commission calculations, incentive tracking, and payroll integration for transparent compensation management.',
        aiEnhanced: false,
        traditionalFeatures: ['Commission tracking', 'Incentive management', 'Payroll integration', 'Compensation reports']
      },
      { 
        name: 'Training & Development Tracking', 
        description: 'Monitor staff training progress, skill development, and certification management for continuous improvement.',
        aiEnhanced: true,
        smartFeatures: ['Skill gap analysis', 'Development paths'],
        traditionalFeatures: ['Training tracking', 'Skill management', 'Certification tracking', 'Development planning']
      },
      { 
        name: 'Department & Team Management', 
        description: 'Organize staff by departments and teams with hierarchical management, reporting structures, and team performance tracking.',
        aiEnhanced: false,
        traditionalFeatures: ['Department organization', 'Team management', 'Hierarchical structure', 'Team reporting']
      },
      { 
        name: 'Labor Cost Analysis', 
        description: 'Detailed labor cost tracking with productivity analysis, efficiency metrics, and cost optimization recommendations.',
        aiEnhanced: true,
        smartFeatures: ['Productivity optimization', 'Efficiency recommendations'],
        traditionalFeatures: ['Labor cost tracking', 'Productivity metrics', 'Efficiency analysis', 'Cost reporting']
      }
    ]
  },
  {
    title: 'Menu & Recipe Management',
    description: 'Complete menu management system with recipe costing, nutritional tracking, and menu optimization tools for food businesses',
    icon: Package,
    aiPowered: false,
    smartFeatures: ['Menu optimization', 'Predictive costing', 'Smart ingredient tracking', 'Automated profitability analysis'],
    features: [
      { 
        name: 'Recipe Management & Costing', 
        description: 'Comprehensive recipe database with ingredient tracking, cost calculations, and portion control for accurate menu pricing.',
        aiEnhanced: true,
        smartFeatures: ['Cost optimization', 'Price prediction'],
        traditionalFeatures: ['Recipe database', 'Ingredient tracking', 'Cost calculations', 'Portion control']
      },
      { 
        name: 'Menu Engineering & Optimization', 
        description: 'Analyze menu performance with profitability tracking, popularity analysis, and menu optimization recommendations.',
        aiEnhanced: true,
        smartFeatures: ['Performance tracking', 'Optimization recommendations'],
        traditionalFeatures: ['Menu analysis', 'Profitability tracking', 'Popularity metrics', 'Menu design']
      },
      { 
        name: 'Modifier & Add-On Management', 
        description: 'Flexible modifier system with pricing rules, combination management, and upselling tools to increase average order value.',
        aiEnhanced: false,
        traditionalFeatures: ['Modifier management', 'Pricing rules', 'Combination tracking', 'Upselling tools']
      },
      { 
        name: 'Ingredient Inventory Integration', 
        description: 'Connect recipes to inventory with automatic ingredient deduction, usage tracking, and reorder suggestions.',
        aiEnhanced: true,
        smartFeatures: ['Usage prediction', 'Reorder suggestions'],
        traditionalFeatures: ['Ingredient tracking', 'Auto deduction', 'Usage monitoring', 'Recipe costing']
      },
      { 
        name: 'Nutritional Information Tracking', 
        description: 'Track nutritional information, allergen data, and dietary requirements with automatic calculations and compliance reporting.',
        aiEnhanced: false,
        traditionalFeatures: ['Nutritional tracking', 'Allergen management', 'Dietary requirements', 'Compliance reporting']
      },
      { 
        name: 'Yield Management & Waste Control', 
        description: 'Monitor recipe yields, track waste factors, and optimize portion sizes for better cost control and profitability.',
        aiEnhanced: true,
        smartFeatures: ['Waste analysis', 'Portion optimization'],
        traditionalFeatures: ['Yield tracking', 'Waste monitoring', 'Portion control', 'Cost analysis']
      },
      { 
        name: 'Seasonal Menu Planning', 
        description: 'Plan seasonal menus with cost forecasting, availability tracking, and profitability analysis for better menu management.',
        aiEnhanced: false,
        traditionalFeatures: ['Seasonal planning', 'Cost forecasting', 'Availability tracking', 'Menu scheduling']
      },
      { 
        name: 'Menu Category & Display Management', 
        description: 'Organize menu items by category with visual management, promotional features, and customer-facing display controls.',
        aiEnhanced: false,
        traditionalFeatures: ['Category management', 'Visual organization', 'Promotional features', 'Display controls']
      }
    ]
  },
  {
    title: 'E-Commerce & Online Integration',
    description: 'Seamless omnichannel experience with online ordering, delivery management, and integration with popular e-commerce platforms',
    icon: Globe,
    aiPowered: false,
    smartFeatures: ['Omnichannel optimization', 'Predictive customer behavior', 'Smart inventory sync', 'Automated marketing'],
    features: [
      { 
        name: 'WooCommerce Integration', 
        description: 'Seamless integration with WooCommerce for unified inventory, order management, and customer data synchronization.',
        aiEnhanced: false,
        traditionalFeatures: ['WooCommerce sync', 'Inventory integration', 'Order management', 'Customer sync']
      },
      { 
        name: 'Online Ordering Platform', 
        description: 'Complete online ordering system with menu display, order customization, and integrated payment processing.',
        aiEnhanced: true,
        smartFeatures: ['Menu personalization', 'Order suggestions'],
        traditionalFeatures: ['Online menu', 'Order customization', 'Payment processing', 'Order tracking']
      },
      { 
        name: 'Delivery Management System', 
        description: 'Comprehensive delivery management with driver assignment, route planning, and real-time tracking for efficient delivery operations.',
        aiEnhanced: true,
        smartFeatures: ['Route optimization', 'Time prediction'],
        traditionalFeatures: ['Driver management', 'Route planning', 'Delivery tracking', 'Customer notifications']
      },
      { 
        name: 'Digital Signage Integration', 
        description: 'Connect with digital signage systems for dynamic menu displays, promotional content, and real-time pricing updates.',
        aiEnhanced: false,
        traditionalFeatures: ['Digital menu boards', 'Promotional displays', 'Real-time updates', 'Content management']
      },
      { 
        name: 'Mobile App Integration', 
        description: 'Native mobile app support with customer ordering, loyalty integration, and push notification capabilities.',
        aiEnhanced: false,
        traditionalFeatures: ['Mobile ordering', 'Loyalty integration', 'Push notifications', 'Customer accounts']
      },
      { 
        name: 'Social Media Integration', 
        description: 'Connect with social media platforms for marketing, customer engagement, and online reputation management.',
        aiEnhanced: false,
        traditionalFeatures: ['Social media posting', 'Customer engagement', 'Review management', 'Marketing integration']
      },
      { 
        name: 'Third-Party Marketplace Integration', 
        description: 'Integrate with delivery platforms and marketplaces for expanded reach and unified order management.',
        aiEnhanced: false,
        traditionalFeatures: ['Marketplace integration', 'Unified orders', 'Platform management', 'Commission tracking']
      },
      { 
        name: 'Omnichannel Inventory Synchronization', 
        description: 'Keep inventory synchronized across all sales channels with real-time updates and overselling prevention.',
        aiEnhanced: true,
        smartFeatures: ['Demand prediction', 'Overselling prevention'],
        traditionalFeatures: ['Multi-channel sync', 'Real-time updates', 'Inventory allocation', 'Channel management']
      }
    ]
  },
  {
    title: 'Multi-Location & Enterprise Features',
    description: 'Enterprise-grade capabilities for multi-location businesses with centralized management, consolidated reporting, and scalable operations',
    icon: Building2,
    aiPowered: false,
    smartFeatures: ['Centralized analytics', 'Predictive performance optimization', 'Smart resource allocation', 'Automated compliance monitoring'],
    features: [
      { 
        name: 'Centralized Multi-Location Dashboard', 
        description: 'Unified dashboard for monitoring all locations with real-time performance metrics, alerts, and consolidated views.',
        aiEnhanced: true,
        smartFeatures: ['Performance monitoring', 'Automated alerts'],
        traditionalFeatures: ['Multi-location dashboard', 'Real-time metrics', 'Consolidated views', 'Location comparison']
      },
      { 
        name: 'Location Performance Comparison', 
        description: 'Compare performance across locations with benchmarking tools, best practice identification, and improvement recommendations.',
        aiEnhanced: true,
        smartFeatures: ['Smart benchmarking', 'Best practice identification'],
        traditionalFeatures: ['Performance comparison', 'Benchmarking tools', 'Location analytics', 'Improvement tracking']
      },
      { 
        name: 'Consolidated Financial Reporting', 
        description: 'Unified financial reporting across all locations with consolidated statements, variance analysis, and drill-down capabilities.',
        aiEnhanced: false,
        traditionalFeatures: ['Consolidated reports', 'Financial statements', 'Variance analysis', 'Drill-down reporting']
      },
      { 
        name: 'Inter-Location Stock Transfers', 
        description: 'Manage stock transfers between locations with automated workflows, tracking systems, and approval processes.',
        aiEnhanced: true,
        smartFeatures: ['Demand prediction', 'Workflow optimization'],
        traditionalFeatures: ['Transfer management', 'Tracking systems', 'Approval workflows', 'Transfer reporting']
      },
      { 
        name: 'Franchise Management Tools', 
        description: 'Comprehensive franchise management with royalty tracking, brand compliance monitoring, and performance analysis.',
        aiEnhanced: false,
        traditionalFeatures: ['Royalty tracking', 'Brand compliance', 'Franchise reporting', 'Performance monitoring']
      },
      { 
        name: 'Brand Consistency Controls', 
        description: 'Maintain brand consistency across locations with pricing controls, promotional coordination, and compliance monitoring.',
        aiEnhanced: false,
        traditionalFeatures: ['Pricing controls', 'Promotional coordination', 'Brand compliance', 'Consistency monitoring']
      },
      { 
        name: 'Hierarchical User Management', 
        description: 'Advanced user management with hierarchical permissions, corporate oversight, and role-based access across locations.',
        aiEnhanced: false,
        traditionalFeatures: ['Hierarchical permissions', 'Corporate oversight', 'Role management', 'Access control']
      },
      { 
        name: 'Enterprise Security & Compliance', 
        description: 'Advanced security features with compliance monitoring, audit trails, and enterprise-grade data protection.',
        aiEnhanced: true,
        smartFeatures: ['Threat detection', 'Compliance prediction'],
        traditionalFeatures: ['Security monitoring', 'Audit trails', 'Data protection', 'Compliance reporting']
      }
    ]
  }
]

export default function FeaturesPage() {
  return (
    <div className="relative">
      {/* Navigation is handled by the marketing layout */}

      {/* Balanced Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-slate-950 min-h-[60vh]">
        <HeroStarsBackground />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building2 className="h-8 w-8 text-blue-400" />
            <span className="text-blue-400 font-semibold text-lg">Complete Business Management</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in-up">
            Everything You Need to Run Your Business
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            Comprehensive POS, inventory management, reporting, and customer management system with smart features that enhance your operations and help you make better decisions.
          </p>
          
          {/* Balanced Value Proposition */}
          <div className="animate-fade-in-up animation-delay-300">
            <AIContentCallout 
              componentId="balanced-hero-tagline" 
              variant="highlighted"
              className="max-w-2xl mx-auto mb-8"
            />
          </div>
        </div>
      </section>

      {/* Balanced Value Propositions Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Complete Business Management Platform
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Everything you need to run your business efficiently, with smart features that enhance your operations
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <Receipt className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Complete POS System</h3>
              <p className="text-gray-300 text-sm">Fast transaction processing, payment handling, and customer management</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                <Warehouse className="h-8 w-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Smart Inventory</h3>
              <p className="text-gray-300 text-sm">Real-time tracking with intelligent alerts and automated reordering</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
                <BarChart3 className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Advanced Analytics</h3>
              <p className="text-gray-300 text-sm">Comprehensive reporting with predictive insights and trend analysis</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-orange-500/30">
                <Users className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Customer Management</h3>
              <p className="text-gray-300 text-sm">Complete CRM with loyalty programs and personalized experiences</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Categories */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-20">
            {featureCategories.map((category, categoryIndex) => (
              <div 
                key={categoryIndex}
                className={`relative animate-fade-in-up p-8 rounded-2xl border ${
                  categoryIndex % 2 === 0 
                    ? 'bg-slate-900/50 border-slate-700' 
                    : 'bg-gradient-to-br from-slate-900/30 to-slate-800/30 border-slate-600'
                }`}
                style={{ animationDelay: `${categoryIndex * 100}ms` }}
              >
                <div className="text-center mb-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                    <category.icon className="h-8 w-8 text-purple-400" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{category.title}</h2>
                  <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-6">{category.description}</p>
                  
                  {/* Smart Features Highlight - Only show if category has smart features */}
                  {category.smartFeatures && category.smartFeatures.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-8">
                      {category.smartFeatures.map((capability, idx) => (
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

                {/* Horizontal Scroll Carousel */}
                <div className="relative">
                  {/* Previous Button */}
                  <CarouselNavigation 
                    carouselId={`carousel-${categoryIndex}`}
                    direction="prev"
                  />

                  {/* Scrollable Container */}
                  <div 
                    id={`carousel-${categoryIndex}`}
                    className="flex overflow-x-auto gap-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-12"
                  >
                    {category.features.map((feature, featureIndex) => (
                      <div 
                        key={featureIndex}
                        className="flex-shrink-0 w-[320px] snap-center p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-1 animate-fade-in-up"
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
                        
                        {/* Traditional Features List */}
                        {feature.traditionalFeatures && feature.traditionalFeatures.length > 0 && (
                          <div className="border-t border-slate-600 pt-3 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-400">Core Features</span>
                            </div>
                            <ul className="space-y-1">
                              {feature.traditionalFeatures.map((traditionalFeature, tradIdx) => (
                                <li key={tradIdx} className="text-xs text-gray-400 flex items-center gap-2">
                                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                  {traditionalFeature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Smart Features Highlight */}
                        {feature.aiEnhanced && feature.smartFeatures && feature.smartFeatures.length > 0 && (
                          <div className="border-t border-slate-600 pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium text-blue-400">Smart Enhancements</span>
                            </div>
                            <ul className="space-y-1">
                              {feature.smartFeatures.map((smartFeature, smartIdx) => (
                                <li key={smartIdx} className="text-xs text-blue-300 flex items-center gap-2">
                                  <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                  {smartFeature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Next Button */}
                  <CarouselNavigation 
                    carouselId={`carousel-${categoryIndex}`}
                    direction="next"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Smart Features & Control Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Smart Features That Work For You
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              BizPilot includes intelligent automation and insights that enhance your business operations while keeping you in complete control
            </p>
          </div>
          
          <AIPrivacyControl 
            showBoth={true}
            className="animate-fade-in-up"
          />
        </div>
      </section>

      {/* Business Automation Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Smart Automation Enhances Your Business
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Reduce manual work and get intelligent insights while maintaining full control over your operations
            </p>
          </div>
          
          <AIAutomationBenefits 
            title=""
            showMetrics={true}
            className="animate-fade-in-up"
          />
        </div>
      </section>

      {/* User Control Emphasis */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-green-400" />
            <span className="text-green-400 font-semibold text-lg">You&apos;re in Control</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
            Business Management That Adapts to Your Style
          </h2>
          <p className="text-xl text-gray-300 mb-8 animate-fade-in-up animation-delay-100">
            BizPilot provides comprehensive business management tools with smart features that enhance your operations. 
            You control the automation levels, override any suggestions, and customize the system to work your way.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎛️</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Customizable Settings</h3>
              <p className="text-gray-300 text-sm">Adjust smart feature sensitivity, set custom thresholds, and configure automation levels to match your preferences.</p>
            </div>
            
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✋</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Manual Override</h3>
              <p className="text-gray-300 text-sm">Override any smart recommendation with your business knowledge and experience at any time.</p>
            </div>
            
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Transparent Decisions</h3>
              <p className="text-gray-300 text-sm">Understand exactly how smart features make recommendations with clear explanations and confidence scores.</p>
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
            <Building2 className="h-8 w-8 text-blue-400" />
            <span className="text-blue-400 font-semibold text-lg">Ready to Get Started?</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
            Experience Complete Business Management
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-up animation-delay-100">
            Join thousands of businesses already using BizPilot&apos;s comprehensive platform to streamline operations, increase profits, and make smarter decisions with intelligent automation.
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
                View Features & Pricing
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