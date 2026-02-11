/**
 * AI Messaging Configuration
 * 
 * This file contains balanced AI messaging content that positions AI as a core feature
 * while highlighting other important business management capabilities. AI is presented
 * as an intelligent enhancement rather than the only selling point.
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
 * Balanced AI messaging configuration - AI as core feature, not the only feature
 */
export const AI_MESSAGING: AIMessaging = {
  heroTagline: "Complete Business Management with Intelligent Automation",
  subTagline: "Comprehensive POS and ERP system enhanced with smart AI features that learn your business patterns",
  keyBenefits: [
    "Complete business management from POS to inventory to reporting",
    "Smart automation that learns and adapts to your business patterns",
    "Powerful analytics and insights to drive better decisions",
    "Seamless integration with accounting systems like Xero and Sage",
    "Multi-location management with centralized control"
  ],
  privacyMessage: "Your data stays private and secure. AI features work locally with your explicit consent and full transparency.",
  controlMessage: "You're always in control. AI provides helpful recommendations - you make the final decisions.",
  automationBenefits: [
    "Reduce manual inventory counting and tracking",
    "Get smart reorder suggestions to improve stock levels based on sales patterns",
    "Save time by automating routine reporting and analytics",
    "Streamline customer management and loyalty programs",
    "Optimize pricing based on market data and costs"
  ],
  trustFactors: [
    "Transparent decision-making process",
    "Full data ownership and control",
    "Customizable automation settings",
    "Human oversight on all automated actions",
    "Secure, encrypted data processing"
  ],
  valuePropositions: [
    {
      title: "Smart Automation",
      description: "Intelligent features that handle routine business tasks while you focus on growth",
      icon: "🤖",
      benefits: [
        "Automated inventory tracking and alerts",
        "Smart reordering suggestions",
        "Intelligent reporting and analytics",
        "Predictive insights for better planning"
      ],
      context: 'features'
    },
    {
      title: "Complete Smart Business Suite",
      description: "Everything you need to run your business in one intelligent integrated platform",
      icon: "🏢",
      benefits: [
        "POS system with payment processing",
        "Inventory management across locations",
        "Customer relationship management",
        "Financial reporting and integration"
      ],
      context: 'features'
    },
    {
      title: "User-Controlled Intelligent Enhancement",
      description: "AI features that enhance your business expertise without taking over",
      icon: "🎛️",
      benefits: [
        "Customizable automation levels",
        "Manual override on all suggestions",
        "Transparent decision explanations",
        "Adjustable intelligence settings"
      ],
      context: 'features'
    },
    {
      title: "Privacy-First Smart Approach",
      description: "Your business data remains private and secure with intelligent safeguards",
      icon: "🔒",
      benefits: [
        "Local data processing options",
        "Encrypted data storage",
        "No data sharing with third parties",
        "Full audit trail of all actions"
      ],
      context: 'features'
    }
  ]
};

/**
 * Balanced AI capabilities for features page - mix of AI and traditional features
 */
