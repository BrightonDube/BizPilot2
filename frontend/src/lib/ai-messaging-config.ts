/**
 * AI Messaging Configuration
 * 
 * This file contains centralized AI messaging content, taglines, and reusable
 * AI-focused content components for BizPilot's marketing pages. It provides
 * consistent messaging about AI capabilities, user control, and privacy protection.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

// Core AI messaging interface
export interface AIMessaging {
  heroTagline: string;
  subTagline: string;
  keyBenefits: string[];
  privacyMessage: string;
  controlMessage: string;
  automationBenefits: string[];
  trustFactors: string[];
  valuePropositions: AIValueProposition[];
}

// AI value proposition for different contexts
export interface AIValueProposition {
  title: string;
  description: string;
  icon: string;
  benefits: string[];
  context: 'features' | 'industries' | 'pricing' | 'faq' | 'home';
}

// AI capability description for features
export interface AICapability {
  name: string;
  shortDescription: string;
  detailedDescription: string;
  userControlAspects: string[];
  privacyFeatures: string[];
  businessBenefits: string[];
  technicalFeatures: string[];
}

// Industry-specific AI use case
export interface AIIndustryUseCase {
  industry: string;
  title: string;
  description: string;
  aiCapabilities: string[];
  automationBenefits: string[];
  controlFeatures: string[];
  realWorldExample: string;
}

// FAQ about AI features
export interface AIFAQ {
  question: string;
  answer: string;
  category: 'privacy' | 'control' | 'capabilities' | 'implementation' | 'benefits';
  relatedFeatures: string[];
}

/**
 * Core AI messaging configuration
 */
export const AI_MESSAGING: AIMessaging = {
  heroTagline: "AI-Powered Business Management That Puts You in Control",
  subTagline: "Harness the power of intelligent automation while maintaining complete control over your business decisions",
  keyBenefits: [
    "Intelligent inventory tracking that learns your business patterns",
    "Predictive analytics that help you make smarter decisions",
    "Automated processes that save time while keeping you in control",
    "Smart insights that grow your business profitability",
    "AI-driven recommendations you can trust and customize"
  ],
  privacyMessage: "Your data stays private and secure. Our AI works for you, not against you. All AI processing happens with your explicit consent and full transparency.",
  controlMessage: "You're always in control. Our AI provides intelligent recommendations and insights - you make the final decisions. Customize AI behavior to match your business style.",
  automationBenefits: [
    "Reduce manual inventory counting by 80%",
    "Predict stock needs 2-4 weeks in advance",
    "Optimize pricing for maximum profitability",
    "Identify top customers automatically",
    "Streamline supplier relationships",
    "Automate routine tasks while you focus on growth",
    "Generate actionable insights from your business data"
  ],
  trustFactors: [
    "Transparent AI decision-making process",
    "Full data ownership and control",
    "Customizable AI behavior settings",
    "Human oversight on all automated actions",
    "Secure, encrypted data processing",
    "No vendor lock-in - your data remains yours"
  ],
  valuePropositions: [
    {
      title: "Intelligent Automation",
      description: "Let AI handle routine tasks while you focus on strategic decisions",
      icon: "🤖",
      benefits: [
        "Automated inventory tracking and alerts",
        "Smart reordering suggestions",
        "Intelligent price optimization",
        "Predictive demand forecasting"
      ],
      context: 'features'
    },
    {
      title: "Smart Decision Support",
      description: "Get AI-powered insights that help you make better business decisions",
      icon: "🧠",
      benefits: [
        "Data-driven business recommendations",
        "Trend analysis and forecasting",
        "Customer behavior insights",
        "Performance optimization suggestions"
      ],
      context: 'features'
    },
    {
      title: "User-Controlled AI",
      description: "Maintain complete control over how AI works in your business",
      icon: "🎛️",
      benefits: [
        "Customizable AI behavior settings",
        "Manual override on all recommendations",
        "Transparent decision explanations",
        "Adjustable automation levels"
      ],
      context: 'features'
    },
    {
      title: "Privacy-First AI",
      description: "Your business data remains private and secure with our AI solutions",
      icon: "🔒",
      benefits: [
        "Local data processing options",
        "Encrypted AI model training",
        "No data sharing with third parties",
        "Full audit trail of AI decisions"
      ],
      context: 'features'
    }
  ]
};

