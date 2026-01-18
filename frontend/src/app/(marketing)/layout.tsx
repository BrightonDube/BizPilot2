import { Metadata } from 'next'
import { MarketingLayoutClient } from '@/components/layout/MarketingLayoutClient'

export const metadata: Metadata = {
  title: {
    template: '%s | BizPilot - AI-Powered Business Management',
    default: 'BizPilot - AI-Powered Business Management Platform'
  },
  description: 'Complete AI-powered POS & ERP system for modern businesses. From point-of-sale to inventory management with intelligent automation and smart decision-making.',
  keywords: ['AI business management', 'POS system', 'ERP software', 'inventory management', 'intelligent automation', 'business analytics'],
  authors: [{ name: 'BizPilot Team' }],
  creator: 'BizPilot',
  publisher: 'BizPilot',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://bizpilot.com',
    siteName: 'BizPilot',
    title: 'BizPilot - AI-Powered Business Management Platform',
    description: 'Complete AI-powered POS & ERP system for modern businesses with intelligent automation.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BizPilot - AI-Powered Business Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BizPilot - AI-Powered Business Management Platform',
    description: 'Complete AI-powered POS & ERP system for modern businesses with intelligent automation.',
    images: ['/og-image.png'],
    creator: '@bizpilot',
  },
}

interface MarketingLayoutProps {
  children: React.ReactNode
}

export default function MarketingLayout({
  children,
}: MarketingLayoutProps) {
  return <MarketingLayoutClient>{children}</MarketingLayoutClient>
}