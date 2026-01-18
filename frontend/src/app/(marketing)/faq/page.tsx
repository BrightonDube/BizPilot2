import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { FAQAccordion } from '@/components/marketing/FAQAccordion'
import { AIPrivacyControl, AIContentCallout } from '@/components/marketing/AIMessagingComponents'

export const metadata: Metadata = {
  title: 'FAQ - AI-Powered Business Management Questions',
  description: 'Find answers to common questions about BizPilot&apos;s AI-powered business management features, data privacy, user control, intelligent automation, pricing, and implementation. Get the information you need about our secure, user-controlled AI solutions.',
  keywords: ['BizPilot FAQ', 'AI business management questions', 'AI privacy protection', 'user-controlled AI', 'intelligent automation support', 'AI-powered POS system', 'predictive analytics questions', 'smart business insights'],
}

const faqCategories = [
  {
    title: 'Getting Started with AI-Powered Business Management',
    faqs: [
      {
        question: 'How quickly can I get started with BizPilot&apos;s AI-powered platform?',
        answer: 'You can be up and running in under 10 minutes with our intelligent setup wizard. Simply sign up for your free trial, and our AI assistant will guide you through personalized configuration based on your business type. Our onboarding team provides AI-enhanced support to ensure smooth implementation with smart recommendations tailored to your industry.'
      },
      {
        question: 'Do I need any special hardware for the AI features?',
        answer: 'BizPilot&apos;s AI capabilities work on any device with a web browser - computers, tablets, or smartphones. Our intelligent system adapts to your hardware automatically. For optimal AI-powered POS experience, we recommend tablets with barcode scanners and receipt printers, but you can start with just your existing devices and let our AI optimize performance.'
      },
      {
        question: 'Can I import my existing data for AI analysis?',
        answer: 'Yes! We provide free AI-assisted data migration services that intelligently map your products, customers, and inventory from most POS systems. Our AI analyzes your historical data to provide immediate insights and recommendations from day one. The migration process ensures zero downtime while preparing your data for intelligent automation and predictive analytics.'
      },
      {
        question: 'Do I need technical expertise to use BizPilot\'s AI features?',
        answer: 'No technical expertise required! BizPilot\'s AI works automatically in the background, providing easy-to-understand insights and recommendations through our intuitive interface. The system is designed for business owners, not data scientists. Setup is simple, and our support team helps you configure AI settings to match your business needs perfectly.'
      }
    ]
  },
  {
    title: 'AI Privacy & Data Control',
    faqs: [
      {
        question: 'How does BizPilot\'s AI protect my business data privacy?',
        answer: 'Your data privacy is our top priority. All AI processing happens with your explicit consent, data is encrypted both in transit and at rest, and we never share your business information with third parties. You maintain complete ownership of your data and can export or delete it at any time. Our AI models are trained on anonymized, aggregated data patterns - never on your specific business information.'
      },
      {
        question: 'Can I control what the AI does in my business?',
        answer: 'Absolutely! You have complete control over AI behavior in BizPilot. You can set custom thresholds, override any AI recommendation, choose which processes to automate, and adjust AI sensitivity levels. The AI provides intelligent suggestions and insights - you always make the final decisions. You can also turn off AI features entirely if you prefer manual control.'
      },
      {
        question: 'What happens to my data if I cancel my subscription?',
        answer: 'You can cancel anytime with no penalties and retain all your AI-generated insights. We provide full data export including AI analysis results in standard formats, ensuring you retain complete ownership of your business data and intelligent recommendations. Our team assists with smooth transitions while preserving your AI-powered insights and maintaining data privacy throughout the process.'
      },
      {
        question: 'How does the AI learn about my business without compromising privacy?',
        answer: 'The AI learns from your business data patterns including sales history, inventory movements, customer behavior, and seasonal trends. All learning happens locally within your BizPilot instance - we don\'t share your data with other businesses or use it to train general models. The more you use the system, the more accurate and personalized the AI becomes for your specific business while maintaining complete privacy.'
      }
    ]
  },
  {
    title: 'AI Features & Smart Automation',
    faqs: [
      {
        question: 'What AI capabilities does BizPilot offer?',
        answer: 'BizPilot offers comprehensive AI capabilities including predictive inventory management, intelligent pricing optimization, customer behavior analysis, demand forecasting, automated reordering suggestions, and smart business insights. Our AI learns from your business patterns to provide increasingly accurate recommendations while always keeping you in control of final decisions.'
      },
      {
        question: 'How accurate are BizPilot\'s AI predictions?',
        answer: 'Our AI predictions typically achieve 85-95% accuracy for inventory forecasting and 80-90% for demand prediction, improving over time as the system learns your business patterns. Accuracy varies by business type and data quality. The system provides confidence scores with each prediction, and you can always override predictions with your business knowledge and local market insights.'
      },
      {
        question: 'How does BizPilot\'s AI work offline?',
        answer: 'Our mobile POS app includes offline AI capabilities that continue to provide smart recommendations and automated processes even without internet. All AI-generated insights and transactions are stored locally and sync when connection is restored, ensuring continuous intelligent operation. Critical AI functions like inventory alerts and pricing recommendations work seamlessly offline.'
      },
      {
        question: 'Can the AI manage multiple locations intelligently?',
        answer: 'Absolutely. BizPilot\'s AI provides intelligent multi-location management with predictive analytics, automated inventory optimization across locations, performance comparison with AI insights, and smart recommendations for maintaining brand consistency from a unified dashboard. The AI learns patterns specific to each location while optimizing overall operations.'
      },
      {
        question: 'What are the main benefits of using AI in my business?',
        answer: 'AI helps you save time, reduce costs, and increase profits by automating routine tasks, providing predictive insights, and optimizing business processes. Typical benefits include 70% reduction in stockouts, 20% increase in profit margins, 80% less time spent on inventory management, and better decision-making through data-driven insights that you control and customize.'
      }
    ]
  },
  {
    title: 'AI-Powered Pricing & Plans',
    faqs: [
      {
        question: 'Can I try the AI features before committing to a paid plan?',
        answer: 'Yes! Our Starter plan includes basic AI features like smart analytics and AI-powered inventory tracking at no cost. This lets you experience how AI can benefit your business before upgrading to more advanced features. You can also schedule a demo to see all AI capabilities in action and understand how they apply to your specific business needs.'
      },
      {
        question: 'Is there a free trial for advanced AI features?',
        answer: 'Yes, we offer a 14-day free trial with full access to all AI-powered features including predictive analytics, intelligent pricing optimization, and automated inventory management. No credit card required to start. You can test everything including intelligent POS recommendations, AI-driven insights, and smart integrations to experience the full power of AI automation.'
      },
      {
        question: 'Can I change plans as my AI needs grow?',
        answer: 'Absolutely. You can upgrade or downgrade your plan at any time as your AI automation needs evolve. Our intelligent system recommends the optimal plan based on your usage patterns and business growth. Changes take effect immediately, and you only pay for what you use. No long-term contracts or cancellation fees - just flexible AI-powered solutions that scale with you.'
      },
      {
        question: 'Are there any setup fees for AI features?',
        answer: 'No hidden fees ever. Our transparent pricing includes all AI capabilities with no setup costs, no transaction fees for AI processing, and no additional charges for AI updates or intelligent support. What you see is what you pay, with full AI power included. We believe in honest pricing that lets you focus on growing your business.'
      },
      {
        question: 'Do you offer discounts for AI-powered annual billing?',
        answer: 'Yes, save 20% when you pay annually for full AI access. We also offer custom enterprise pricing for large organizations wanting advanced AI features and franchise groups needing intelligent multi-location management. Contact our sales team for AI-focused volume discounts and custom solutions tailored to your business needs.'
      }
    ]
  },
  {
    title: 'AI Integration & Support',
    faqs: [
      {
        question: 'What AI-powered payment features are supported?',
        answer: 'Our AI enhances all payment methods including smart fraud detection for credit/debit cards, intelligent payment routing for mobile payments (Apple Pay, Google Pay), automated reconciliation for EFT and cash, and predictive payment analytics. Integration with local providers like Yoco, SnapScan, and Netcash includes AI-powered transaction optimization and anomaly detection.'
      },
      {
        question: 'How does AI integration work with accounting software?',
        answer: 'Our AI provides intelligent integrations with Xero, Sage, and other accounting systems. Beyond automatic syncing, our AI categorizes transactions, detects anomalies, suggests optimizations, and provides predictive financial insights, eliminating manual work while ensuring accurate, intelligent financial management with full audit trails.'
      },
      {
        question: 'What kind of AI-enhanced support do you provide?',
        answer: '24/7 intelligent support via chat, email, and phone with AI-powered issue resolution. Our support team uses AI tools to understand your business needs and provide personalized solutions. We also provide free AI-assisted onboarding, intelligent training recommendations, and smart data migration services with dedicated success managers.'
      },
      {
        question: 'Do you provide regular AI feature updates?',
        answer: 'Yes, we continuously improve BizPilot with regular AI enhancements and new intelligent features. All AI updates are automatic and included in your subscription at no additional cost. You always have access to the latest AI capabilities, with our system learning and improving continuously based on anonymized usage patterns and industry best practices.'
      }
    ]
  },
  {
    title: 'Industry-Specific AI Solutions',
    faqs: [
      {
        question: 'Is BizPilot\'s AI suitable for restaurants and food service?',
        answer: 'Absolutely! We have specialized AI features for restaurants including intelligent table management, smart kitchen optimization, AI-powered menu engineering, automated recipe costing, predictive demand forecasting for ingredients, and intelligent integration with delivery platforms. Perfect for cafes, restaurants, and food service businesses wanting AI-driven efficiency and waste reduction.'
      },
      {
        question: 'Can retail stores benefit from BizPilot\'s AI?',
        answer: 'Yes, BizPilot\'s AI is perfect for retail with intelligent barcode scanning, smart layby management, AI-powered e-commerce integration, predictive multi-location inventory, automated pricing optimization, and intelligent customer loyalty programs. Ideal for fashion, electronics, and specialty retail wanting AI-driven insights, automated reordering, and customer behavior analysis.'
      },
      {
        question: 'What about AI for service-based businesses?',
        answer: 'BizPilot\'s AI works excellently for service businesses with intelligent appointment scheduling, smart service tracking, AI-powered customer management, automated invoicing with predictive insights, and resource optimization. Perfect for salons, repair shops, consulting firms, and professional services wanting intelligent automation and customer relationship management.'
      },
      {
        question: 'Do you support AI-powered franchise operations?',
        answer: 'Yes, we specialize in AI-enhanced franchise management with intelligent centralized control, automated performance comparison with AI insights, smart brand consistency tools, predictive analytics across locations, and AI-powered consolidated reporting. Many franchise groups trust BizPilot\'s AI for intelligent multi-location operations and predictive business insights that maintain brand standards.'
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
            Find answers to common questions about BizPilot&apos;s AI-powered features, intelligent automation, privacy protection, and user control. Can&apos;t find what you&apos;re looking for? Contact our support team.
          </p>
        </div>
      </section>

      {/* AI Privacy & Control Assurance */}
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
            Ready to Experience AI-Powered Business Management?
          </h2>
          <p className="text-xl text-gray-400 mb-8 animate-fade-in-delay">
            Our AI-enhanced support team is here to help. Get personalized answers and see BizPilot&apos;s intelligent automation in action with a free demo. Experience how AI can transform your business while keeping you in complete control.
          </p>
          
          {/* AI Benefits Highlight */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 animate-fade-in-delay">
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-lg font-semibold text-white mb-2">Intelligent Automation</h3>
              <p className="text-gray-400 text-sm">Let AI handle routine tasks while you focus on strategic decisions</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="text-3xl mb-3">🎛️</div>
              <h3 className="text-lg font-semibold text-white mb-2">You&apos;re in Control</h3>
              <p className="text-gray-400 text-sm">Customize AI behavior and override any recommendation</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-lg font-semibold text-white mb-2">Privacy Protected</h3>
              <p className="text-gray-400 text-sm">Your data stays private with bank-level security</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-delay-2">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-105 group"
            >
              Start Free AI Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a 
              href="mailto:support@bizpilot.com" 
              className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-lg border border-slate-600 text-white hover:border-purple-500/50 hover:bg-slate-800/50 transition-all hover:scale-105"
            >
              Contact AI Support
            </a>
          </div>
        </div>
      </section>
    </>
  )
}