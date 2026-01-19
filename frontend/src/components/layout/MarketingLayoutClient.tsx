'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import { MarketingFooter } from '@/components/common/MarketingFooter'
import { GlobalAIChat } from '@/components/ai/GlobalAIChat'

interface MarketingLayoutClientProps {
  children: React.ReactNode
}

export function MarketingLayoutClient({
  children,
}: MarketingLayoutClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950">
      
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

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-gray-300 hover:text-white"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="md:hidden overflow-hidden"
                >
                  <div className="py-4 space-y-2">
                    <Link 
                      href="/features" 
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Features
                    </Link>
                    <Link 
                      href="/industries" 
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Industries
                    </Link>
                    <Link 
                      href="/pricing" 
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Pricing
                    </Link>
                    <Link 
                      href="/faq" 
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      FAQ
                    </Link>
                    <Link 
                      href="/auth/login" 
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link 
                      href="/auth/register" 
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </header>

      {/* Page Content */}
      <main role="main">
        {children}
      </main>

      {/* Footer */}
      <MarketingFooter />
      
      {/* AI Chat Widget for Marketing Pages */}
      <GlobalAIChat />
    </div>
  )
}