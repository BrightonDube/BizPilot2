'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, CreditCard } from 'lucide-react'
import { Button, Input, Select, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface PaymentDetail {
  id: string
  payment_number: string
  invoice_id: string | null
  customer_id: string | null
  amount: number
  payment_method: string
  status: string
  payment_date: string
  reference: string | null
  notes: string | null
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'eft', label: 'EFT' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'check', label: 'Check' },
  { value: 'payfast', label: 'PayFast' },
  { value: 'yoco', label: 'Yoco' },
  { value: 'snapscan', label: 'SnapScan' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function EditPaymentPage() {
  const params = useParams()
  const router = useRouter()
  const paymentId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'cash',
    status: 'pending',
    payment_date: '',
    reference: '',
    notes: '',
  })

  useEffect(() => {
    async function fetchPayment() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiClient.get<PaymentDetail>(`/payments/${paymentId}`)
        const payment = response.data
        setFormData({
          amount: payment.amount.toString(),
          payment_method: payment.payment_method || 'cash',
          status: payment.status || 'pending',
          payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : '',
          reference: payment.reference || '',
          notes: payment.notes || '',
        })
      } catch (err) {
        console.error('Error fetching payment:', err)
        setError('Failed to load payment')
      } finally {
        setIsLoading(false)
      }
    }

    if (paymentId) {
      fetchPayment()
    }
  }, [paymentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      await apiClient.put(`/payments/${paymentId}`, {
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        status: formData.status,
        payment_date: formData.payment_date || null,
        reference: formData.reference || null,
        notes: formData.notes || null,
      })
      router.push(`/payments/${paymentId}`)
    } catch (err) {
      console.error('Error updating payment:', err)
      setError('Failed to update payment')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading payment...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Edit Payment</h1>
          <p className="text-gray-400">Update payment details</p>
        </div>
        <Link href={`/payments/${paymentId}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-400" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Amount (ZAR) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                className="bg-gray-900/50 border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Payment Method *
              </label>
              <Select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full"
                required
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Status *
              </label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full"
                required
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Payment Date
              </label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="bg-gray-900/50 border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reference
              </label>
              <Input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Transaction reference or ID"
                className="bg-gray-900/50 border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/payments/${paymentId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
