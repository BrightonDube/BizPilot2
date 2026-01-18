/**
 * Marketing Knowledge Base for Guest AI Widget
 * 
 * This module contains comprehensive information about BizPilot features, pricing,
 * use cases, and benefits for use by the guest AI widget on marketing pages.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

// Core BizPilot Features and Capabilities
export const BIZPILOT_FEATURES = {
  pos_system: {
    name: "Point of Sale (POS) System",
    description: "Complete POS solution with touch-friendly interface, offline capability, and multi-payment support",
    benefits: [
      "Process sales quickly with intuitive touch interface",
      "Accept cash, card, and digital payments",
      "Works offline when internet is down",
      "Real-time sales tracking and reporting",
      "Receipt printing and email receipts"
    ],
    available_in: ["pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
  },
  inventory_management: {
    name: "Inventory Management",
    description: "Track stock levels, manage suppliers, and automate reordering with smart alerts",
    benefits: [
      "Real-time stock level tracking",
      "Low stock alerts and automatic reordering",
      "Supplier management and purchase orders",
      "Cost tracking and profit margin analysis",
      "Barcode scanning and product catalogs"
    ],
    available_in: ["pilot_core", "pilot_pro", "enterprise"]
  },
  customer_management: {
    name: "Customer Management (CRM)",
    description: "Build customer relationships with detailed profiles, purchase history, and loyalty programs",
    benefits: [
      "Customer profiles with purchase history",
      "Loyalty programs and rewards tracking",
      "Customer communication and marketing",
      "Sales analytics by customer segments",
      "Birthday and anniversary reminders"
    ],
    available_in: ["pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
  },
  reporting_analytics: {
    name: "Reporting & Analytics",
    description: "Comprehensive business insights with customizable reports and real-time dashboards",
    benefits: [
      "Real-time sales and performance dashboards",
      "Customizable reports for any time period",
      "Profit and loss analysis",
      "Staff performance tracking",
      "Export reports to Excel and PDF"
    ],
    available_in: ["pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
  },
  ai_insights: {
    name: "AI-Powered Business Insights",
    description: "Smart recommendations and predictive analytics to optimize your business operations",
    benefits: [
      "Sales forecasting and trend analysis",
      "Inventory optimization recommendations",
      "Customer behavior insights",
      "Pricing optimization suggestions",
      "Automated business intelligence reports"
    ],
    available_in: ["pilot_pro", "enterprise"]
  },
  multi_location: {
    name: "Multi-Location Management",
    description: "Manage multiple business locations from a single dashboard with centralized reporting",
    benefits: [
      "Centralized management of all locations",
      "Location-specific reporting and analytics",
      "Inventory transfers between locations",
      "Staff management across locations",
      "Consolidated financial reporting"
    ],
    available_in: ["pilot_pro", "enterprise"]
  },
  integrations: {
    name: "Third-Party Integrations",
    description: "Connect with accounting software, payment processors, and other business tools",
    benefits: [
      "Xero and Sage accounting integration",
      "PayStack and other payment processors",
      "Email marketing platform connections",
      "Delivery service integrations",
      "Custom API integrations (Enterprise)"
    ],
    available_in: ["pilot_core", "pilot_pro", "enterprise"]
  },
  team_collaboration: {
    name: "Team Collaboration",
    description: "Multi-user access with role-based permissions and staff management tools",
    benefits: [
      "Multiple user accounts with different access levels",
      "Staff scheduling and time tracking",
      "Performance monitoring and reporting",
      "Secure role-based permissions",
      "Team communication tools"
    ],
    available_in: ["pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
  }
} as const;

// Enterprise-Specific Features
export const ENTERPRISE_FEATURES = {
  white_labeling: {
    name: "White Labeling",
    description: "Customize BizPilot with your brand colors, logo, and domain",
    benefits: [
      "Custom branding throughout the platform",
      "Your logo and colors on all interfaces",
      "Custom domain for your BizPilot instance",
      "Branded customer-facing materials",
      "Remove BizPilot branding completely"
    ]
  },
  custom_development: {
    name: "Custom Development",
    description: "Tailored features and integrations built specifically for your business needs",
    benefits: [
      "Custom features developed to your specifications",
      "Specialized integrations with your existing systems",
      "Custom reporting and analytics dashboards",
      "Workflow automation specific to your processes",
      "Priority development queue for your requests"
    ]
  },
  dedicated_account_manager: {
    name: "Dedicated Account Manager",
    description: "Personal support representative who knows your business and provides ongoing assistance",
    benefits: [
      "Single point of contact for all support needs",
      "Proactive business optimization recommendations",
      "Regular check-ins and performance reviews",
      "Priority support with guaranteed response times",
      "Strategic planning and growth consultation"
    ]
  },
  sla_guarantee: {
    name: "Service Level Agreement (SLA)",
    description: "Guaranteed uptime and response times with financial penalties for non-compliance",
    benefits: [
      "99.9% uptime guarantee with compensation for downtime",
      "4-hour response time for critical issues",
      "1-hour response time for system outages",
      "Dedicated technical support team",
      "Financial penalties if SLA is not met"
    ]
  },
  advanced_security: {
    name: "Advanced Security",
    description: "Enterprise-grade security features including SSO, audit logs, and compliance tools",
    benefits: [
      "Single Sign-On (SSO) integration",
      "Advanced user authentication and authorization",
      "Comprehensive audit logs and compliance reporting",
      "Data encryption at rest and in transit",
      "Regular security assessments and penetration testing"
    ]
  },
  custom_workflows: {
    name: "Custom Workflows",
    description: "Automated business processes tailored to your specific operational requirements",
    benefits: [
      "Custom approval workflows for purchases and expenses",
      "Automated inventory management processes",
      "Custom notification and alert systems",
      "Integration with external business systems",
      "Workflow optimization and continuous improvement"
    ]
  }
} as const;

// Pricing Information for All Tiers
export const PRICING_INFORMATION = {
  pilot_solo: {
    name: "Pilot Solo",
    price: "Free",
    billing: "No billing required",
    description: "Perfect for getting started with BizPilot",
    target_audience: "Solo entrepreneurs, market stalls, very small businesses",
    key_features: [
      "1 user account",
      "Up to 50 orders per month",
      "1 terminal/device",
      "Basic customer management",
      "Email support",
      "Essential POS functionality"
    ],
    limitations: [
      "No advanced reporting",
      "No inventory tracking",
      "No cost calculations",
      "Limited to 50 orders per month",
      "Single user only"
    ]
  },
  pilot_lite: {
    name: "Pilot Lite",
    price: "R199/month",
    yearly_price: "R1,910/year (20% discount)",
    billing: "Monthly or yearly billing available",
    description: "Ideal for coffee stalls, food trucks, and small retail operations",
    target_audience: "Coffee shops, food trucks, small retail stores, market vendors",
    key_features: [
      "Up to 3 user accounts",
      "Unlimited orders",
      "1 terminal/device",
      "Basic sales reports",
      "Customer management and loyalty programs",
      "Team collaboration tools",
      "Email support",
      "Receipt printing and email receipts"
    ],
    limitations: [
      "No inventory tracking",
      "No cost calculations or profit analysis",
      "Limited to 1 terminal",
      "No advanced analytics or AI insights"
    ]
  },
  pilot_core: {
    name: "Pilot Core",
    price: "R799/month",
    yearly_price: "R7,670/year (20% discount)",
    billing: "Monthly or yearly billing available",
    description: "Perfect for restaurants with full inventory management and cost tracking",
    target_audience: "Restaurants, cafes, retail stores, service businesses",
    key_features: [
      "Unlimited users",
      "Unlimited orders",
      "Up to 2 terminals/devices",
      "Full inventory management with stock tracking",
      "Cost calculations and profit analysis",
      "Recipe management and ingredient tracking",
      "Advanced reporting and analytics",
      "Custom categories and products",
      "Third-party integrations (Xero, Sage)",
      "Export reports to Excel/PDF",
      "Email support"
    ],
    limitations: [
      "No AI insights or predictive analytics",
      "Limited to 2 terminals",
      "No multi-location management",
      "Standard support only"
    ]
  },
  pilot_pro: {
    name: "Pilot Pro",
    price: "R1,499/month",
    yearly_price: "R14,390/year (20% discount)",
    billing: "Monthly or yearly billing available",
    description: "Complete business management with AI insights and multi-location support",
    target_audience: "Growing businesses, restaurant chains, multi-location retailers",
    key_features: [
      "Unlimited users",
      "Unlimited orders",
      "Unlimited terminals/devices",
      "Full inventory management",
      "AI-powered business insights and forecasting",
      "Multi-location management",
      "Advanced analytics and custom reports",
      "API access for custom integrations",
      "Priority support",
      "All Pilot Core features plus AI automation"
    ],
    limitations: [
      "Standard branding (BizPilot branded)",
      "No custom development",
      "Standard support SLA"
    ]
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom Pricing",
    billing: "Tailored to your business needs",
    description: "Fully customized solution with unlimited everything and dedicated support",
    target_audience: "Large businesses, franchises, enterprise organizations, complex operations",
    key_features: [
      "Everything in Pilot Pro",
      "Unlimited locations and terminals",
      "White labeling with your brand",
      "Custom feature development",
      "Dedicated account manager",
      "99.9% uptime SLA guarantee",
      "Advanced security and compliance",
      "Custom workflows and automation",
      "Priority development queue",
      "Custom integrations and API development",
      "24/7 dedicated support",
      "On-site training and implementation"
    ],
    contact_info: {
      message: "Contact our sales team for a customized quote",
      email: "sales@bizpilot.co.za",
      phone: "+27 (0) 21 123 4567",
      process: "Schedule a consultation to discuss your specific needs and get a tailored proposal"
    }
  }
} as const;

// Industry Use Cases and Applications
export const INDUSTRY_USE_CASES = {
  restaurants: {
    name: "Restaurants & Cafes",
    description: "Complete restaurant management from orders to inventory",
    challenges: [
      "Managing complex menus and recipes",
      "Tracking ingredient costs and food waste",
      "Coordinating kitchen and front-of-house operations",
      "Managing staff schedules and performance"
    ],
    solutions: [
      "Recipe management with automatic cost calculations",
      "Real-time inventory tracking with low-stock alerts",
      "Kitchen display system integration",
      "Staff performance analytics and scheduling"
    ],
    recommended_tiers: ["pilot_core", "pilot_pro", "enterprise"],
    success_stories: [
      "Reduced food costs by 15% through better inventory management",
      "Increased table turnover by 20% with faster order processing",
      "Improved staff efficiency with automated scheduling"
    ]
  },
  retail: {
    name: "Retail Stores",
    description: "Streamlined retail operations with inventory and customer management",
    challenges: [
      "Managing large product catalogs",
      "Tracking inventory across multiple suppliers",
      "Building customer loyalty and repeat business",
      "Analyzing sales trends and seasonal patterns"
    ],
    solutions: [
      "Barcode scanning and product catalog management",
      "Automated reordering and supplier management",
      "Customer loyalty programs and purchase history",
      "AI-powered sales forecasting and trend analysis"
    ],
    recommended_tiers: ["pilot_lite", "pilot_core", "pilot_pro", "enterprise"],
    success_stories: [
      "Increased customer retention by 30% with loyalty programs",
      "Reduced stockouts by 40% with automated reordering",
      "Improved profit margins through better pricing strategies"
    ]
  },
  coffee_shops: {
    name: "Coffee Shops & Food Trucks",
    description: "Fast-paced service with mobile-friendly POS and basic inventory",
    challenges: [
      "Quick service during peak hours",
      "Managing cash and card payments efficiently",
      "Tracking popular items and peak times",
      "Operating in mobile or small spaces"
    ],
    solutions: [
      "Touch-friendly POS with offline capability",
      "Multiple payment method support",
      "Real-time sales analytics and peak time reporting",
      "Mobile-optimized interface for tablets and phones"
    ],
    recommended_tiers: ["pilot_solo", "pilot_lite", "pilot_core"],
    success_stories: [
      "Reduced transaction time by 50% with intuitive POS",
      "Increased daily sales by 25% through better peak hour management",
      "Improved customer satisfaction with faster service"
    ]
  },
  multi_location: {
    name: "Multi-Location Businesses",
    description: "Centralized management for businesses with multiple locations",
    challenges: [
      "Maintaining consistency across locations",
      "Consolidating reporting and analytics",
      "Managing inventory transfers between locations",
      "Coordinating staff and operations"
    ],
    solutions: [
      "Centralized dashboard for all locations",
      "Location-specific and consolidated reporting",
      "Automated inventory transfers and balancing",
      "Cross-location staff management and scheduling"
    ],
    recommended_tiers: ["pilot_pro", "enterprise"],
    success_stories: [
      "Reduced operational costs by 20% through centralized management",
      "Improved inventory efficiency with automated transfers",
      "Increased profitability through better location performance analysis"
    ]
  },
  enterprise: {
    name: "Enterprise & Franchises",
    description: "Large-scale operations requiring custom solutions and dedicated support",
    challenges: [
      "Complex operational requirements and workflows",
      "Integration with existing enterprise systems",
      "Compliance and security requirements",
      "Scalability across hundreds of locations"
    ],
    solutions: [
      "Custom feature development for specific needs",
      "Enterprise-grade security and compliance tools",
      "Dedicated support and account management",
      "White-label branding and custom workflows"
    ],
    recommended_tiers: ["enterprise"],
    success_stories: [
      "Franchise chain reduced operational overhead by 35% with custom automation",
      "Enterprise client achieved 99.9% uptime with dedicated SLA",
      "Large retailer improved brand consistency with white-label solution"
    ]
  }
} as const;

// Frequently Asked Questions
export const FREQUENTLY_ASKED_QUESTIONS = {
  general: [
    {
      question: "What is BizPilot?",
      answer: "BizPilot is a comprehensive business management platform that combines point-of-sale (POS), inventory management, customer relationship management (CRM), and business analytics in one integrated solution. It's designed to help businesses of all sizes streamline their operations and increase profitability."
    },
    {
      question: "How is BizPilot different from other POS systems?",
      answer: "BizPilot goes beyond traditional POS systems by offering integrated inventory management, AI-powered insights, multi-location support, and comprehensive business analytics. It's a complete business management platform, not just a payment processor."
    },
    {
      question: "Can BizPilot work offline?",
      answer: "Yes, BizPilot's POS system works offline and automatically syncs data when internet connection is restored. This ensures your business can continue operating even during internet outages."
    },
    {
      question: "What devices does BizPilot support?",
      answer: "BizPilot works on tablets, smartphones, computers, and dedicated POS terminals. It's web-based, so it runs on any device with a modern web browser, including iOS, Android, Windows, and Mac devices."
    },
    {
      question: "Is my data secure with BizPilot?",
      answer: "Yes, BizPilot uses enterprise-grade security including data encryption, secure cloud hosting, regular backups, and compliance with international security standards. Enterprise customers get additional security features like SSO and audit logs."
    }
  ],
  pricing: [
    {
      question: "How much does BizPilot cost?",
      answer: "BizPilot offers 5 pricing tiers: Pilot Solo (Free), Pilot Lite (R199/month), Pilot Core (R799/month), Pilot Pro (R1,499/month), and Enterprise (Custom pricing). Each tier includes different features and capabilities to match your business needs."
    },
    {
      question: "Is there a free trial?",
      answer: "Yes, you can start with Pilot Solo completely free with no time limit. This gives you access to basic POS functionality for up to 50 orders per month. You can upgrade to a paid plan anytime as your business grows."
    },
    {
      question: "Can I change my plan later?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated. For Enterprise plans, contact our sales team to discuss custom arrangements."
    },
    {
      question: "What's included in Enterprise pricing?",
      answer: "Enterprise pricing is customized based on your specific needs and includes unlimited everything, white labeling, custom development, dedicated support, SLA guarantees, and advanced security features. Contact our sales team for a personalized quote."
    },
    {
      question: "Are there any setup fees or hidden costs?",
      answer: "No, there are no setup fees or hidden costs. The monthly price includes all features listed in your chosen tier, hosting, support, and regular updates. Enterprise customers may have custom implementation costs depending on their requirements."
    }
  ],
  features: [
    {
      question: "What payment methods does BizPilot accept?",
      answer: "BizPilot supports cash, credit/debit cards, mobile payments, and digital wallets. We integrate with major South African payment processors including PayStack, and Enterprise customers can add custom payment integrations."
    },
    {
      question: "Can BizPilot manage inventory?",
      answer: "Yes, Pilot Core and higher tiers include comprehensive inventory management with real-time stock tracking, automated reordering, supplier management, and cost calculations. Pilot Lite and Pilot Solo focus on sales tracking without inventory features."
    },
    {
      question: "Does BizPilot integrate with accounting software?",
      answer: "Yes, BizPilot integrates with popular accounting software including Xero and Sage. This integration is available in Pilot Core and higher tiers. Enterprise customers can get custom integrations with other accounting systems."
    },
    {
      question: "Can multiple staff members use BizPilot?",
      answer: "Yes, all paid tiers support multiple users with role-based permissions. Pilot Lite supports up to 3 users, while Pilot Core and higher support unlimited users. Each user can have different access levels and permissions."
    },
    {
      question: "What kind of reports does BizPilot provide?",
      answer: "BizPilot provides comprehensive reporting including sales reports, inventory reports, customer analytics, staff performance, and financial summaries. Pilot Pro and Enterprise tiers include AI-powered insights and predictive analytics."
    }
  ],
  support: [
    {
      question: "What support is available?",
      answer: "All tiers include email support. Pilot Pro includes priority support with faster response times. Enterprise customers get dedicated account managers, 24/7 support, and guaranteed response times with SLA protection."
    },
    {
      question: "Is training provided?",
      answer: "Yes, we provide comprehensive training materials, video tutorials, and documentation for all users. Enterprise customers receive personalized on-site training and implementation support."
    },
    {
      question: "How do I get started with BizPilot?",
      answer: "You can start immediately with our free Pilot Solo tier - no credit card required. Simply sign up on our website, and you'll have access to the platform within minutes. Our onboarding process guides you through setup."
    },
    {
      question: "Can I migrate data from my current system?",
      answer: "Yes, we provide data migration assistance for customers upgrading from other systems. Enterprise customers receive dedicated migration support with guaranteed data integrity and minimal downtime."
    }
  ],
  enterprise: [
    {
      question: "What makes Enterprise different from other tiers?",
      answer: "Enterprise includes everything in other tiers plus unlimited locations/terminals, white labeling, custom development, dedicated account manager, 99.9% uptime SLA, advanced security, custom workflows, and 24/7 dedicated support."
    },
    {
      question: "How is Enterprise pricing determined?",
      answer: "Enterprise pricing is customized based on your specific requirements including number of locations, users, custom features needed, integration complexity, and support level required. Contact our sales team for a personalized assessment and quote."
    },
    {
      question: "What is white labeling?",
      answer: "White labeling allows you to customize BizPilot with your own branding, including your logo, colors, and domain name. Your customers and staff will see your brand throughout the platform, not BizPilot branding."
    },
    {
      question: "What kind of custom development is available?",
      answer: "We can develop custom features, integrations, workflows, and reports specifically for your business needs. This includes connecting to your existing systems, creating specialized functionality, and building custom user interfaces."
    },
    {
      question: "What does the SLA guarantee include?",
      answer: "Our Enterprise SLA guarantees 99.9% uptime with financial compensation for any downtime. It also includes guaranteed response times: 1 hour for system outages, 4 hours for critical issues, and dedicated technical support team."
    }
  ]
} as const;

// Benefits and Value Propositions
export const BUSINESS_BENEFITS = {
  cost_savings: {
    title: "Reduce Operating Costs",
    description: "Streamline operations and reduce manual work with automation",
    benefits: [
      "Reduce staff time on administrative tasks by up to 40%",
      "Minimize inventory waste with smart stock management",
      "Lower accounting costs with automated financial reporting",
      "Reduce errors and associated costs with integrated systems"
    ]
  },
  revenue_growth: {
    title: "Increase Revenue",
    description: "Boost sales and customer satisfaction with better service",
    benefits: [
      "Faster service leads to higher customer turnover",
      "Customer loyalty programs increase repeat business",
      "AI insights help optimize pricing and inventory",
      "Multi-location management enables business expansion"
    ]
  },
  time_savings: {
    title: "Save Time",
    description: "Automate routine tasks and focus on growing your business",
    benefits: [
      "Automated inventory management saves hours weekly",
      "Integrated reporting eliminates manual data compilation",
      "Streamlined operations reduce daily administrative work",
      "Real-time insights enable faster decision making"
    ]
  },
  better_insights: {
    title: "Make Better Decisions",
    description: "Data-driven insights help optimize your business performance",
    benefits: [
      "Real-time dashboards show business performance at a glance",
      "AI-powered forecasting helps plan inventory and staffing",
      "Customer analytics reveal buying patterns and preferences",
      "Financial reports provide clear profitability insights"
    ]
  },
  scalability: {
    title: "Scale Your Business",
    description: "Grow from single location to multi-location enterprise",
    benefits: [
      "Add locations and users without system limitations",
      "Centralized management maintains consistency across locations",
      "Enterprise features support complex business requirements",
      "Custom development adapts to unique business needs"
    ]
  }
} as const;

// Contact Information and Next Steps
export const CONTACT_INFORMATION = {
  sales: {
    email: "sales@bizpilot.co.za",
    phone: "+27 (0) 21 123 4567",
    purpose: "For Enterprise inquiries, custom pricing, and business consultations"
  },
  support: {
    email: "support@bizpilot.co.za",
    phone: "+27 (0) 21 123 4568",
    purpose: "For technical support, account help, and general questions"
  },
  demo: {
    url: "https://bizpilot.co.za/demo",
    purpose: "Schedule a personalized demo to see BizPilot in action"
  },
  signup: {
    url: "https://bizpilot.co.za/signup",
    purpose: "Start your free Pilot Solo account immediately"
  }
} as const;

// Quick reference data for AI responses
export const QUICK_FACTS = {
  company_name: "BizPilot",
  tagline: "Smart Business Management Platform",
  founded: "2023",
  location: "South Africa",
  currency: "South African Rand (ZAR)",
  target_market: "Small to enterprise businesses in South Africa and beyond",
  key_differentiators: [
    "AI-powered business insights",
    "Integrated POS, inventory, and CRM",
    "Multi-location management",
    "Enterprise customization options",
    "South African payment integration"
  ]
} as const;

export const TIER_COMPARISON = {
  pilot_solo: {
    best_for: "Solo entrepreneurs, market stalls",
    price: "Free",
    key_limitation: "50 orders/month, 1 user"
  },
  pilot_lite: {
    best_for: "Coffee shops, food trucks",
    price: "R199/month",
    key_feature: "Basic reports, 3 users"
  },
  pilot_core: {
    best_for: "Restaurants, retail stores",
    price: "R799/month",
    key_feature: "Full inventory management"
  },
  pilot_pro: {
    best_for: "Growing businesses, chains",
    price: "R1,499/month",
    key_feature: "AI insights, multi-location"
  },
  enterprise: {
    best_for: "Large businesses, franchises",
    price: "Custom pricing",
    key_feature: "Unlimited everything, custom development"
  }
} as const;

// Comprehensive Marketing Knowledge Base
export const MARKETING_KNOWLEDGE_BASE = {
  features: BIZPILOT_FEATURES,
  enterprise_features: ENTERPRISE_FEATURES,
  pricing: PRICING_INFORMATION,
  use_cases: INDUSTRY_USE_CASES,
  faqs: FREQUENTLY_ASKED_QUESTIONS,
  benefits: BUSINESS_BENEFITS,
  contact: CONTACT_INFORMATION,
  quick_facts: QUICK_FACTS,
  tier_comparison: TIER_COMPARISON
} as const;

// Type definitions for TypeScript usage
export type BizPilotFeature = keyof typeof BIZPILOT_FEATURES;
export type EnterpriseFeature = keyof typeof ENTERPRISE_FEATURES;
export type PricingTier = keyof typeof PRICING_INFORMATION;
export type IndustryUseCase = keyof typeof INDUSTRY_USE_CASES;
export type FAQCategory = keyof typeof FREQUENTLY_ASKED_QUESTIONS;
export type BusinessBenefit = keyof typeof BUSINESS_BENEFITS;

export default MARKETING_KNOWLEDGE_BASE;