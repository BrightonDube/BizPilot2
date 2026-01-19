import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { FAQAccordion } from '@/components/marketing/FAQAccordion'
import { AIPrivacyControl, AIContentCallout } from '@/components/marketing/AIMessagingComponents'
import HeroStarsBackground from '@/components/home/HeroStarsBackground'

export const metadata: Metadata = {
  title: 'FAQ - Business Management Questions & Answers',
  description: 'Find answers to common questions about BizPilot&apos;s comprehensive business management platform, smart features, data privacy, pricing, and implementation. Get the information you need about our secure, user-controlled business solutions.',
  keywords: ['BizPilot FAQ', 'business management questions', 'POS system support', 'inventory management help', 'smart features', 'data privacy protection', 'business automation', 'pricing questions'],
}

const faqCategories = [
  {
    title: 'Getting Started with BizPilot',
    faqs: [
      {
        question: 'How quickly can I get started with BizPilot?',
        answer: 'You can be up and running in under 10 minutes with our guided setup wizard. Simply sign up for your free trial, and our system will walk you through personalized configuration based on your business type. Our onboarding team provides comprehensive support to ensure smooth implementation with recommendations tailored to your industry.'
      },
      {
        question: 'Do I need any special hardware to use BizPilot?',
        answer: 'BizPilot works on any device with a web browser - computers, tablets, or smartphones. The system adapts to your hardware automatically. For optimal POS experience, we recommend tablets with barcode scanners and receipt printers, but you can start with just your existing devices and upgrade as needed.'
      },
      {
        question: 'Can I import my existing business data?',
        answer: 'Yes! We provide free data migration services that help you transfer your products, customers, and inventory from most POS systems. Our migration process analyzes your historical data to provide immediate insights and recommendations from day one. The migration ensures zero downtime while preparing your data for enhanced analytics.'
      },
      {
        question: 'Do I need technical expertise to use BizPilot?',
        answer: 'No technical expertise required! BizPilot is designed for business owners, not IT specialists. The system works intuitively in the background, providing easy-to-understand insights and recommendations through our user-friendly interface. Setup is simple, and our support team helps you configure settings to match your business needs perfectly.'
      },
      {
        question: 'What makes BizPilot different from other business management systems?',
        answer: 'BizPilot combines comprehensive business management with intelligent features that learn and adapt to your specific business patterns. Unlike basic POS systems, we offer complete inventory management, customer relationship tools, financial reporting, and smart automation - all in one integrated platform that grows with your business.'
      }
    ]
  },
  {
    title: 'Core Business Features',
    faqs: [
      {
        question: 'What business functions does BizPilot manage?',
        answer: 'BizPilot is a complete business management platform covering point of sale, inventory management, customer relationships, financial reporting, staff management, and multi-location operations. Smart features enhance these core functions with automated insights, predictive analytics, and intelligent recommendations to help you make better business decisions.'
      },
      {
        question: 'How does inventory management work in BizPilot?',
        answer: 'Our comprehensive inventory system tracks stock levels across all locations, manages suppliers and purchase orders, handles product variations and bundles, and provides detailed cost analysis. Smart features add automated reorder suggestions, demand forecasting, and waste reduction insights to help optimize your inventory investment.'
      },
      {
        question: 'Can BizPilot handle multiple business locations?',
        answer: 'Absolutely! BizPilot excels at multi-location management with centralized control, real-time inventory sync across locations, consolidated reporting and analytics, and location-specific performance tracking. Smart features provide cross-location insights and optimization recommendations while maintaining individual location control.'
      },
      {
        question: 'What payment methods and integrations are supported?',
        answer: 'BizPilot supports all major payment methods including credit/debit cards, mobile payments (Apple Pay, Google Pay), EFT, and cash transactions. We integrate seamlessly with local South African providers like Yoco, SnapScan, and Netcash, plus international gateways. Smart features add fraud detection and payment optimization.'
      },
      {
        question: 'How does customer management work?',
        answer: 'Our comprehensive CRM tracks customer purchase history, manages loyalty programs, handles customer communications, and provides detailed customer analytics. Smart features enhance this with customer behavior insights, personalized recommendations, and automated marketing suggestions to help increase customer lifetime value.'
      }
    ]
  },
  {
    title: 'Smart Features & Automation',
    faqs: [
      {
        question: 'What smart features does BizPilot offer?',
        answer: 'BizPilot includes intelligent inventory management with automated reorder suggestions, smart pricing optimization based on costs and market data, predictive analytics for demand forecasting, customer behavior insights, and automated reporting. These features learn from your business patterns to provide increasingly helpful recommendations while keeping you in complete control.'
      },
      {
        question: 'How accurate are the smart suggestions and predictions?',
        answer: 'Our smart features typically achieve high accuracy rates that improve over time as the system learns your specific business patterns. Accuracy varies by business type and data quality, but most customers see 85-95% accuracy for inventory forecasting. The system provides confidence indicators with each suggestion, and you can always override recommendations with your business knowledge.'
      },
      {
        question: 'Can I control the automation and smart features?',
        answer: 'Absolutely! You have complete control over all smart features in BizPilot. You can set custom thresholds and rules, override any suggestion or automation, choose which processes to automate, and adjust sensitivity levels. Smart features provide helpful recommendations - you always make the final decisions and can disable any feature you prefer to handle manually.'
      },
      {
        question: 'How do the smart features learn about my business?',
        answer: 'The smart features analyze your business data patterns including sales history, inventory movements, customer behavior, seasonal trends, and supplier performance. All learning happens within your BizPilot instance - we never share your data with other businesses. The more you use the system, the more personalized and accurate the suggestions become for your specific business.'
      },
      {
        question: 'Do smart features work offline?',
        answer: 'Yes! Our mobile POS app includes offline capabilities that continue to provide smart recommendations and automated processes even without internet connection. All transactions and insights are stored locally and sync when connection is restored, ensuring continuous operation. Critical functions like inventory alerts and pricing recommendations work seamlessly offline.'
      }
    ]
  },
  {
    title: 'Data Privacy & Security',
    faqs: [
      {
        question: 'How does BizPilot protect my business data?',
        answer: 'Your data privacy and security are our top priorities. All data is encrypted both in transit and at rest using bank-level security protocols. We never share your business information with third parties or use it to train general models. You maintain complete ownership of your data and can export or delete it at any time with full audit trails.'
      },
      {
        question: 'Who has access to my business data?',
        answer: 'Only you and authorized users in your organization have access to your business data. Our support team can only access your data with your explicit permission for troubleshooting purposes. Smart features process your data locally within your BizPilot instance, and we maintain strict access controls and monitoring to ensure data privacy.'
      },
      {
        question: 'What happens to my data if I cancel my subscription?',
        answer: 'You can cancel anytime with no penalties and retain complete ownership of your data. We provide full data export in standard formats including all historical data, reports, and insights. Your data remains accessible for export for 90 days after cancellation, and we permanently delete it only upon your request or after the retention period.'
      },
      {
        question: 'Is BizPilot compliant with data protection regulations?',
        answer: 'Yes, BizPilot is fully compliant with GDPR, POPIA (South African data protection), and other major data protection regulations. We implement privacy by design principles, provide customer consent management tools, support data subject rights including right to be forgotten, and maintain comprehensive audit trails for compliance reporting.'
      },
      {
        question: 'How secure are the smart features and automation?',
        answer: 'All smart features operate with the same high security standards as our core platform. Automated processes include built-in safeguards and approval workflows for critical actions. You can set security levels for different types of automation, require manual approval for sensitive operations, and maintain full audit logs of all automated actions.'
      }
    ]
  },
  {
    title: 'Pricing & Plans',
    faqs: [
      {
        question: 'Can I try BizPilot before committing to a paid plan?',
        answer: 'Yes! Our Starter plan includes core business management features plus basic smart features like analytics and inventory tracking at no cost. This lets you experience how BizPilot can benefit your business before upgrading. We also offer a 14-day free trial of advanced features with no credit card required.'
      },
      {
        question: 'What\'s included in each pricing plan?',
        answer: 'All plans include core POS functionality, inventory management, customer management, and basic reporting. Higher tiers add advanced smart features like predictive analytics, automated optimization, multi-location management, and enhanced integrations. Smart features are included at appropriate levels - not charged separately.'
      },
      {
        question: 'Can I change plans as my business grows?',
        answer: 'Absolutely! You can upgrade or downgrade your plan at any time as your business needs evolve. The system recommends optimal plans based on your usage patterns and business growth. Changes take effect immediately, and you only pay for what you use. No long-term contracts or cancellation fees - just flexible solutions that scale with you.'
      },
      {
        question: 'Are there any setup fees or hidden costs?',
        answer: 'No hidden fees ever! Our transparent pricing includes all features, smart capabilities, updates, and standard support with no setup costs, no transaction fees, and no additional charges for software updates or basic integrations. What you see is what you pay, with full feature access included in your plan.'
      },
      {
        question: 'Do you offer discounts for annual billing?',
        answer: 'Yes, save 20% when you pay annually for any plan. We also offer custom enterprise pricing for large organizations and franchise groups needing advanced multi-location management. Contact our sales team for volume discounts and custom solutions tailored to your specific business requirements.'
      }
    ]
  },
  {
    title: 'Integration & Support',
    faqs: [
      {
        question: 'What accounting software does BizPilot integrate with?',
        answer: 'BizPilot integrates seamlessly with major accounting systems including Xero, Sage, QuickBooks, and other popular platforms. Beyond automatic data syncing, our smart features provide intelligent transaction categorization, anomaly detection, and financial insights to eliminate manual work while ensuring accurate, comprehensive financial management.'
      },
      {
        question: 'How does integration with payment providers work?',
        answer: 'We support all major payment providers including local South African services like Yoco, SnapScan, and Netcash, plus international gateways like Stripe and PayPal. Integration includes automatic transaction reconciliation, smart fraud detection, payment optimization suggestions, and comprehensive reporting across all payment methods.'
      },
      {
        question: 'What kind of support do you provide?',
        answer: '24/7 comprehensive support via chat, email, and phone with knowledgeable support staff who understand your business needs. We provide free onboarding assistance, training resources, data migration services, and ongoing optimization recommendations. Our support team uses smart tools to quickly understand and resolve your specific issues.'
      },
      {
        question: 'Do you provide training and onboarding?',
        answer: 'Yes! We provide comprehensive onboarding including personalized setup assistance, staff training sessions, best practices guidance, and ongoing optimization recommendations. Our training covers both core features and smart capabilities, ensuring your team can maximize BizPilot\'s benefits from day one.'
      },
      {
        question: 'How often do you release updates and new features?',
        answer: 'We continuously improve BizPilot with regular updates and new features, all included in your subscription at no additional cost. Updates include both core functionality improvements and enhanced smart features. You always have access to the latest capabilities, with our system learning and improving continuously based on industry best practices.'
      }
    ]
  },
  {
    title: 'Industry-Specific Solutions',
    faqs: [
      {
        question: 'Is BizPilot suitable for restaurants and food service?',
        answer: 'Absolutely! We have specialized features for restaurants including table management, kitchen order tracking, menu engineering tools, recipe costing, ingredient inventory management, and staff scheduling. Smart features add demand forecasting for ingredients, waste reduction insights, and menu optimization recommendations perfect for cafes, restaurants, and food service businesses.'
      },
      {
        question: 'Can retail stores benefit from BizPilot?',
        answer: 'Yes, BizPilot is perfect for retail with comprehensive inventory management, barcode scanning, layby management, e-commerce integration, multi-location support, and customer loyalty programs. Smart features add demand forecasting, pricing optimization, customer behavior analysis, and automated reordering - ideal for fashion, electronics, and specialty retail businesses.'
      },
      {
        question: 'What about service-based businesses?',
        answer: 'BizPilot works excellently for service businesses with appointment scheduling, service tracking, customer management, automated invoicing, and resource optimization. Smart features provide scheduling optimization, customer insights, and business performance analytics perfect for salons, repair shops, consulting firms, and professional services wanting comprehensive business management.'
      },
      {
        question: 'Do you support franchise operations?',
        answer: 'Yes, we specialize in franchise management with centralized control systems, automated performance comparison, brand consistency tools, consolidated reporting across locations, and standardized operations management. Smart features add cross-location analytics and optimization recommendations that help franchise groups maintain standards while maximizing performance.'
      },
      {
        question: 'Can BizPilot handle manufacturing and wholesale businesses?',
        answer: 'Absolutely! BizPilot supports manufacturing and wholesale with production planning, supply chain management, bulk inventory handling, wholesale pricing tiers, and B2B customer management. Smart features add production optimization, predictive maintenance alerts, and supply chain analytics perfect for manufacturers and wholesale distributors.'
      }
    ]
  }
]

