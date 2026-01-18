import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { FAQAccordion } from '@/components/marketing/FAQAccordion'

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about BizPilot&apos;s AI-powered business management features, pricing, implementation, and support. Get the information you need to make an informed decision.',
  keywords: ['BizPilot FAQ', 'business management questions', 'POS system help', 'AI automation support', 'pricing questions'],
}

const faqCategories = [
  {
    title: 'Getting Started',
    faqs: [
      {
        question: 'How quickly can I get started with BizPilot&apos;s AI-powered platform?',
        answer: 'You can be up and running in under 10 minutes with our intelligent setup wizard. Simply sign up for your free trial, and our AI assistant will guide you through personalized configuration based on your business type. Our onboarding team provides AI-enhanced support to ensure smooth implementation with smart recommendations.'
      },
      {
        question: 'Do I need any special hardware for the AI features?',
        answer: 'BizPilot&apos;s AI capabilities work on any device with a web browser - computers, tablets, or smartphones. Our intelligent system adapts to your hardware automatically. For optimal AI-powered POS experience, we recommend tablets with barcode scanners and receipt printers, but you can start with just your existing devices.'
      },
      {
        question: 'Can I import my existing data for AI analysis?',
        answer: 'Yes! We provide free AI-assisted data migration services that intelligently map your products, customers, and inventory from most POS systems. Our AI analyzes your historical data to provide immediate insights and recommendations. The migration process ensures zero downtime while preparing your data for intelligent automation.'
      },
      {
        question: 'Is training provided for the AI features?',
        answer: 'Absolutely. We offer comprehensive AI-focused training including interactive tutorials, live webinars, and personalized sessions. Our AI system learns your preferences and provides contextual guidance. Your team will be fully trained on both basic operations and advanced AI features before going live, with 24/7 intelligent support available.'
      }
    ]
  },
  {
    title: 'AI Features & Smart Automation',
    faqs: [
      {
        question: 'How does BizPilot\'s AI work offline?',
        answer: 'Our mobile POS app includes offline AI capabilities that continue to provide smart recommendations and automated processes even without internet. All AI-generated insights and transactions are stored locally and sync when connection is restored, ensuring continuous intelligent operation.'
      },
      {
        question: 'Can the AI manage multiple locations intelligently?',
        answer: 'Absolutely. BizPilot\'s AI provides intelligent multi-location management with predictive analytics, automated inventory optimization across locations, performance comparison with AI insights, and smart recommendations for maintaining brand consistency from a unified dashboard.'
      },
      {
        question: 'What AI-powered payment features are supported?',
        answer: 'Our AI enhances all payment methods including smart fraud detection for credit/debit cards, intelligent payment routing for mobile payments (Apple Pay, Google Pay), automated reconciliation for EFT and cash, and predictive payment analytics. Integration with local providers like Yoco, SnapScan, and Netcash includes AI-powered transaction optimization.'
      },
      {
        question: 'How does AI integration work with accounting software?',
        answer: 'Our AI provides intelligent integrations with Xero, Sage, and other accounting systems. Beyond automatic syncing, our AI categorizes transactions, detects anomalies, suggests optimizations, and provides predictive financial insights, eliminating manual work while ensuring accurate, intelligent financial management.'
      }
    ]
  },
  {
    title: 'Pricing & AI-Powered Plans',
    faqs: [
      {
        question: 'Is there a free trial for AI features?',
        answer: 'Yes, we offer a 14-day free trial with full access to all AI-powered features. No credit card required to start. You can test everything including intelligent POS recommendations, AI-driven inventory management, predictive reporting, and smart integrations to experience the power of AI automation.'
      },
      {
        question: 'Can I change plans as my AI needs grow?',
        answer: 'Absolutely. You can upgrade or downgrade your plan at any time as your AI automation needs evolve. Our intelligent system recommends the optimal plan based on your usage patterns. Changes take effect immediately, and you only pay for what you use. No long-term contracts or cancellation fees.'
      },
      {
        question: 'Are there any setup fees for AI features?',
        answer: 'No hidden fees ever. Our transparent pricing includes all AI capabilities with no setup costs, no transaction fees for AI processing, and no additional charges for AI updates or intelligent support. What you see is what you pay, with full AI power included.'
      },
      {
        question: 'Do you offer discounts for AI-powered annual billing?',
        answer: 'Yes, save 20% when you pay annually for full AI access. We also offer custom enterprise pricing for large organizations wanting advanced AI features and franchise groups needing intelligent multi-location management. Contact our sales team for AI-focused volume discounts.'
      }
    ]
  },
  {
    title: 'AI Security & Smart Support',
    faqs: [
      {
        question: 'What kind of AI-enhanced support do you provide?',
        answer: '24/7 intelligent support via chat, email, and phone with AI-powered issue resolution. Our support team uses AI tools to understand your business needs and provide personalized solutions. We also provide free AI-assisted onboarding, intelligent training recommendations, and smart data migration services.'
      },
      {
        question: 'Is my data secure with AI processing?',
        answer: 'Absolutely. We use bank-level encryption for all AI processing, secure cloud hosting with intelligent threat detection, and comply with all data protection regulations. Your data is processed by AI with complete privacy protection, backed up multiple times daily, and stored in secure, geographically distributed data centers with AI-powered security monitoring.'
      },
      {
        question: 'What happens to my AI insights if I cancel?',
        answer: 'You can cancel anytime with no penalties and retain all your AI-generated insights. We provide full data export including AI analysis results in standard formats, ensuring you retain complete ownership of your business data and intelligent recommendations. Our team assists with smooth transitions while preserving your AI-powered insights.'
      },
      {
        question: 'Do you provide regular AI feature updates?',
        answer: 'Yes, we continuously improve BizPilot with regular AI enhancements and new intelligent features. All AI updates are automatic and included in your subscription at no additional cost. You always have access to the latest AI capabilities, with our system learning and improving continuously.'
      }
    ]
  },
  {
    title: 'Industry-Specific AI Solutions',
    faqs: [
      {
        question: 'Is BizPilot\'s AI suitable for restaurants?',
        answer: 'Absolutely! We have specialized AI features for restaurants including intelligent table management, smart kitchen optimization, AI-powered menu engineering, automated recipe costing, and intelligent integration with delivery platforms. Perfect for cafes, restaurants, and food service businesses wanting AI-driven efficiency.'
      },
      {
        question: 'Can retail stores benefit from BizPilot\'s AI?',
        answer: 'Yes, BizPilot\'s AI is perfect for retail with intelligent barcode scanning, smart layby management, AI-powered e-commerce integration, predictive multi-location inventory, and intelligent customer loyalty programs. Ideal for fashion, electronics, and specialty retail wanting AI-driven insights and automation.'
      },
      {
        question: 'What about AI for service-based businesses?',
        answer: 'BizPilot\'s AI works excellently for service businesses with intelligent appointment scheduling, smart service tracking, AI-powered customer management, and automated invoicing with predictive insights. Perfect for salons, repair shops, consulting firms, and professional services wanting intelligent automation.'
      },
      {
        question: 'Do you support AI-powered franchise operations?',
        answer: 'Yes, we specialize in AI-enhanced franchise management with intelligent centralized control, automated performance comparison with AI insights, smart brand consistency tools, and AI-powered consolidated reporting. Many franchise groups trust BizPilot\'s AI for intelligent multi-location operations and predictive business insights.'
      }
    ]
  }
]

export default function FAQPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in-delay">
            Find answers to common questions about BizPilot&apos;s AI-powered features, intelligent automation, pricing, and implementation. Can&apos;t find what you&apos;re looking for? Contact our support team.
          </p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {faqCategories.map((category, categoryIndex) => (
              <div 
                key={categoryIndex}
                className="relative animate-slide-up"
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in">
            Still Have Questions?
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-delay">
            Our AI-enhanced support team is here to help. Get personalized answers and see BizPilot&apos;s intelligent automation in action with a free demo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-delay-2">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-105 group"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a 
              href="mailto:support@bizpilot.com" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-purple-500/50 hover:bg-slate-800/50 transition-all hover:scale-105"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>
    </>
  )
}