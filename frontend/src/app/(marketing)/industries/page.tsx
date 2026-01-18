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
  Star
} from 'lucide-react'

const industries = [
  {
    icon: Utensils,
    title: 'Restaurants & Cafes',
    description: 'Complete restaurant management from table service to kitchen operations',
    image: '/api/placeholder/600/400',
    features: [
      'Table Management & Floor Plans',
      'Menu Engineering & Recipe Costing',
      'Kitchen Display System',
      'Order Management (Dine-in, Takeaway, Delivery)',
      'Staff Scheduling & Performance',
      'Ingredient Inventory Tracking'
    ],
    benefits: [
      'Reduce food waste by 25%',
      'Increase table turnover by 30%',
      'Optimize menu pricing for maximum profit',
      'Streamline kitchen operations'
    ],
    testimonial: {
      name: 'Marco Rossi',
      role: 'Owner',
      company: 'Bella Vista Restaurant',
      content: 'BizPilot helped us optimize our menu pricing and reduce food waste. Our profit margins improved by 18% in just 4 months.',
      rating: 5
    }
  },
  {
    icon: ShoppingCart,
    title: 'Retail Stores',
    description: 'Comprehensive retail management for single and multi-location stores',
    image: '/api/placeholder/600/400',
    features: [
      'Multi-location Inventory Management',
      'Barcode Scanning & SKU Management',
      'Layby & Payment Plans',
      'E-commerce Integration',
      'Customer Loyalty Programs',
      'Supplier Management'
    ],
    benefits: [
      'Eliminate stockouts and overstock',
      'Increase customer retention by 40%',
      'Automate reordering processes',
      'Sync online and offline sales'
    ],
    testimonial: {
      name: 'Sarah Johnson',
      role: 'Store Manager',
      company: 'Fashion Forward',
      content: 'Managing inventory across our 5 stores was a nightmare. BizPilot made it seamless and our stock accuracy improved to 99.5%.',
      rating: 5
    }
  },
  {
    icon: Building2,
    title: 'Multi-Location Chains',
    description: 'Centralized management for franchise and chain operations',
    image: '/api/placeholder/600/400',
    features: [
      'Centralized Dashboard & Reporting',
      'Location Performance Comparison',
      'Consolidated Financial Reporting',
      'Inter-location Stock Transfers',
      'Franchise Management Tools',
      'Brand Consistency Controls'
    ],
    benefits: [
      'Reduce operational costs by 20%',
      'Improve location performance visibility',
      'Standardize operations across locations',
      'Accelerate expansion planning'
    ],
    testimonial: {
      name: 'David Chen',
      role: 'Operations Director',
      company: 'Coffee Culture Chain',
      content: 'With 15 locations, BizPilot gave us the visibility and control we needed. We can now make data-driven decisions across all stores.',
      rating: 5
    }
  },
  {
    icon: Coffee,
    title: 'Coffee Shops & Bakeries',
    description: 'Specialized features for coffee shops and bakery operations',
    image: '/api/placeholder/600/400',
    features: [
      'Recipe Management & Costing',
      'Fresh Product Tracking',
      'Loyalty Card Integration',
      'Mobile Ordering & Pickup',
      'Waste Tracking & Reporting',
      'Supplier Integration'
    ],
    benefits: [
      'Optimize ingredient usage',
      'Reduce daily waste by 30%',
      'Increase customer loyalty',
      'Streamline morning rush operations'
    ],
    testimonial: {
      name: 'Emma Thompson',
      role: 'Owner',
      company: 'The Daily Grind',
      content: 'The recipe costing feature helped us price our specialty drinks correctly. We increased our profit margin by 22% while staying competitive.',
      rating: 5
    }
  },
  {
    icon: Hotel,
    title: 'Hotels & Hospitality',
    description: 'Integrated POS and property management for hospitality businesses',
    image: '/api/placeholder/600/400',
    features: [
      'PMS Integration',
      'Room Service Management',
      'Guest Profile Management',
      'Event & Banquet Management',
      'Multi-outlet Reporting',
      'Guest Billing Integration'
    ],
    benefits: [
      'Streamline guest experience',
      'Integrate F&B with room charges',
      'Improve service efficiency',
      'Enhance guest satisfaction'
    ],
    testimonial: {
      name: 'James Wilson',
      role: 'General Manager',
      company: 'Grand Plaza Hotel',
      content: 'BizPilot seamlessly integrated with our PMS. Guest billing is now automated and our F&B revenue increased by 15%.',
      rating: 5
    }
  },
  {
    icon: Store,
    title: 'Specialty Retail',
    description: 'Tailored solutions for specialty retail businesses',
    image: '/api/placeholder/600/400',
    features: [
      'Product Variant Management',
      'Seasonal Inventory Planning',
      'Customer Special Orders',
      'Consignment Management',
      'Repair & Service Tracking',
      'Vendor Management'
    ],
    benefits: [
      'Manage complex product catalogs',
      'Optimize seasonal buying',
      'Track special orders efficiently',
      'Improve vendor relationships'
    ],
    testimonial: {
      name: 'Lisa Rodriguez',
      role: 'Owner',
      company: 'Artisan Crafts',
      content: 'The consignment management feature was exactly what we needed. We can now track artist inventory and payments automatically.',
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
            Built for Your Industry
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            BizPilot adapts to your specific industry needs with specialized features and workflows designed to maximize efficiency and profitability.
          </p>
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

                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Key Features</h3>
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

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
            Ready to Transform Your Industry?
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-up animation-delay-100">
            Join businesses in your industry who are already using BizPilot to increase efficiency and profitability.
          </p>
          <div className="animate-fade-in-up animation-delay-200">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 group hover:scale-105 hover:-translate-y-0.5"
            >
              Start Your Free Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}