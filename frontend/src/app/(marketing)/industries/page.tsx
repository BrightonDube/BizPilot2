import Link from 'next/link'
import { 
  Building2,
  ShoppingCart,
  Coffee,
  Utensils,
  Store,
  Hotel,
  ArrowRight,
  CheckCircle,
  Star,
  Brain,
  Zap,
  Shield
} from 'lucide-react'
import { AI_MESSAGING_CONFIG } from '@/lib/ai-messaging-config'
import { AIPrivacyControl, AIContentCallout } from '@/components/marketing/AIMessagingComponents'

const industries = [
  {
    icon: Utensils,
    title: 'Restaurants & Cafes',
    description: 'Complete restaurant management system with table management, menu engineering, inventory control, and smart insights to optimize operations',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Smart Menu & Inventory Optimization',
      description: 'Advanced analytics help you understand customer preferences, track ingredient costs, and optimize menu pricing. Get intelligent insights about demand patterns while maintaining full control over your operations.',
      example: 'Track that pasta dishes sell 30% more on Fridays, get suggested ingredient reorder quantities, and receive menu pricing recommendations based on cost analysis and sales data.'
    },
    features: [
      'Complete Table Management & Floor Plans',
      'Menu Engineering & Recipe Costing',
      'Kitchen Display System with Order Tracking',
      'Multi-Channel Order Management (Dine-in, Takeaway, Delivery)',
      'Staff Scheduling & Performance Management',
      'Comprehensive Ingredient Inventory Tracking'
    ],
    benefits: [
      'Reduce food waste by up to 40% with better demand tracking',
      'Increase table turnover by 35% with efficient management',
      'Boost profit margins by 25% through optimized pricing',
      'Save 6+ hours per week on inventory management tasks'
    ],
    automationBenefits: [
      'Get smart suggestions for daily prep quantities',
      'Receive reorder alerts before ingredients run out',
      'Optimize staff schedules based on historical busy periods',
      'Get pricing recommendations based on cost and demand analysis'
    ],
    controlFeatures: [
      'Override suggestions for special events or holidays',
      'Set custom food safety and quality standards',
      'Customize waste tolerance levels by ingredient type',
      'Control which processes use automation features'
    ],
    testimonial: {
      name: 'Marco Rossi',
      role: 'Owner',
      company: 'Bella Vista Restaurant',
      content: 'BizPilot gave us complete control over our restaurant operations. The demand tracking and menu costing features helped us reduce waste by 35% and improve profit margins by 22%. The smart suggestions are helpful, but I can always adjust them based on my experience.',
      rating: 5
    }
  },
  {
    icon: ShoppingCart,
    title: 'Retail Stores',
    description: 'Comprehensive retail management with inventory control, customer management, e-commerce integration, and intelligent insights to grow your business',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Advanced Inventory & Customer Analytics',
      description: 'Powerful analytics help you understand sales patterns, seasonal trends, and customer behavior. Get intelligent insights about inventory needs and customer preferences while maintaining complete control over your business decisions.',
      example: 'Analyze that winter jackets typically sell out in 2 weeks, get suggested reorder quantities, identify customers who frequently buy accessories, and receive pricing optimization recommendations.'
    },
    features: [
      'Multi-location Inventory Management',
      'Barcode Scanning & SKU Management',
      'Layby & Payment Plans Management',
      'E-commerce Integration & Sync',
      'Customer Loyalty Programs & CRM',
      'Supplier Management & Purchase Orders'
    ],
    benefits: [
      'Eliminate 90% of stockouts with better inventory tracking',
      'Increase customer retention by 45% with comprehensive CRM',
      'Save 8+ hours per week on inventory management',
      'Boost profit margins by 20% through better pricing strategies'
    ],
    automationBenefits: [
      'Get smart predictions for product demand 2-4 weeks ahead',
      'Receive alerts for slow-moving inventory',
      'Get pricing optimization suggestions based on market data',
      'Receive personalized customer marketing recommendations'
    ],
    controlFeatures: [
      'Set custom reorder thresholds for different product categories',
      'Override pricing recommendations with your market knowledge',
      'Customize customer segmentation and marketing rules',
      'Control which processes use intelligent features'
    ],
    testimonial: {
      name: 'Sarah Johnson',
      role: 'Store Manager',
      company: 'Fashion Forward',
      content: 'Managing inventory across our 5 stores became so much easier with BizPilot. The comprehensive tracking and analytics helped us achieve 99.5% stock accuracy and we haven\'t had a major stockout in 6 months. The intelligent suggestions are helpful, but I can always adjust them when needed.',
      rating: 5
    }
  },
  {
    icon: Building2,
    title: 'Multi-Location Chains',
    description: 'Centralized management platform for franchise and chain operations with performance analytics, consolidated reporting, and intelligent optimization tools',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Advanced Multi-Location Performance Analytics',
      description: 'Comprehensive analytics help you understand performance across all locations, identify best practices, and optimize operations. Get intelligent insights about location performance while maintaining brand consistency and local flexibility.',
      example: 'Analyze that Location A\'s inventory practices could improve Location B\'s performance by 15%, identify locations needing support, and get recommendations for optimizing inter-location transfers.'
    },
    features: [
      'Centralized Dashboard & Multi-Location Reporting',
      'Location Performance Comparison & Analytics',
      'Consolidated Financial Reporting & Accounting',
      'Inter-location Stock Transfer Management',
      'Franchise Management Tools & Compliance',
      'Brand Consistency Controls & Standards'
    ],
    benefits: [
      'Reduce operational costs by 25% through better visibility',
      'Improve location performance tracking by 90%',
      'Standardize operations with automated best practice sharing',
      'Accelerate expansion planning by 40% with better analytics'
    ],
    automationBenefits: [
      'Get insights about underperforming locations with improvement suggestions',
      'Receive recommendations for optimal inventory distribution',
      'Get staff allocation suggestions based on demand patterns',
      'Automate compliance monitoring and reporting processes'
    ],
    controlFeatures: [
      'Set performance benchmarks and improvement targets',
      'Override recommendations for local market conditions',
      'Customize reporting and analytics for different stakeholders',
      'Control which processes use intelligent features'
    ],
    testimonial: {
      name: 'David Chen',
      role: 'Operations Director',
      company: 'Coffee Culture Chain',
      content: 'With 15 locations, BizPilot gave us the comprehensive visibility and control we needed. The centralized reporting and performance analytics help us identify which locations need support and make data-driven decisions across all stores while maintaining local flexibility.',
      rating: 5
    }
  },
  {
    icon: Coffee,
    title: 'Coffee Shops & Bakeries',
    description: 'Specialized management system for coffee shops and bakeries with recipe costing, fresh product tracking, loyalty programs, and smart optimization features',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Smart Recipe Management & Waste Reduction',
      description: 'Advanced analytics help you understand customer preferences, weather patterns, and ingredient costs to optimize recipes and predict demand for fresh products. Get intelligent insights to minimize waste while maintaining quality.',
      example: 'Track that rainy Tuesdays typically need 20% fewer cold drinks but 40% more pastries, get suggested baking quantities, and receive ingredient cost optimization recommendations.'
    },
    features: [
      'Recipe Management & Ingredient Costing',
      'Fresh Product Tracking & Expiry Management',
      'Loyalty Card Integration & Customer Programs',
      'Mobile Ordering & Pickup Management',
      'Waste Tracking & Cost Analysis',
      'Supplier Integration & Ordering'
    ],
    benefits: [
      'Reduce ingredient costs by 18% through better recipe optimization',
      'Cut daily waste by 45% with improved demand tracking',
      'Increase customer retention by 35% with loyalty programs',
      'Save 2+ hours daily on morning prep with better planning'
    ],
    automationBenefits: [
      'Get smart suggestions for daily fresh product quantities',
      'Receive recipe cost optimization recommendations',
      'Get loyalty reward suggestions based on customer behavior',
      'Receive equipment maintenance scheduling recommendations'
    ],
    controlFeatures: [
      'Set quality standards and freshness requirements',
      'Override suggestions for special events or promotions',
      'Customize recipe modifications and ingredient substitutions',
      'Control which processes use intelligent features'
    ],
    testimonial: {
      name: 'Emma Thompson',
      role: 'Owner',
      company: 'The Daily Grind',
      content: 'The recipe costing and demand tracking features transformed our business operations. We reduced waste by 40% and increased our profit margin by 28% while maintaining quality. The system helps us understand our customers\' preferences and prepare exactly what we need.',
      rating: 5
    }
  },
  {
    icon: Hotel,
    title: 'Hotels & Hospitality',
    description: 'Integrated POS and property management system that enhances guest experience with comprehensive service management and intelligent optimization tools',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Advanced Guest Experience Management',
      description: 'Comprehensive analytics help you understand guest preferences, booking patterns, and service history to personalize experiences and optimize resource allocation. Get intelligent insights to enhance guest satisfaction while maintaining operational efficiency.',
      example: 'Track that business travelers prefer quick breakfast service, optimize F&B inventory for conference bookings, and get personalized room service recommendations based on guest history.'
    },
    features: [
      'PMS Integration & Guest Management',
      'Room Service Management & Ordering',
      'Guest Profile Management & History',
      'Event & Banquet Management',
      'Multi-outlet Reporting & Analytics',
      'Guest Billing Integration & Processing'
    ],
    benefits: [
      'Increase guest satisfaction by 30% with personalized service',
      'Boost F&B revenue by 20% with integrated room charges',
      'Improve operational efficiency by 40% with streamlined service',
      'Reduce equipment downtime by 60% with better maintenance tracking'
    ],
    automationBenefits: [
      'Get guest preference insights for personalized service offerings',
      'Receive staff scheduling suggestions based on occupancy forecasts',
      'Get inventory optimization recommendations for events',
      'Streamline billing and payment processing workflows'
    ],
    controlFeatures: [
      'Set service standards and guest experience preferences',
      'Override recommendations for VIP guests or special events',
      'Customize pricing strategies for different guest segments',
      'Control which processes use intelligent features'
    ],
    testimonial: {
      name: 'James Wilson',
      role: 'General Manager',
      company: 'Grand Plaza Hotel',
      content: 'BizPilot seamlessly integrated with our PMS and transformed our guest experience management. The comprehensive system helps us understand what our guests need and deliver personalized service. Our F&B revenue increased by 18% and guest satisfaction scores improved significantly.',
      rating: 5
    }
  },
  {
    icon: Store,
    title: 'Specialty Retail',
    description: 'Tailored management solutions for specialty retail with complex catalog management, seasonal buying optimization, custom orders, and intelligent insights',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Advanced Specialty Product Management',
      description: 'Comprehensive analytics help you manage complex product variants, understand seasonal demand patterns, and optimize custom order fulfillment. Get intelligent insights about specialty retail challenges while maintaining complete control over your unique business processes.',
      example: 'Track seasonal demand for art supplies based on school calendars and local events, optimize consignment artist payments and inventory, and get suggestions for complementary products in custom orders.'
    },
    features: [
      'Complex Product Variant Management',
      'Seasonal Inventory Planning & Buying',
      'Customer Special Orders & Tracking',
      'Consignment Management & Artist Payments',
      'Repair & Service Tracking',
      'Vendor Management & Relationships'
    ],
    benefits: [
      'Manage complex product catalogs with 95% accuracy',
      'Reduce seasonal overstock by 50% with better buying optimization',
      'Improve customer satisfaction by 40% with special order tracking',
      'Strengthen supplier relationships with comprehensive vendor management'
    ],
    automationBenefits: [
      'Get insights about seasonal demand for specialty products',
      'Receive consignment inventory and payment optimization suggestions',
      'Get automated special order status updates and customer communication',
      'Receive repair service tracking and completion time estimates'
    ],
    controlFeatures: [
      'Set custom rules for different product categories and vendors',
      'Override suggestions for unique market conditions',
      'Customize consignment terms and payment schedules',
      'Control which processes use intelligent features'
    ],
    testimonial: {
      name: 'Lisa Rodriguez',
      role: 'Owner',
      company: 'Artisan Crafts',
      content: 'The consignment management and seasonal planning features were exactly what we needed for our specialty business. The system tracks artist inventory comprehensively and helps us understand which products sell during different seasons. We can now focus on curating great products instead of managing spreadsheets.',
      rating: 5
    }
  }
]

