'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export function AuthErrorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const error = searchParams.get('error') || 'Authentication failed'
  const errorDescription =
    searchParams.get('error_description') || 'An unexpected error occurred during authentication.'
  const errorCode = searchParams.get('error_code') || ''

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-gray-950 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-md w-full text-center">
        <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-8">
          <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Authentication Error</h2>
          <div className="mb-6">
            <p className="text-red-400 text-sm font-medium mb-2">{error}</p>
            <p className="text-gray-400 text-sm">{errorDescription}</p>
            {errorCode && <p className="text-gray-500 text-xs mt-2">Error Code: {errorCode}</p>}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 flex items-center gap-2 text-white"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default AuthErrorPage