/**
 * AI capabilities for features page
 */
export const AI_CAPABILITIES: AICapability[] = [
  {
    name: "Smart Inventory Management",
    shortDescription: "AI-powered inventory tracking that learns your business patterns",
    detailedDescription: "Our intelligent inventory system uses machine learning to understand your sales patterns, seasonal trends, and customer behavior. It automatically tracks stock levels, predicts when you'll run out of products, and suggests optimal reorder quantities.",
    userControlAspects: [
      "Set custom reorder thresholds and safety stock levels",
      "Override AI suggestions with your business knowledge",
      "Customize alert preferences and timing",
      "Adjust AI sensitivity to seasonal changes"
    ],
    privacyFeatures: [
      "All inventory data processed locally",
      "No sharing of product information with competitors",
      "Encrypted storage of business patterns",
      "Full data export capabilities"
    ],
    businessBenefits: [
      "Reduce stockouts by up to 75%",
      "Optimize inventory investment",
      "Minimize waste from overstocking",
      "Improve cash flow management"
    ],
    technicalFeatures: [
      "Real-time stock level monitoring",
      "Predictive analytics engine",
      "Automated reorder suggestions",
      "Integration with POS systems"
    ]
  },
  {
    name: "Predictive Analytics",
    shortDescription: "Forecast trends and make data-driven decisions with AI insights",
    detailedDescription: "Advanced machine learning algorithms analyze your historical data to predict future trends, identify opportunities, and warn about potential challenges. Get actionable insights that help you stay ahead of the competition.",
    userControlAspects: [
      "Choose which metrics to track and predict",
      "Set confidence thresholds for predictions",
      "Customize reporting frequency and format",
      "Override predictions with market knowledge"
    ],
    privacyFeatures: [
      "Anonymized data processing",
      "No external data sharing",
      "Secure cloud processing with encryption",
      "Complete data ownership rights"
    ],
    businessBenefits: [
      "Increase revenue by identifying growth opportunities",
      "Reduce costs through predictive maintenance",
      "Improve customer satisfaction with demand forecasting",
      "Make confident strategic decisions"
    ],
    technicalFeatures: [
      "Time series forecasting",
      "Anomaly detection",
      "Trend analysis",
      "Custom dashboard creation"
    ]
  },
  {
    name: "Intelligent Pricing Optimization",
    shortDescription: "Maximize profits with AI-driven pricing strategies",
    detailedDescription: "Our pricing AI analyzes market conditions, competitor pricing, demand patterns, and your cost structure to recommend optimal prices that maximize profitability while maintaining competitiveness.",
    userControlAspects: [
      "Set minimum and maximum price boundaries",
      "Choose pricing strategy (profit vs. volume)",
      "Override AI recommendations manually",
      "Customize pricing rules by product category"
    ],
    privacyFeatures: [
      "Proprietary pricing algorithms",
      "No sharing of pricing strategies",
      "Secure competitive analysis",
      "Confidential profit margin protection"
    ],
    businessBenefits: [
      "Increase profit margins by 15-25%",
      "Stay competitive with dynamic pricing",
      "Reduce pricing errors and inconsistencies",
      "Optimize revenue across product lines"
    ],
    technicalFeatures: [
      "Dynamic pricing algorithms",
      "Competitor price monitoring",
      "Demand elasticity analysis",
      "A/B testing capabilities"
    ]
  },
  {
    name: "Smart Customer Insights",
    shortDescription: "Understand your customers better with AI-powered analytics",
    detailedDescription: "Machine learning algorithms analyze customer behavior, purchase patterns, and preferences to help you understand your customers better, predict their needs, and personalize their experience.",
    userControlAspects: [
      "Choose customer segmentation criteria",
      "Set privacy levels for customer data",
      "Customize marketing automation rules",
      "Control data retention periods"
    ],
    privacyFeatures: [
      "GDPR and POPIA compliant processing",
      "Customer consent management",
      "Data anonymization options",
      "Right to be forgotten implementation"
    ],
    businessBenefits: [
      "Increase customer lifetime value",
      "Improve customer retention rates",
      "Personalize marketing campaigns",
      "Identify high-value customer segments"
    ],
    technicalFeatures: [
      "Customer segmentation algorithms",
      "Behavioral pattern recognition",
      "Churn prediction models",
      "Personalization engines"
    ]
  }
];