export default function FAQPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-slate-950 min-h-[60vh] flex items-center">
        <HeroStarsBackground />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-delay">
            Find answers to common questions about BizPilot&apos;s comprehensive business management platform, smart features, data privacy, and implementation. Can&apos;t find what you&apos;re looking for? Contact our support team.
          </p>
        </div>
      </section>

      {/* Privacy & Control Assurance */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto">
          <AIPrivacyControl 
            showBoth={true} 
            emphasis="both"
            className="animate-fade-in"
          />
          
          <div className="mt-12 text-center">
            <AIContentCallout 
              componentId="privacy-assurance"
              variant="highlighted"
              className="animate-fade-in-delay"
            />
          </div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {faqCategories.map((category, categoryIndex) => (
              <div 
                key={categoryIndex}
                className={`relative animate-slide-up p-8 rounded-2xl border ${
                  categoryIndex % 2 === 0 
                    ? 'bg-slate-900/50 border-slate-700' 
                    : 'bg-gradient-to-br from-slate-900/30 to-slate-800/30 border-slate-600'
                }`}
                style={{ animationDelay: `${categoryIndex * 0.1}s` }}
              >
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
                  {category.title}
                </h2>

                <FAQAccordion faqs={category.faqs} categoryIndex={categoryIndex} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in">
            Ready to Experience Complete Business Management?
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-delay">
            Our comprehensive support team is here to help. Get personalized answers and see BizPilot&apos;s complete business management platform in action with a free demo. Experience how smart features can enhance your business while keeping you in complete control.
          </p>
          
          {/* Business Benefits Highlight */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 animate-fade-in-delay">
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="text-lg font-semibold text-white mb-2">Complete Business Suite</h3>
              <p className="text-gray-400 text-sm">POS, inventory, CRM, and reporting all in one platform</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="text-3xl mb-3">🎛️</div>
              <h3 className="text-lg font-semibold text-white mb-2">Smart Automation</h3>
              <p className="text-gray-400 text-sm">Intelligent features that enhance your business decisions</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-lg font-semibold text-white mb-2">Secure & Private</h3>
              <p className="text-gray-400 text-sm">Your data stays private with bank-level security</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-delay-2">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-105 group"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact?topic=support"
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-purple-500/50 hover:bg-slate-800/50 transition-all hover:scale-105"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}