export default function IndustriesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in-up">
            Complete Business Solutions Built for Your Industry
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            BizPilot provides comprehensive business management with intelligent features that adapt to your specific industry needs while keeping you in complete control.
          </p>
          
          {/* Business Benefits Highlight */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 animate-fade-in-up animation-delay-400">
            <div className="flex items-center justify-center space-x-3 text-purple-300">
              <Brain className="h-6 w-6" />
              <span className="text-sm font-medium">Smart Insights</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-blue-300">
              <Zap className="h-6 w-6" />
              <span className="text-sm font-medium">Intelligent Features</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-green-300">
              <Shield className="h-6 w-6" />
              <span className="text-sm font-medium">You Stay in Control</span>
            </div>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-32">
            {industries.map((industry, index) => (
              <div 
                key={index}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-fade-in-up ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl flex items-center justify-center mb-6 border border-purple-500/30">
                    <industry.icon className="h-8 w-8 text-purple-400" />
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{industry.title}</h2>
                  <p className="text-lg text-gray-300 mb-8">{industry.description}</p>

                  {/* Smart Features Section */}
                  <div className="mb-8 p-6 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-500/30">
                    <div className="flex items-center mb-3">
                      <Brain className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-lg font-semibold text-blue-300">Smart Business Intelligence</h3>
                    </div>
                    <h4 className="text-white font-medium mb-2">{industry.aiUseCase.title}</h4>
                    <p className="text-gray-300 text-sm mb-3">{industry.aiUseCase.description}</p>
                    <div className="bg-slate-800/50 p-3 rounded-lg border-l-4 border-blue-400">
                      <p className="text-gray-300 text-sm italic">
                        <strong>Real Example:</strong> {industry.aiUseCase.example}
                      </p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Complete Feature Set</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {industry.features.map((feature, featureIndex) => (
                        <div 
                          key={featureIndex} 
                          className="flex items-center animate-fade-in-left"
                          style={{ animationDelay: `${(index * 100) + (featureIndex * 50)}ms` }}
                        >
                          <CheckCircle className="h-4 w-4 text-green-400 mr-3 flex-shrink-0" />
                          <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Business Benefits</h3>
                    <div className="space-y-2">
                      {industry.benefits.map((benefit, benefitIndex) => (
                        <div 
                          key={benefitIndex} 
                          className="flex items-center animate-fade-in-left"
                          style={{ animationDelay: `${(index * 100) + (benefitIndex * 50)}ms` }}
                        >
                          <ArrowRight className="h-4 w-4 text-purple-400 mr-3 flex-shrink-0" />
                          <span className="text-gray-300">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Intelligent Features */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <Zap className="h-5 w-5 text-yellow-400 mr-2" />
                      <h3 className="text-lg font-semibold text-yellow-300">Intelligent Features</h3>
                    </div>
                    <div className="space-y-2">
                      {industry.automationBenefits.map((benefit, benefitIndex) => (
                        <div 
                          key={benefitIndex} 
                          className="flex items-start animate-fade-in-left"
                          style={{ animationDelay: `${(index * 100) + (benefitIndex * 50)}ms` }}
                        >
                          <Zap className="h-4 w-4 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300 text-sm">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Control Features */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <Shield className="h-5 w-5 text-green-400 mr-2" />
                      <h3 className="text-lg font-semibold text-green-300">You Stay in Control</h3>
                    </div>
                    <div className="space-y-2">
                      {industry.controlFeatures.map((feature, featureIndex) => (
                        <div 
                          key={featureIndex} 
                          className="flex items-start animate-fade-in-left"
                          style={{ animationDelay: `${(index * 100) + (featureIndex * 50)}ms` }}
                        >
                          <Shield className="h-4 w-4 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={index % 2 === 1 ? 'lg:col-start-1' : ''}>
                  <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 hover:transform hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      {[...Array(industry.testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                    
                    <p className="text-gray-300 mb-6 italic text-lg">&ldquo;{industry.testimonial.content}&rdquo;</p>
                    
                    <div className="border-t border-slate-700 pt-4">
                      <p className="font-semibold text-white">{industry.testimonial.name}</p>
                      <p className="text-sm text-gray-400">{industry.testimonial.role}</p>
                      <p className="text-sm text-purple-400">{industry.testimonial.company}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Privacy & Control Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <AIPrivacyControl 
            className="animate-fade-in-up"
            showBoth={true}
          />
          
          {/* AI Content Callout */}
          <div className="mt-12 text-center animate-fade-in-up animation-delay-200">
            <AIContentCallout 
              componentId="automation-benefit"
              variant="highlighted"
              className="max-w-4xl mx-auto"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
            Ready to Transform Your Industry Operations?
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-up animation-delay-100">
            Join businesses in your industry who are already using BizPilot&apos;s comprehensive management platform with intelligent features to increase efficiency and profitability while staying in complete control.
          </p>
          
          {/* Key Business Benefits */}
          <div className="grid md:grid-cols-3 gap-6 mb-8 animate-fade-in-up animation-delay-200">
            <div className="text-center">
              <Brain className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Smart Insights</p>
            </div>
            <div className="text-center">
              <Zap className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Intelligent Features</p>
            </div>
            <div className="text-center">
              <Shield className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Complete Control</p>
            </div>
          </div>
          
          <div className="animate-fade-in-up animation-delay-300">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 group hover:scale-105 hover:-translate-y-0.5"
            >
              Start Your Free Trial Today
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              {AI_MESSAGING_CONFIG.messaging.privacyMessage.split('.')[0]}.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}