/**
 * Industry-specific AI use cases
 */
export const AI_INDUSTRY_USE_CASES: AIIndustryUseCase[] = [
  {
    industry: "Retail",
    title: "Smart Retail Management",
    description: "Transform your retail operations with AI that understands customer behavior and optimizes inventory",
    aiCapabilities: [
      "Predictive demand forecasting",
      "Dynamic pricing optimization",
      "Customer behavior analysis",
      "Automated inventory replenishment"
    ],
    automationBenefits: [
      "Reduce stockouts by 70%",
      "Increase profit margins by 20%",
      "Automate 80% of reordering decisions",
      "Optimize staff scheduling based on predicted traffic"
    ],
    controlFeatures: [
      "Set custom pricing rules and boundaries",
      "Override AI recommendations with local knowledge",
      "Customize inventory policies by product category",
      "Control automation levels for different processes"
    ],
    realWorldExample: "A local clothing store uses BizPilot's AI to predict seasonal demand, automatically reorder popular items, and optimize prices based on local competition - resulting in 25% higher profits and 50% less time spent on inventory management."
  },
  {
    industry: "Restaurant",
    title: "Intelligent Restaurant Operations",
    description: "Optimize your restaurant with AI that predicts demand, manages inventory, and reduces waste",
    aiCapabilities: [
      "Menu demand forecasting",
      "Ingredient optimization",
      "Waste reduction algorithms",
      "Staff scheduling optimization"
    ],
    automationBenefits: [
      "Reduce food waste by 40%",
      "Optimize ingredient ordering",
      "Predict busy periods for better staffing",
      "Automate menu pricing based on costs"
    ],
    controlFeatures: [
      "Set food safety and quality standards",
      "Override predictions for special events",
      "Customize waste tolerance levels",
      "Control menu pricing strategies"
    ],
    realWorldExample: "A family restaurant chain uses BizPilot's AI to predict daily demand for each menu item, automatically order ingredients, and schedule staff - reducing food waste by 35% and increasing profitability by 18%."
  },
  {
    industry: "Manufacturing",
    title: "Smart Manufacturing Operations",
    description: "Streamline production with AI that optimizes processes, predicts maintenance, and manages supply chains",
    aiCapabilities: [
      "Production planning optimization",
      "Predictive maintenance scheduling",
      "Supply chain risk assessment",
      "Quality control automation"
    ],
    automationBenefits: [
      "Reduce downtime by 60%",
      "Optimize production schedules",
      "Predict equipment maintenance needs",
      "Automate quality control processes"
    ],
    controlFeatures: [
      "Set production priorities and constraints",
      "Override maintenance schedules when needed",
      "Customize quality standards",
      "Control automation levels by production line"
    ],
    realWorldExample: "A small electronics manufacturer uses BizPilot's AI to predict when machines need maintenance, optimize production schedules, and manage component inventory - reducing downtime by 45% and increasing output by 22%."
  },
  {
    industry: "Healthcare",
    title: "Intelligent Healthcare Management",
    description: "Enhance patient care with AI that manages inventory, schedules resources, and ensures compliance",
    aiCapabilities: [
      "Medical inventory optimization",
      "Patient flow prediction",
      "Resource allocation planning",
      "Compliance monitoring"
    ],
    automationBenefits: [
      "Ensure critical supplies are always available",
      "Optimize staff scheduling for patient needs",
      "Predict equipment maintenance requirements",
      "Automate compliance reporting"
    ],
    controlFeatures: [
      "Set critical inventory thresholds",
      "Override AI for emergency situations",
      "Customize compliance rules",
      "Control patient data privacy settings"
    ],
    realWorldExample: "A private clinic uses BizPilot's AI to manage medical supplies, predict patient appointment patterns, and ensure regulatory compliance - reducing supply shortages by 90% and improving patient satisfaction scores by 30%."
  }
];

/**
 * AI-related FAQs
 */
