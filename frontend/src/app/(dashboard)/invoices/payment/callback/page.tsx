'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { apiClient } from '@/lib/api'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

interface VerificationResult {
  status: 'success' | 'failed'
  message: string
  invoice_id?: string
  amount_paid?: number
  gateway_fees?: number
}

export default function PaymentCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference') || searchParams.get('trxref')

  const [verifying, setVerifying] = useState(true)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setError('No payment reference found')
        setVerifying(false)
        return
      }

      try {
        const response = await apiClient.post('/invoices/payment/verify', {
          reference
        })
        setResult(response.data)
      } catch (err: unknown) {
        console.error('Error verifying payment:', err)
        const error = err as { response?: { data?: { detail?: string } } }
        setError(error.response?.data?.detail || 'Failed to verify payment')
      } finally {
        setVerifying(false)
      }
    }

    verifyPayment()
  }, [reference])

  if (verifying) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Verifying Payment</h2>
          <p className="text-gray-400">Please wait while we confirm your payment...</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="bg-red-900/20 border-red-500/30 max-w-md">
            <CardContent className="p-8 text-center">
              <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Verification Failed</h2>
              <p className="text-gray-400 mb-6">{error}</p>
              <Button onClick={() => router.push('/invoices')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (result?.status === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="bg-green-900/20 border-green-500/30 max-w-md">
            <CardContent className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              >
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
              <p className="text-gray-400 mb-6">{result.message}</p>
              
              {result.amount_paid && (
                <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount Paid</span>
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(result.amount_paid)}
                    </span>
                  </div>
                  {result.gateway_fees && result.gateway_fees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Gateway Fees</span>
                      <span className="text-gray-400">
                        {formatCurrency(result.gateway_fees)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push('/invoices')}
                  className="border-gray-600"
                >
                  View All Invoices
                </Button>
                {result.invoice_id && (
                  <Button
                    onClick={() => router.push(`/invoices/${result.invoice_id}`)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    View Invoice
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // Payment failed or was abandoned
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="bg-yellow-900/20 border-yellow-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Payment Not Completed</h2>
            <p className="text-gray-400 mb-6">
              {result?.message || 'The payment was not completed. You can try again.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.push('/invoices')}
                className="border-gray-600"
              >
                Back to Invoices
              </Button>
              {result?.invoice_id && (
                <Button
                  onClick={() => router.push(`/invoices/${result.invoice_id}`)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
