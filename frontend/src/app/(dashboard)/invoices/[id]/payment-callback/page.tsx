'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ArrowLeft,
  AlertCircle 
} from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface VerificationResult {
  status: 'success' | 'failed' | 'pending'
  message: string
  invoice_id?: string
  invoice_number?: string
  amount_paid?: number
  gateway_fee?: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function PaymentCallbackPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const invoiceId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function verifyPayment() {
      const reference = searchParams.get('reference') || searchParams.get('trxref')
      
      if (!reference) {
        setError('No payment reference found. Please try again.')
        setLoading(false)
        return
      }

      try {
        const response = await apiClient.post(`/invoices/${invoiceId}/verify-payment`, {
          reference
        })
        setResult(response.data)
      } catch (err: unknown) {
        console.error('Error verifying payment:', err)
        const error = err as { response?: { data?: { detail?: string } } }
        setError(error.response?.data?.detail || 'Failed to verify payment')
      } finally {
        setLoading(false)
      }
    }

    if (invoiceId) {
      verifyPayment()
    }
  }, [invoiceId, searchParams])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Verifying Payment...</h2>
          <p className="text-gray-400">Please wait while we confirm your payment</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-red-900/20 border-red-500/30 max-w-md">
            <CardContent className="p-6 text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Payment Verification Failed</h2>
              <p className="text-gray-400 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/invoices/${invoiceId}`)}
                  className="border-gray-600"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (result?.status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="bg-green-900/20 border-green-500/30 max-w-md">
            <CardContent className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
              <p className="text-gray-300 mb-6">{result.message}</p>
              
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                {result.invoice_number && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Invoice</span>
                    <span className="text-white font-medium">{result.invoice_number}</span>
                  </div>
                )}
                {result.amount_paid && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Amount Paid</span>
                    <span className="text-green-400 font-medium">{formatCurrency(result.amount_paid)}</span>
                  </div>
                )}
                {result.gateway_fee && result.gateway_fee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gateway Fee</span>
                    <span className="text-yellow-400 font-medium">{formatCurrency(result.gateway_fee)}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => router.push(`/invoices/${invoiceId}`)}
                className="bg-green-600 hover:bg-green-700 w-full"
              >
                View Invoice
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (result?.status === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-yellow-900/20 border-yellow-500/30 max-w-md">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Payment Pending</h2>
              <p className="text-gray-400 mb-6">{result.message}</p>
              <Button
                onClick={() => router.push(`/invoices/${invoiceId}`)}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                Back to Invoice
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // Failed status
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-red-900/20 border-red-500/30 max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Payment Failed</h2>
            <p className="text-gray-400 mb-6">{result?.message || 'Your payment could not be processed.'}</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.push(`/invoices/${invoiceId}`)}
                className="border-gray-600"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
