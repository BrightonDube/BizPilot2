import Link from 'next/link'
import { Metadata } from 'next'
import { Logo } from '@/components/common/Logo'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import ShaderBackground from '@/components/ui/shader-background'

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
  return (
    <div className="min-h-screen">
      <ShaderBackground />
      
      {/* Navigation */}
      <header>
        <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800" role="navigation" aria-label="Main navigation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity" aria-label="BizPilot Home">
                <Logo width={32} height={32} />
                <span className="text-xl font-bold text-white">BizPilot</span>
              </Link>

              <div className="hidden md:flex items-center space-x-8">
                <Link href="/features" className="text-gray-300 hover:text-white transition-colors" aria-label="View Features">
                  Features
                </Link>
                <Link href="/industries" className="text-gray-300 hover:text-white transition-colors" aria-label="View Industries">
                  Industries
                </Link>
                <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors" aria-label="View Pricing">
                  Pricing
                </Link>
                <Link href="/faq" className="text-gray-300 hover:text-white transition-colors" aria-label="Frequently Asked Questions">
                  FAQ
                </Link>
                <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors" aria-label="Sign In">
                  Sign In
                </Link>
                <Link 
                  href="/auth/register" 
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all"
                  aria-label="Get Started with BizPilot"
                >
                  Get Started
                </Link>
              </div>

              {/* Mobile menu button - will be enhanced in future iterations */}
              <div className="md:hidden">
                <Link 
                  href="/auth/register" 
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all text-sm"
                  aria-label="Get Started with BizPilot"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Page Content */}
      <main role="main">
        {children}
      </main>

      {/* Footer */}
      <MarketingFooter />
    </div>
  )
}