export const AI_CAPABILITIES: AICapability[] = [
  {
    name: "Intelligent Inventory Management",
    shortDescription: "Advanced inventory tracking with smart insights and automation",
    detailedDescription: "Comprehensive inventory system that tracks stock levels, manages suppliers, and provides intelligent insights about your inventory patterns. Get smart reorder suggestions and automated alerts to prevent stockouts.",
    userControlAspects: [
      "Set custom reorder thresholds and safety stock levels",
      "Override smart suggestions with your business knowledge",
      "Customize alert preferences and timing",
      "Adjust automation sensitivity"
    ],
    privacyFeatures: [
      "All inventory data processed securely",
      "No sharing of product information",
      "Encrypted storage of business data",
      "Full data export capabilities"
    ],
    businessBenefits: [
      "Reduce stockouts and overstock situations",
      "Optimize inventory investment",
      "Minimize waste and spoilage",
      "Improve cash flow management"
    ],
    technicalFeatures: [
      "Real-time stock level monitoring",
      "Smart analytics engine",
      "Automated reorder suggestions",
      "Multi-location inventory sync"
    ]
  },
  {
    name: "Advanced Analytics & Reporting",
    shortDescription: "Comprehensive reporting with intelligent insights and trend analysis",
    detailedDescription: "Powerful reporting system that analyzes your business data to identify trends, opportunities, and areas for improvement. Get both standard reports and smart insights that help you make better decisions.",
    userControlAspects: [
      "Choose which metrics to track and analyze",
      "Customize reporting frequency and format",
      "Set up automated report delivery",
      "Override insights with market knowledge"
    ],
    privacyFeatures: [
      "Secure data processing",
      "No external data sharing",
      "Encrypted report storage",
      "Complete data ownership"
    ],
    businessBenefits: [
      "Identify growth opportunities and trends",
      "Make data-driven business decisions",
      "Track performance across all areas",
      "Plan for future growth and challenges"
    ],
    technicalFeatures: [
      "Comprehensive dashboard system",
      "Trend analysis and forecasting",
      "Custom report builder",
      "Export to Excel and PDF"
    ]
  },
  {
    name: "Smart Pricing Optimization",
    shortDescription: "Intelligent pricing tools that help maximize profitability",
    detailedDescription: "Advanced pricing system that analyzes costs, market conditions, and sales data to suggest optimal prices. Maintain competitive pricing while maximizing your profit margins.",
    userControlAspects: [
      "Set minimum and maximum price boundaries",
      "Choose pricing strategy preferences",
      "Override pricing recommendations",
      "Customize pricing rules by category"
    ],
    privacyFeatures: [
      "Proprietary pricing algorithms",
      "No sharing of pricing strategies",
      "Secure competitive analysis",
      "Confidential margin protection"
    ],
    businessBenefits: [
      "Increase profit margins effectively",
      "Stay competitive in your market",
      "Reduce pricing errors",
      "Optimize revenue across products"
    ],
    technicalFeatures: [
      "Dynamic pricing algorithms",
      "Market analysis tools",
      "Profit margin tracking",
      "A/B testing capabilities"
    ]
  },
  {
    name: "Enhanced Customer Management",
    shortDescription: "Comprehensive CRM with intelligent customer insights",
    detailedDescription: "Complete customer relationship management system that tracks customer behavior, preferences, and purchase history. Get smart insights about your customers to improve service and increase loyalty.",
    userControlAspects: [
      "Choose customer segmentation criteria",
      "Set privacy levels for customer data",
      "Customize loyalty program rules",
      "Control data retention periods"
    ],
    privacyFeatures: [
      "GDPR and privacy law compliant",
      "Customer consent management",
      "Data anonymization options",
      "Right to be forgotten support"
    ],
    businessBenefits: [
      "Increase customer lifetime value",
      "Improve customer retention",
      "Personalize customer experience",
      "Identify valuable customer segments"
    ],
    technicalFeatures: [
      "Customer segmentation tools",
      "Purchase history tracking",
      "Loyalty program management",
      "Marketing automation features"
    ]
  }
];

/**
 * Balanced industry use cases - AI mentioned but not overwhelming
 */
export const AI_INDUSTRY_USE_CASES: AIIndustryUseCase[] = [
  {
    industry: "Retail",
    title: "Complete Retail Management",
    description: "Comprehensive retail solution with smart features that help optimize inventory, pricing, and customer relationships",
    aiCapabilities: [
      "Smart demand forecasting",
      "Intelligent pricing suggestions",
      "Customer behavior insights",
      "Automated reorder recommendations"
    ],
    automationBenefits: [
      "Reduce stockouts with smart alerts",
      "Optimize pricing for better margins",
      "Automate routine inventory tasks",
      "Streamline customer management"
    ],
    controlFeatures: [
      "Set custom business rules and policies",
      "Override smart suggestions when needed",
      "Customize automation levels",
      "Control all automated processes"
    ],
    realWorldExample: "A local clothing store uses BizPilot to manage inventory across seasons, track customer preferences, and optimize pricing - resulting in 25% higher profits and significantly less time spent on manual tasks."
  },
  {
    industry: "Restaurant",
    title: "Complete Restaurant Operations",
    description: "Full restaurant management system with intelligent features for menu optimization, inventory control, and staff management",
    aiCapabilities: [
      "Menu demand analysis",
      "Ingredient cost optimization",
      "Waste reduction insights",
      "Staff scheduling optimization"
    ],
    automationBenefits: [
      "Reduce food waste with smart tracking",
      "Optimize ingredient ordering",
      "Predict busy periods for staffing",
      "Automate menu cost calculations"
    ],
    controlFeatures: [
      "Set food safety and quality standards",
      "Override predictions for special events",
      "Customize waste tolerance levels",
      "Control menu pricing strategies"
    ],
    realWorldExample: "A family restaurant uses BizPilot to track ingredient costs, manage staff schedules, and analyze menu performance - reducing waste by 35% and improving profitability by 18%."
  },
  {
    industry: "Manufacturing",
    title: "Smart Manufacturing Operations",
    description: "Comprehensive manufacturing management with intelligent process optimization and predictive maintenance features",
    aiCapabilities: [
      "Production planning optimization",
      "Predictive maintenance alerts",
      "Supply chain analysis",
      "Quality control automation"
    ],
    automationBenefits: [
      "Reduce equipment downtime",
      "Optimize production schedules",
      "Predict maintenance needs",
      "Automate quality tracking"
    ],
    controlFeatures: [
      "Set production priorities and constraints",
      "Override maintenance schedules",
      "Customize quality standards",
      "Control automation by production line"
    ],
    realWorldExample: "A small electronics manufacturer uses BizPilot to manage production schedules, track component inventory, and predict maintenance needs - reducing downtime by 45% and increasing output by 22%."
  },
  {
    industry: "Healthcare",
    title: "Healthcare Practice Management",
    description: "Complete healthcare management system with intelligent inventory control and compliance monitoring",
    aiCapabilities: [
      "Medical inventory optimization",
      "Patient flow analysis",
      "Resource allocation planning",
      "Compliance monitoring"
    ],
    automationBenefits: [
      "Ensure critical supplies availability",
      "Optimize staff scheduling",
      "Predict equipment needs",
      "Automate compliance reporting"
    ],
    controlFeatures: [
      "Set critical inventory thresholds",
      "Override suggestions for emergencies",
      "Customize compliance rules",
      "Control patient data privacy"
    ],
    realWorldExample: "A private clinic uses BizPilot to manage medical supplies, track patient appointments, and ensure regulatory compliance - reducing supply shortages by 90% and improving patient satisfaction."
  }
];

