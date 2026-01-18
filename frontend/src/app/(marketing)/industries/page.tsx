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
    description: 'AI-powered restaurant management that predicts demand, optimizes menus, and reduces waste while keeping you in control',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Intelligent Menu & Inventory Management',
      description: 'Our AI analyzes customer preferences, seasonal trends, and ingredient costs to optimize your menu pricing and predict daily demand for each dish.',
      example: 'Predict that Friday will need 30% more pasta dishes based on weather and local events, automatically suggest ingredient orders, and recommend menu pricing adjustments.'
    },
    features: [
      'AI-Powered Table Management & Floor Plans',
      'Smart Menu Engineering & Recipe Costing',
      'Predictive Kitchen Display System',
      'Intelligent Order Management (Dine-in, Takeaway, Delivery)',
      'AI-Optimized Staff Scheduling & Performance',
      'Smart Ingredient Inventory Tracking'
    ],
    benefits: [
      'AI reduces food waste by 40% through demand prediction',
      'Smart scheduling increases table turnover by 35%',
      'Intelligent pricing optimization boosts profit margins by 25%',
      'Automated inventory management saves 6 hours per week'
    ],
    automationBenefits: [
      'Predict daily demand for each menu item',
      'Automatically reorder ingredients before stockouts',
      'Optimize staff schedules based on predicted busy periods',
      'Adjust menu pricing based on ingredient costs and demand'
    ],
    controlFeatures: [
      'Override AI predictions for special events or holidays',
      'Set custom food safety and quality standards',
      'Customize waste tolerance levels by ingredient type',
      'Control automation levels for different restaurant processes'
    ],
    testimonial: {
      name: 'Marco Rossi',
      role: 'Owner',
      company: 'Bella Vista Restaurant',
      content: 'BizPilot\'s AI helped us predict customer demand and optimize our menu pricing. Food waste dropped by 35% and our profit margins improved by 22% in just 4 months. I love that I can override the AI when I know something special is happening.',
      rating: 5
    }
  },
  {
    icon: ShoppingCart,
    title: 'Retail Stores',
    description: 'Smart retail management with AI that predicts trends, optimizes inventory, and personalizes customer experiences',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Predictive Inventory & Customer Intelligence',
      description: 'AI analyzes sales patterns, seasonal trends, and customer behavior to predict what products you\'ll need and when, while identifying your most valuable customers.',
      example: 'Predict that winter jackets will sell out in 2 weeks, automatically suggest reorders, identify customers likely to buy accessories, and optimize pricing for maximum profit.'
    },
    features: [
      'AI-Driven Multi-location Inventory Management',
      'Smart Barcode Scanning & SKU Management',
      'Intelligent Layby & Payment Plans',
      'AI-Enhanced E-commerce Integration',
      'Predictive Customer Loyalty Programs',
      'Smart Supplier Management'
    ],
    benefits: [
      'AI eliminates 90% of stockouts through predictive ordering',
      'Smart customer insights increase retention by 45%',
      'Automated reordering saves 8 hours per week',
      'Intelligent pricing boosts profit margins by 20%'
    ],
    automationBenefits: [
      'Predict product demand 2-4 weeks in advance',
      'Automatically identify slow-moving inventory',
      'Optimize pricing based on demand and competition',
      'Personalize customer recommendations and promotions'
    ],
    controlFeatures: [
      'Set custom reorder thresholds for different product categories',
      'Override AI pricing recommendations with your market knowledge',
      'Customize customer segmentation and marketing rules',
      'Control automation levels for inventory and pricing decisions'
    ],
    testimonial: {
      name: 'Sarah Johnson',
      role: 'Store Manager',
      company: 'Fashion Forward',
      content: 'Managing inventory across our 5 stores was a nightmare until BizPilot\'s AI started predicting what we\'d need. Our stock accuracy improved to 99.5% and we haven\'t had a major stockout in 6 months. The AI suggestions are spot-on, but I can always adjust them when needed.',
      rating: 5
    }
  },
  {
    icon: Building2,
    title: 'Multi-Location Chains',
    description: 'Centralized AI-powered management for franchise and chain operations with intelligent performance optimization',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Intelligent Multi-Location Performance Optimization',
      description: 'AI analyzes performance across all locations to identify best practices, predict problems, and optimize operations while maintaining brand consistency.',
      example: 'Identify that Location A\'s inventory management practices could improve Location B\'s performance by 15%, predict which locations need additional support, and optimize inter-location transfers.'
    },
    features: [
      'AI-Enhanced Centralized Dashboard & Reporting',
      'Intelligent Location Performance Comparison',
      'Smart Consolidated Financial Reporting',
      'Predictive Inter-location Stock Transfers',
      'AI-Powered Franchise Management Tools',
      'Intelligent Brand Consistency Controls'
    ],
    benefits: [
      'AI identifies operational improvements reducing costs by 25%',
      'Smart performance analytics improve location visibility by 90%',
      'Automated best practice sharing standardizes operations',
      'Predictive analytics accelerate expansion planning by 40%'
    ],
    automationBenefits: [
      'Automatically identify underperforming locations and suggest improvements',
      'Predict optimal inventory distribution across locations',
      'Optimize staff allocation based on predicted demand',
      'Automate compliance monitoring and reporting'
    ],
    controlFeatures: [
      'Set performance benchmarks and improvement targets',
      'Override AI recommendations for local market conditions',
      'Customize reporting and analytics for different stakeholders',
      'Control automation levels for different operational processes'
    ],
    testimonial: {
      name: 'David Chen',
      role: 'Operations Director',
      company: 'Coffee Culture Chain',
      content: 'With 15 locations, BizPilot\'s AI gave us the visibility and control we needed. The system identifies which locations are struggling and suggests specific improvements. We can now make data-driven decisions across all stores while maintaining local flexibility.',
      rating: 5
    }
  },
  {
    icon: Coffee,
    title: 'Coffee Shops & Bakeries',
    description: 'Specialized AI features for coffee shops and bakeries that optimize recipes, predict demand, and minimize waste',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Smart Recipe Optimization & Waste Reduction',
      description: 'AI analyzes customer preferences, weather patterns, and ingredient costs to optimize recipes, predict daily demand for fresh products, and minimize waste.',
      example: 'Predict that rainy Tuesday will need 20% fewer cold drinks but 40% more pastries, suggest optimal baking quantities, and recommend ingredient substitutions to reduce costs.'
    },
    features: [
      'AI-Optimized Recipe Management & Costing',
      'Smart Fresh Product Tracking',
      'Intelligent Loyalty Card Integration',
      'Predictive Mobile Ordering & Pickup',
      'AI-Powered Waste Tracking & Reporting',
      'Smart Supplier Integration'
    ],
    benefits: [
      'AI optimizes ingredient usage reducing costs by 18%',
      'Smart demand prediction reduces daily waste by 45%',
      'Intelligent loyalty programs increase customer retention by 35%',
      'Automated morning prep saves 2 hours daily'
    ],
    automationBenefits: [
      'Predict daily demand for fresh baked goods',
      'Optimize recipe costs based on ingredient prices',
      'Automatically adjust loyalty rewards based on customer behavior',
      'Schedule equipment maintenance to prevent downtime'
    ],
    controlFeatures: [
      'Set quality standards and freshness requirements',
      'Override AI predictions for special events or promotions',
      'Customize recipe modifications and ingredient substitutions',
      'Control automation levels for different product categories'
    ],
    testimonial: {
      name: 'Emma Thompson',
      role: 'Owner',
      company: 'The Daily Grind',
      content: 'The AI recipe costing and demand prediction features transformed our business. We reduced waste by 40% and increased our profit margin by 28% while maintaining quality. The system learns our customers\' preferences and helps us prepare exactly what we need.',
      rating: 5
    }
  },
  {
    icon: Hotel,
    title: 'Hotels & Hospitality',
    description: 'Integrated AI-powered POS and property management that enhances guest experience and optimizes operations',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Intelligent Guest Experience Optimization',
      description: 'AI analyzes guest preferences, booking patterns, and service history to personalize experiences, predict needs, and optimize resource allocation.',
      example: 'Predict that business travelers prefer quick breakfast service, automatically adjust F&B inventory for conference bookings, and personalize room service recommendations based on guest history.'
    },
    features: [
      'AI-Enhanced PMS Integration',
      'Smart Room Service Management',
      'Intelligent Guest Profile Management',
      'Predictive Event & Banquet Management',
      'AI-Powered Multi-outlet Reporting',
      'Smart Guest Billing Integration'
    ],
    benefits: [
      'AI personalizes guest experience increasing satisfaction by 30%',
      'Smart F&B integration with room charges boosts revenue by 20%',
      'Automated service optimization improves efficiency by 40%',
      'Predictive maintenance reduces equipment downtime by 60%'
    ],
    automationBenefits: [
      'Predict guest preferences and personalize service offerings',
      'Optimize staff scheduling based on occupancy forecasts',
      'Automatically adjust inventory for events and conferences',
      'Streamline billing and payment processing'
    ],
    controlFeatures: [
      'Set service standards and guest experience preferences',
      'Override AI recommendations for VIP guests or special events',
      'Customize pricing strategies for different guest segments',
      'Control automation levels for different hotel operations'
    ],
    testimonial: {
      name: 'James Wilson',
      role: 'General Manager',
      company: 'Grand Plaza Hotel',
      content: 'BizPilot\'s AI seamlessly integrated with our PMS and transformed our guest experience. The system predicts what our guests need and helps us deliver personalized service. Our F&B revenue increased by 18% and guest satisfaction scores improved significantly.',
      rating: 5
    }
  },
  {
    icon: Store,
    title: 'Specialty Retail',
    description: 'Tailored AI solutions for specialty retail that manage complex catalogs, optimize seasonal buying, and track custom orders',
    image: '/api/placeholder/600/400',
    aiUseCase: {
      title: 'Intelligent Specialty Product Management',
      description: 'AI understands the unique challenges of specialty retail, managing complex product variants, predicting seasonal demand, and optimizing custom order fulfillment.',
      example: 'Predict seasonal demand for art supplies based on school calendars and local events, optimize consignment artist payments, and suggest complementary products for custom orders.'
    },
    features: [
      'AI-Enhanced Product Variant Management',
      'Smart Seasonal Inventory Planning',
      'Intelligent Customer Special Orders',
      'AI-Powered Consignment Management',
      'Predictive Repair & Service Tracking',
      'Smart Vendor Management'
    ],
    benefits: [
      'AI manages complex product catalogs with 95% accuracy',
      'Smart seasonal buying optimization reduces overstock by 50%',
      'Automated special order tracking improves customer satisfaction by 40%',
      'Intelligent vendor management strengthens supplier relationships'
    ],
    automationBenefits: [
      'Predict seasonal demand for specialty products',
      'Optimize consignment artist inventory and payments',
      'Automate special order status updates and customer communication',
      'Track repair services and predict completion times'
    ],
    controlFeatures: [
      'Set custom rules for different product categories and vendors',
      'Override AI predictions for unique market conditions',
      'Customize consignment terms and payment schedules',
      'Control automation levels for different business processes'
    ],
    testimonial: {
      name: 'Lisa Rodriguez',
      role: 'Owner',
      company: 'Artisan Crafts',
      content: 'The AI consignment management and seasonal planning features were exactly what we needed. The system tracks artist inventory automatically and predicts which products will sell during different seasons. We can now focus on curating great products instead of managing spreadsheets.',
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
            AI-Powered Solutions Built for Your Industry
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            BizPilot&apos;s intelligent automation adapts to your specific industry needs with AI that learns your business patterns while keeping you in complete control.
          </p>
          
          {/* AI Benefits Highlight */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 animate-fade-in-up animation-delay-400">
            <div className="flex items-center justify-center space-x-3 text-purple-300">
              <Brain className="h-6 w-6" />
              <span className="text-sm font-medium">Smart Decision Making</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-blue-300">
              <Zap className="h-6 w-6" />
              <span className="text-sm font-medium">Intelligent Automation</span>
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

                  {/* AI Use Case Section */}
                  <div className="mb-8 p-6 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-500/30">
                    <div className="flex items-center mb-3">
                      <Brain className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-lg font-semibold text-blue-300">AI-Powered Intelligence</h3>
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
                    <h3 className="text-xl font-semibold text-white mb-4">AI-Enhanced Features</h3>
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

                  {/* Automation Benefits */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <Zap className="h-5 w-5 text-yellow-400 mr-2" />
                      <h3 className="text-lg font-semibold text-yellow-300">Smart Automation</h3>
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
            Ready to Transform Your Industry with AI?
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-up animation-delay-100">
            Join businesses in your industry who are already using BizPilot&apos;s intelligent automation to increase efficiency and profitability while staying in complete control.
          </p>
          
          {/* Key AI Benefits */}
          <div className="grid md:grid-cols-3 gap-6 mb-8 animate-fade-in-up animation-delay-200">
            <div className="text-center">
              <Brain className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Smart Predictions</p>
            </div>
            <div className="text-center">
              <Zap className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Intelligent Automation</p>
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
              Start Your AI-Powered Free Trial
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