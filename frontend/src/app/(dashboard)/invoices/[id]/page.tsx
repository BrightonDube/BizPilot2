'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Send, 
  Download,
  Loader2, 
  Calendar,
  User,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  CreditCard,
  Building2,
  Mail,
  Phone
} from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { Badge } from '@/components/ui/bizpilot'
import { apiClient } from '@/lib/api'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  discount_percent: number
  discount_amount: number
  total: number
  line_total: number
}

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string | null
  customer_name?: string
  status: string
  issue_date: string
  due_date: string
  paid_date?: string
  billing_address?: Record<string, string>
  notes?: string
  terms?: string
  footer?: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  balance_due: number
  is_paid: boolean
  is_overdue: boolean
  pdf_url?: string
  items: InvoiceItem[]
  created_at: string
  updated_at: string
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

const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: <FileText className="w-4 h-4" />, label: 'Draft' },
  sent: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: <Send className="w-4 h-4" />, label: 'Sent' },
  viewed: { color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: <FileText className="w-4 h-4" />, label: 'Viewed' },
  paid: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: <CheckCircle className="w-4 h-4" />, label: 'Paid' },
  partial: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: <Clock className="w-4 h-4" />, label: 'Partial' },
  overdue: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: <AlertCircle className="w-4 h-4" />, label: 'Overdue' },
  cancelled: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: <FileText className="w-4 h-4" />, label: 'Cancelled' },
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')

  useEffect(() => {
    async function loadInvoice() {
      try {
        setLoading(true)
        const response = await apiClient.get(`/invoices/${invoiceId}`)
        setInvoice(response.data)
      } catch (err: unknown) {
        console.error('Error loading invoice:', err)
        const error = err as { response?: { data?: { detail?: string } } }
        setError(error.response?.data?.detail || 'Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }

    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId])

  const handleSendInvoice = async () => {
    if (!invoice) return
    if (!confirm(`Send invoice ${invoice.invoice_number} to customer?`)) return

    setActionLoading('send')
    try {
      const response = await apiClient.post(`/invoices/${invoiceId}/send`)
      setInvoice(response.data)
    } catch (err: unknown) {
      console.error('Error sending invoice:', err)
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || 'Failed to send invoice')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoice) return
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`)) return

    setActionLoading('delete')
    try {
      await apiClient.delete(`/invoices/${invoiceId}`)
      router.push('/invoices')
    } catch (err: unknown) {
      console.error('Error deleting invoice:', err)
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || 'Failed to delete invoice')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRecordPayment = async () => {
    if (!invoice) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }
    if (amount > invoice.balance_due) {
      alert('Payment amount exceeds balance due')
      return
    }

    setActionLoading('payment')
    try {
      const response = await apiClient.post(`/invoices/${invoiceId}/payment`, {
        amount,
        payment_method: paymentMethod
      })
      setInvoice(response.data)
      setShowPaymentModal(false)
      setPaymentAmount('')
    } catch (err: unknown) {
      console.error('Error recording payment:', err)
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || 'Failed to record payment')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="bg-red-900/20 border-red-500/30 max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Invoice Not Found</h2>
            <p className="text-gray-400 mb-4">{error || 'The invoice you are looking for does not exist.'}</p>
            <Button onClick={() => router.push('/invoices')}>
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = statusConfig[invoice.status] || statusConfig.draft
  const isOverdue = invoice.is_overdue || invoice.status === 'overdue'

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/invoices')}
            className="p-2 text-gray-400 hover:text-gray-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{invoice.invoice_number}</h1>
              <Badge variant={isOverdue ? 'danger' : invoice.status === 'paid' ? 'success' : 'secondary'}>
                <span className={`flex items-center gap-1 ${status.color}`}>
                  {status.icon}
                  {status.label}
                </span>
              </Badge>
            </div>
            <p className="text-gray-400 mt-1">
              Created on {formatDate(invoice.created_at)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {invoice.status === 'draft' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/invoices/${invoiceId}/edit`)}
                className="border-gray-600"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={handleSendInvoice}
                disabled={actionLoading === 'send'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {actionLoading === 'send' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Send Invoice
              </Button>
            </>
          )}
          
          {['sent', 'viewed', 'partial'].includes(invoice.status) && invoice.balance_due > 0 && (
            <Button
              size="sm"
              onClick={() => setShowPaymentModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteInvoice}
            disabled={actionLoading === 'delete'}
            className="border-red-600 text-red-400 hover:bg-red-900/20"
          >
            {actionLoading === 'delete' ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Items */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Invoice Items</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-sm font-medium text-gray-400 pb-3">Description</th>
                      <th className="text-right text-sm font-medium text-gray-400 pb-3">Qty</th>
                      <th className="text-right text-sm font-medium text-gray-400 pb-3">Unit Price</th>
                      <th className="text-right text-sm font-medium text-gray-400 pb-3">VAT</th>
                      <th className="text-right text-sm font-medium text-gray-400 pb-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={item.id || index} className="border-b border-gray-700/50">
                        <td className="py-3 text-white">{item.description}</td>
                        <td className="py-3 text-right text-gray-300">{item.quantity}</td>
                        <td className="py-3 text-right text-gray-300">{formatCurrency(item.unit_price)}</td>
                        <td className="py-3 text-right text-gray-300">{item.tax_rate}%</td>
                        <td className="py-3 text-right text-white font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="text-white">{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    {invoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Discount</span>
                        <span className="text-red-400">-{formatCurrency(invoice.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">VAT</span>
                      <span className="text-white">{formatCurrency(invoice.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-700">
                      <span className="text-white">Total</span>
                      <span className="text-white">{formatCurrency(invoice.total)}</span>
                    </div>
                    {invoice.amount_paid > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-green-400">
                          <span>Paid</span>
                          <span>-{formatCurrency(invoice.amount_paid)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold">
                          <span className={isOverdue ? 'text-red-400' : 'text-white'}>Balance Due</span>
                          <span className={isOverdue ? 'text-red-400' : 'text-white'}>{formatCurrency(invoice.balance_due)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {(invoice.notes || invoice.terms) && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                {invoice.terms && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Payment Terms</h3>
                    <p className="text-white">{invoice.terms}</p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Notes</h3>
                    <p className="text-white whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Invoice Info */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Invoice Details</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Issue Date</p>
                    <p className="text-white">{formatDate(invoice.issue_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Due Date</p>
                    <p className={isOverdue ? 'text-red-400' : 'text-white'}>{formatDate(invoice.due_date)}</p>
                  </div>
                </div>
                {invoice.paid_date && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Paid Date</p>
                      <p className="text-green-400">{formatDate(invoice.paid_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Customer</h3>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium">{invoice.customer_name || 'Walk-in Customer'}</p>
                  {invoice.billing_address && (
                    <div className="text-sm text-gray-400 mt-1">
                      {invoice.billing_address.street && <p>{invoice.billing_address.street}</p>}
                      {invoice.billing_address.city && <p>{invoice.billing_address.city}</p>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card className={`border ${isOverdue ? 'bg-red-900/20 border-red-500/30' : invoice.is_paid ? 'bg-green-900/20 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Payment Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total</span>
                  <span className="text-white font-semibold">{formatCurrency(invoice.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Paid</span>
                  <span className="text-green-400">{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className={isOverdue ? 'text-red-400 font-semibold' : 'text-gray-400'}>Balance Due</span>
                  <span className={`font-semibold ${isOverdue ? 'text-red-400' : invoice.is_paid ? 'text-green-400' : 'text-white'}`}>
                    {formatCurrency(invoice.balance_due)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 className="text-xl font-semibold text-white mb-4">Record Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (Balance: {formatCurrency(invoice.balance_due)})
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  max={invoice.balance_due}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="eft">EFT</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                className="border-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRecordPayment}
                disabled={actionLoading === 'payment'}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading === 'payment' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Record Payment
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