/**
 * Balanced AI-related FAQs - focus on practical benefits
 */
export const AI_FAQS: AIFAQ[] = [
  {
    question: "How does BizPilot protect my business data?",
    answer: "Your data privacy is our top priority. All data is encrypted both in transit and at rest, and we never share your business information with third parties. You maintain complete ownership of your data and can export or delete it at any time. Smart features work with your explicit consent and full transparency.",
    category: 'privacy',
    relatedFeatures: ['Data Encryption', 'Privacy Controls', 'Data Ownership']
  },
  {
    question: "Can I control the smart features and automation?",
    answer: "Absolutely! You have complete control over all smart features in BizPilot. You can set custom thresholds, override any suggestion, choose which processes to automate, and adjust sensitivity levels. Smart features provide helpful suggestions - you always make the final decisions.",
    category: 'control',
    relatedFeatures: ['Custom Settings', 'Manual Override', 'Automation Controls']
  },
  {
    question: "What smart features does BizPilot offer?",
    answer: "BizPilot offers intelligent inventory management, smart pricing optimization, customer insights, automated reporting, predictive analytics, and intelligent business recommendations. These features learn from your business patterns to provide increasingly helpful suggestions while keeping you in control.",
    category: 'capabilities',
    relatedFeatures: ['Smart Analytics', 'Intelligent Inventory', 'Pricing Tools', 'Customer Insights']
  },
  {
    question: "How accurate are the smart suggestions?",
    answer: "Our smart features typically achieve high accuracy rates that improve over time as the system learns your business patterns. Accuracy varies by business type and data quality. The system provides confidence indicators with suggestions, and you can always override them with your business knowledge.",
    category: 'capabilities',
    relatedFeatures: ['Smart Analytics', 'Confidence Scores', 'Manual Override']
  },
  {
    question: "Do I need technical expertise to use the smart features?",
    answer: "No technical expertise required! BizPilot's smart features work automatically in the background, providing easy-to-understand insights through our intuitive interface. The system is designed for business owners, not data scientists. Setup is simple, and our support team helps you configure settings.",
    category: 'implementation',
    relatedFeatures: ['User-Friendly Interface', 'Automatic Setup', 'Support Team']
  },
  {
    question: "How do the smart features learn about my business?",
    answer: "The smart features learn from your business data patterns including sales history, inventory movements, customer behavior, and seasonal trends. All learning happens within your BizPilot instance - we don't share your data. The more you use the system, the more personalized the suggestions become.",
    category: 'implementation',
    relatedFeatures: ['Pattern Recognition', 'Local Learning', 'Data Privacy']
  },
  {
    question: "What are the main benefits of the smart features?",
    answer: "Smart features help you save time, reduce costs, and increase profits by automating routine tasks, providing helpful insights, and optimizing business processes. Benefits include reduced stockouts, better profit margins, less time on manual tasks, and better decision-making through data insights.",
    category: 'benefits',
    relatedFeatures: ['Time Savings', 'Cost Reduction', 'Profit Optimization', 'Decision Support']
  },
  {
    question: "Can I try the smart features before upgrading?",
    answer: "Yes! Our Starter plan includes basic smart features like analytics and intelligent inventory tracking at no cost. This lets you experience how smart features can benefit your business before upgrading to more advanced capabilities. You can also schedule a demo to see all features.",
    category: 'implementation',
    relatedFeatures: ['Free Starter Plan', 'Demo Available', 'Gradual Upgrade Path']
  }
];

