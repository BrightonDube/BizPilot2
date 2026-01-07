'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Edit,
  Trash2,
  CreditCard,
  Calendar,
  DollarSign,
  FileText,
  User,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Button, Card, CardContent, Badge, PageHeader } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface PaymentDetail {
  id: string
  payment_number: string
  invoice_id: string | null
  invoice_number: string | null
  customer_id: string | null
  customer_name: string | null
  amount: number
  payment_method: string
  status: string
  payment_date: string
  reference: string | null
  notes: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  succeeded: 'bg-green-900/30 text-green-400 border-green-500/30',
  completed: 'bg-green-900/30 text-green-400 border-green-500/30',
  failed: 'bg-red-900/30 text-red-400 border-red-500/30',
  refunded: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
  cancelled: 'bg-gray-900/30 text-gray-400 border-gray-500/30',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  processing: RefreshCw,
  succeeded: CheckCircle,
  completed: CheckCircle,
  failed: XCircle,
  refunded: DollarSign,
  cancelled: XCircle,
}

const PROVIDER_NAMES: Record<string, string> = {
  payfast: 'PayFast',
  yoco: 'Yoco',
  ozow: 'Ozow',
  snapscan: 'SnapScan',
  zapper: 'Zapper',
  stripe: 'Stripe',
  manual: 'Manual',
  eft: 'EFT',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PaymentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const paymentId = params.id as string

  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function fetchPayment() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiClient.get<PaymentDetail>(`/payments/${paymentId}`)
        setPayment(response.data)
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

  const handleDelete = async () => {
    if (!payment) return
    if (!window.confirm(`Are you sure you want to delete payment ${payment.payment_number}? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await apiClient.delete(`/payments/${paymentId}`)
      router.push('/payments')
    } catch (err) {
      console.error('Error deleting payment:', err)
      setError('Failed to delete payment')
      setIsDeleting(false)
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

  if (error || !payment) {
    return (
      <div className="text-center py-12">
        <CreditCard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">Payment not found</h3>
        <p className="text-gray-400 mb-6">{error || 'The payment you are looking for does not exist.'}</p>
        <Link href="/payments">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Button>
        </Link>
      </div>
    )
  }

  const StatusIcon = STATUS_ICONS[payment.status] || Clock

  return (
    <div>
      <PageHeader
        title={`Payment ${payment.payment_number}`}
        description={`Recorded on ${formatDate(payment.payment_date)}`}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/payments">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link href={`/payments/${payment.id}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-green-500/20 text-green-400">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{formatCurrency(payment.amount)}</h2>
                    <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium border ${STATUS_COLORS[payment.status] || STATUS_COLORS.pending}`}>
                      <StatusIcon className="h-3 w-3" />
                      <span>{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">Payment #{payment.payment_number}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Payment Details</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <span>{PROVIDER_NAMES[payment.payment_method] || payment.payment_method}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{formatDate(payment.payment_date)}</span>
                  </div>
                  {payment.reference && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span>Ref: {payment.reference}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Customer & Invoice</h3>
                  {payment.customer_name ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <User className="w-4 h-4 text-gray-500" />
                      {payment.customer_id ? (
                        <Link href={`/customers/${payment.customer_id}`} className="text-blue-400 hover:text-blue-300">
                          {payment.customer_name}
                        </Link>
                      ) : (
                        <span>{payment.customer_name}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No customer linked</p>
                  )}
                  {payment.invoice_id ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <Link href={`/invoices/${payment.invoice_id}`} className="text-blue-400 hover:text-blue-300">
                        {payment.invoice_number || 'View Invoice'}
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No invoice linked</p>
                  )}
                </div>
              </div>

              {payment.notes && (
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
                  <p className="text-gray-200 whitespace-pre-wrap text-sm">{payment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Payment ID</span>
                  <span className="text-gray-200 font-mono text-xs truncate" title={payment.id}>
                    {payment.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Status</span>
                  <Badge variant={payment.status === 'completed' || payment.status === 'succeeded' ? 'success' : 'default'}>
                    {payment.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
