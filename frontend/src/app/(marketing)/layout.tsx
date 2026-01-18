import Link from 'next/link'
import { Logo } from '@/components/common/Logo'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { ShaderBackground } from '@/components/ui'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <ShaderBackground />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Logo width={32} height={32} />
              <span className="text-xl font-bold text-white">BizPilot</span>
            </Link>

            <div className="hidden md:flex items-center space-x-8">
              <Link href="/features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="/industries" className="text-gray-300 hover:text-white transition-colors">
                Industries
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/faq" className="text-gray-300 hover:text-white transition-colors">
                FAQ
              </Link>
              <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link 
                href="/auth/register" 
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile menu button - will be enhanced in future iterations */}
            <div className="md:hidden">
              <Link 
                href="/auth/register" 
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}

      {/* Footer */}
      <MarketingFooter />
    </div>
  )
}