export const AI_FAQS: AIFAQ[] = [
  {
    question: "How does BizPilot's AI protect my business data privacy?",
    answer: "Your data privacy is our top priority. All AI processing happens with your explicit consent, data is encrypted both in transit and at rest, and we never share your business information with third parties. You maintain complete ownership of your data and can export or delete it at any time. Our AI models are trained on anonymized, aggregated data patterns - never on your specific business information.",
    category: 'privacy',
    relatedFeatures: ['Data Encryption', 'Privacy Controls', 'Data Ownership']
  },
  {
    question: "Can I control what the AI does in my business?",
    answer: "Absolutely! You have complete control over AI behavior in BizPilot. You can set custom thresholds, override any AI recommendation, choose which processes to automate, and adjust AI sensitivity levels. The AI provides intelligent suggestions and insights - you always make the final decisions. You can also turn off AI features entirely if you prefer manual control.",
    category: 'control',
    relatedFeatures: ['Custom Settings', 'Manual Override', 'Automation Controls']
  },
  {
    question: "What AI capabilities does BizPilot offer?",
    answer: "BizPilot offers comprehensive AI capabilities including predictive inventory management, intelligent pricing optimization, customer behavior analysis, demand forecasting, automated reordering suggestions, and smart business insights. Our AI learns from your business patterns to provide increasingly accurate recommendations while always keeping you in control.",
    category: 'capabilities',
    relatedFeatures: ['Predictive Analytics', 'Smart Inventory', 'Intelligent Pricing', 'Customer Insights']
  },
  {
    question: "How accurate are BizPilot's AI predictions?",
    answer: "Our AI predictions typically achieve 85-95% accuracy for inventory forecasting and 80-90% for demand prediction, improving over time as the system learns your business patterns. Accuracy varies by business type and data quality. The system provides confidence scores with each prediction, and you can always override predictions with your business knowledge.",
    category: 'capabilities',
    relatedFeatures: ['Predictive Analytics', 'Confidence Scores', 'Manual Override']
  },
  {
    question: "Do I need technical expertise to use BizPilot's AI features?",
    answer: "No technical expertise required! BizPilot's AI works automatically in the background, providing easy-to-understand insights and recommendations through our intuitive interface. The system is designed for business owners, not data scientists. Setup is simple, and our support team helps you configure AI settings to match your business needs.",
    category: 'implementation',
    relatedFeatures: ['User-Friendly Interface', 'Automatic Setup', 'Support Team']
  },
  {
    question: "How does the AI learn about my business?",
    answer: "The AI learns from your business data patterns including sales history, inventory movements, customer behavior, and seasonal trends. All learning happens locally within your BizPilot instance - we don't share your data with other businesses or use it to train general models. The more you use the system, the more accurate and personalized the AI becomes for your specific business.",
    category: 'implementation',
    relatedFeatures: ['Pattern Recognition', 'Local Learning', 'Data Privacy']
  },
  {
    question: "What are the main benefits of using AI in my business?",
    answer: "AI helps you save time, reduce costs, and increase profits by automating routine tasks, providing predictive insights, and optimizing business processes. Typical benefits include 70% reduction in stockouts, 20% increase in profit margins, 80% less time spent on inventory management, and better decision-making through data-driven insights.",
    category: 'benefits',
    relatedFeatures: ['Time Savings', 'Cost Reduction', 'Profit Optimization', 'Decision Support']
  },
  {
    question: "Can I try the AI features before committing to a paid plan?",
    answer: "Yes! Our Starter plan includes basic AI features like smart analytics and AI-powered inventory tracking at no cost. This lets you experience how AI can benefit your business before upgrading to more advanced features. You can also schedule a demo to see all AI capabilities in action.",
    category: 'implementation',
    relatedFeatures: ['Free Starter Plan', 'Demo Available', 'Gradual Upgrade Path']
  }
];

/**
 * Reusable AI content components
 */
export interface AIContentComponent {
  id: string;
  title: string;
  content: string;
  type: 'tagline' | 'benefit' | 'feature' | 'testimonial' | 'callout';
  context: string[];
  aiEmphasis: 'high' | 'medium' | 'low';
}

