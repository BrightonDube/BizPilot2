'use client'

import { motion } from 'framer-motion'
import { WifiOff, RefreshCw } from 'lucide-react'

interface TimeoutErrorProps {
  title?: string
  message?: string
  onRetry?: () => void
  icon?: React.ComponentType<{ className?: string }>
}

export function TimeoutError({
  title = 'Connection timeout',
  message = 'Loading is taking longer than expected. Please check your internet connection.',
  onRetry,
  icon: Icon = WifiOff,
}: TimeoutErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-[400px] flex items-center justify-center p-8"
    >
      <div className="rounded-xl border border-red-500/30 bg-red-900/20 max-w-md w-full">
        <div className="text-red-400 text-center py-8 px-6">
          <Icon className="h-16 w-16 mx-auto mb-4 opacity-75" />
          <h3 className="font-semibold text-xl mb-2 text-red-300">{title}</h3>
          <p className="text-sm mb-6 text-red-400/90">{message}</p>

          <div className="flex gap-3 justify-center">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/30 rounded-lg transition-all duration-200"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