/**
 * Balanced content components - AI mentioned but not overwhelming
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
    id: 'balanced-hero-tagline',
    title: 'Balanced Hero Tagline',
    content: 'Complete business management with intelligent features that enhance your expertise',
    type: 'tagline',
    context: ['home', 'features'],
    aiEmphasis: 'medium'
  },
  {
    id: 'privacy-assurance',
    title: 'Privacy Assurance',
    content: 'Your data stays private and secure. Smart features work with full transparency and your complete control.',
    type: 'callout',
    context: ['features', 'faq', 'pricing'],
    aiEmphasis: 'low'
  },
  {
    id: 'control-emphasis',
    title: 'User Control Emphasis',
    content: 'You make the business decisions. Smart features provide helpful suggestions that you can customize, override, or disable.',
    type: 'benefit',
    context: ['features', 'faq'],
    aiEmphasis: 'medium'
  },
  {
    id: 'automation-benefit',
    title: 'Smart Automation Benefit',
    content: 'Automate routine tasks and focus on growing your business. Smart features handle the details while you control the strategy.',
    type: 'benefit',
    context: ['features', 'industries', 'pricing'],
    aiEmphasis: 'medium'
  },
  {
    id: 'business-insights',
    title: 'Business Insights',
    content: 'Get actionable insights from your business data. Advanced analytics help you identify patterns and opportunities.',
    type: 'feature',
    context: ['features', 'industries'],
    aiEmphasis: 'low'
  },
  {
    id: 'predictive-features',
    title: 'Predictive Features',
    content: 'Stay ahead with smart forecasting. Know what your business needs before you run out of stock or miss opportunities.',
    type: 'feature',
    context: ['features', 'pricing'],
    aiEmphasis: 'medium'
  }
];

/**
 * Balanced messaging utility functions
 */
export class AIMessagingUtils {
  /**
   * Get content components by context
   */
  static getComponentsByContext(context: string): AIContentComponent[] {
    return AI_CONTENT_COMPONENTS.filter(component => 
      component.context.includes(context)
    );
  }

  /**
   * Get content components by emphasis level
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
   * Get capability by name
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
   * Format benefit with optional emphasis
   */
  static formatBenefit(benefit: string, emphasis: boolean = false): string {
    if (emphasis) {
      return `✨ ${benefit}`;
    }
    return benefit;
  }

  /**
   * Get balanced tagline options
   */
  static getBalancedTagline(): string {
    const taglines = [
      AI_MESSAGING.heroTagline,
      "Complete Business Management with Smart Features",
      "Comprehensive POS & ERP with Intelligent Insights",
      "Business Management That Adapts to Your Needs",
      "The Complete Business Solution with Smart Automation"
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }

  /**
   * Check if content should moderately emphasize smart features
   */
  static shouldEmphasizeSmartFeatures(context: string): boolean {
    const moderateEmphasisContexts = ['features', 'pricing'];
    return moderateEmphasisContexts.includes(context);
  }

  /**
   * Alias: Check if content should emphasize AI (used by marketing pages)
   */
  static shouldEmphasizeAI(context: string): boolean {
    const aiEmphasisContexts = ['features', 'pricing', 'home'];
    return aiEmphasisContexts.includes(context);
  }

  /**
   * Alias: Get a random tagline (delegates to getBalancedTagline)
   */
  static getRandomTagline(): string {
    return this.getBalancedTagline();
  }

  /**
   * Alias: Format an AI benefit with optional emphasis prefix
   */
  static formatAIBenefit(benefit: string, emphasis: boolean = false): string {
    return this.formatBenefit(benefit, emphasis);
  }
}

// Export the balanced messaging configuration
export const AI_MESSAGING_CONFIG = {
  messaging: AI_MESSAGING,
  capabilities: AI_CAPABILITIES,
  industryUseCases: AI_INDUSTRY_USE_CASES,
  faqs: AI_FAQS,
  contentComponents: AI_CONTENT_COMPONENTS,
  utils: AIMessagingUtils
} as const;

export default AI_MESSAGING_CONFIG;