export const AI_CONTENT_COMPONENTS: AIContentComponent[] = [
  {
    id: 'hero-ai-tagline',
    title: 'AI-Powered Hero Tagline',
    content: 'Transform your business with intelligent automation that puts you in control',
    type: 'tagline',
    context: ['home', 'features'],
    aiEmphasis: 'high'
  },
  {
    id: 'privacy-assurance',
    title: 'Privacy Assurance',
    content: 'Your data stays private and secure. Our AI works for you, with full transparency and your complete control.',
    type: 'callout',
    context: ['features', 'faq', 'pricing'],
    aiEmphasis: 'medium'
  },
  {
    id: 'control-emphasis',
    title: 'User Control Emphasis',
    content: 'You make the decisions. Our AI provides intelligent recommendations that you can customize, override, or disable at any time.',
    type: 'benefit',
    context: ['features', 'faq'],
    aiEmphasis: 'high'
  },
  {
    id: 'automation-benefit',
    title: 'Automation Benefit',
    content: 'Automate routine tasks and focus on growing your business. Our AI handles the details while you stay in control of the big picture.',
    type: 'benefit',
    context: ['features', 'industries', 'pricing'],
    aiEmphasis: 'high'
  },
  {
    id: 'smart-insights',
    title: 'Smart Insights',
    content: 'Get actionable insights from your business data. Our AI identifies patterns and opportunities you might miss.',
    type: 'feature',
    context: ['features', 'industries'],
    aiEmphasis: 'medium'
  },
  {
    id: 'predictive-power',
    title: 'Predictive Power',
    content: 'Stay ahead with predictive analytics. Know what your business needs before you run out of stock or miss opportunities.',
    type: 'feature',
    context: ['features', 'pricing'],
    aiEmphasis: 'high'
  }
];

/**
 * AI messaging utility functions
 */
export class AIMessagingUtils {
  /**
   * Get AI content components by context
   */
  static getComponentsByContext(context: string): AIContentComponent[] {
    return AI_CONTENT_COMPONENTS.filter(component => 
      component.context.includes(context)
    );
  }

  /**
   * Get AI content components by emphasis level
   */
  static getComponentsByEmphasis(emphasis: 'high' | 'medium' | 'low'): AIContentComponent[] {
    return AI_CONTENT_COMPONENTS.filter(component => 
      component.aiEmphasis === emphasis
    );
  }

  /**
   * Get FAQs by category
   */
  static getFAQsByCategory(category: AIFAQ['category']): AIFAQ[] {
    return AI_FAQS.filter(faq => faq.category === category);
  }

  /**
   * Get industry use case by industry name
   */
  static getIndustryUseCase(industry: string): AIIndustryUseCase | undefined {
    return AI_INDUSTRY_USE_CASES.find(useCase => 
      useCase.industry.toLowerCase() === industry.toLowerCase()
    );
  }

  /**
   * Get AI capability by name
   */
  static getAICapability(name: string): AICapability | undefined {
    return AI_CAPABILITIES.find(capability => 
      capability.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get value propositions by context
   */
  static getValuePropositionsByContext(context: AIValueProposition['context']): AIValueProposition[] {
    return AI_MESSAGING.valuePropositions.filter(vp => vp.context === context);
  }

  /**
   * Format AI benefit with emphasis
   */
  static formatAIBenefit(benefit: string, emphasis: boolean = false): string {
    if (emphasis) {
      return `✨ ${benefit}`;
    }
    return benefit;
  }

  /**
   * Get random AI tagline for variety
   */
  static getRandomTagline(): string {
    const taglines = [
      AI_MESSAGING.heroTagline,
      "Intelligent Business Management That Adapts to You",
      "AI-Powered Insights, Human-Controlled Decisions",
      "Smart Automation That Respects Your Business Style",
      "The Future of Business Management is Here - And You're in Control"
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }

  /**
   * Check if content should emphasize AI features
   */
  static shouldEmphasizeAI(context: string): boolean {
    const highAIContexts = ['features', 'pricing', 'home'];
    return highAIContexts.includes(context);
  }
}

// Export the complete AI messaging configuration
export const AI_MESSAGING_CONFIG = {
  messaging: AI_MESSAGING,
  capabilities: AI_CAPABILITIES,
  industryUseCases: AI_INDUSTRY_USE_CASES,
  faqs: AI_FAQS,
  contentComponents: AI_CONTENT_COMPONENTS,
  utils: AIMessagingUtils
} as const;

export default AI_MESSAGING_CONFIG;