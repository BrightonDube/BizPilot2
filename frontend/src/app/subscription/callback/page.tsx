'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'

interface VerifyPaymentResponse {
  status: 'success' | 'failed' | 'pending'
  message: string
  tier?: string
}

function SubscriptionCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference')
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading')
  const [message, setMessage] = useState('')
  const [tierName, setTierName] = useState<string | null>(null)

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setStatus('failed')
        setMessage('No payment reference found')
        return
      }

      try {
        const { data } = await apiClient.post<VerifyPaymentResponse>('/payments/checkout/verify', {
          reference,
        })
        setStatus(data.status)
        setMessage(data.message)
        setTierName(data.tier || null)

        // Auto-redirect to dashboard on success after 3 seconds
        if (data.status === 'success') {
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        }
      } catch (error) {
        setStatus('failed')
        setMessage('Failed to verify payment. Please contact support.')
      }
    }

    verifyPayment()
  }, [reference, router])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Verifying Payment</h1>
            <p className="text-gray-400">Please wait while we confirm your payment...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-gray-400 mb-2">{message}</p>
            {tierName && (
              <p className="text-purple-400 font-medium mb-6">
                Welcome to {tierName}!
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              Redirecting to dashboard in 3 seconds...
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'failed' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
            <p className="text-gray-400 mb-6">{message}</p>
            <div className="flex flex-col gap-3">
              <Link
                href="/pricing"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <Loader2 className="w-16 h-16 text-yellow-500 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Payment Pending</h1>
            <p className="text-gray-400 mb-6">{message}</p>
            <p className="text-sm text-gray-500 mb-6">
              Your payment is still being processed. This page will update automatically.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Check Again
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
        <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Loading</h1>
        <p className="text-gray-400">Please wait...</p>
      </div>
    </div>
  )
}

export default function SubscriptionCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SubscriptionCallbackContent />
    </Suspense>
  )
}
