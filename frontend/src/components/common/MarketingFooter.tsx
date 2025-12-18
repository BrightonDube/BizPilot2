'use client'

import { Logo } from '@/components/common/Logo'

export function MarketingFooter() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <Logo width={24} height={24} />
            <span className="ml-2 font-semibold text-white">BizPilot</span>
          </div>
          <p className="text-gray-400 text-sm">© 2025 BizPilot. Built with ❤️ for businesses everywhere.</p>
        </div>
      </div>
    </footer>
  )
}
