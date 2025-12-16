'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Filter,
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  Eye,
  FileText,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { Button, Input, Card, CardContent, Badge } from '@/components/ui'
import { apiClient } from '@/lib/api'

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'completed' | 'failed' | 'refunded' | 'cancelled'

interface Payment {
  id: string
  payment_number: string
  invoice_id: string
  invoice_number: string
  customer_name: string
  amount: number
  payment_method: string
  status: PaymentStatus
  payment_date: string
  reference: string | null
  refund_amount?: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  succeeded: 'bg-green-900/30 text-green-400 border-green-500/30',
  completed: 'bg-green-900/30 text-green-400 border-green-500/30',
  failed: 'bg-red-900/30 text-red-400 border-red-500/30',
  refunded: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
  cancelled: 'bg-gray-900/30 text-gray-400 border-gray-500/30'
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  processing: RefreshCw,
  succeeded: CheckCircle,
  completed: CheckCircle,
  failed: XCircle,
  refunded: DollarSign,
  cancelled: XCircle
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
  bank_transfer: 'Bank Transfer'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function PaymentCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
        <div className="h-6 bg-gray-700 rounded w-24" />
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiClient.get('/payments')
      setPayments(response.data.items || [])
    } catch (err) {
      console.error('Failed to fetch payments:', err)
      setError('Failed to load payments')
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const totalReceived = payments
    .filter((p) => p.status === 'completed' || p.status === 'succeeded')
    .reduce((sum, p) => sum + (p.amount || 0) - (p.refund_amount || 0), 0)
  const pendingAmount = payments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + (p.amount || 0), 0)
  const completedCount = payments.filter((p) => p.status === 'completed' || p.status === 'succeeded').length
  const refundedAmount = payments.reduce((sum, p) => sum + (p.refund_amount || 0), 0)

  // Loading state with skeletons
  if (isLoading && payments.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Payments</h1>
            <p className="text-gray-400">Track and manage payment transactions</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
              <div className="flex items-center">
                <div className="p-2 bg-gray-700 rounded-lg w-10 h-10" />
                <div className="ml-4 space-y-2">
                  <div className="h-3 bg-gray-700 rounded w-20" />
                  <div className="h-6 bg-gray-700 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <PaymentCardSkeleton key={i} />
          ))}
        </div>
      </motion.div>
    )
  }

  // Error state
  if (error && payments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center"
      >
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-medium text-lg mb-2 text-white">Unable to load payments</h3>
        <p className="text-sm mb-4 text-gray-400">{error}</p>
        <Button onClick={() => fetchPayments()} className="bg-gradient-to-r from-blue-600 to-purple-600">
          Try Again
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Payments</h1>
          <p className="text-gray-400">Track and manage payment transactions</p>
        </div>
        <Link href="/payments/new">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </Link>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'Total Received', value: formatCurrency(totalReceived), color: 'green' },
          { icon: Clock, label: 'Pending', value: formatCurrency(pendingAmount), color: 'yellow' },
          { icon: CheckCircle, label: 'Completed', value: completedCount, color: 'blue' },
          { icon: TrendingUp, label: 'Refunded', value: formatCurrency(refundedAmount), color: 'orange' }
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="flex items-center">
              <motion.div 
                className={`p-2 bg-${stat.color}-500/20 rounded-lg border border-${stat.color}-500/30`}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <stat.icon className={`h-6 w-6 text-${stat.color}-400`} />
              </motion.div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                <motion.p 
                  className="text-2xl font-bold text-gray-100"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1, type: "spring", stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search and Filters */}
      <motion.div 
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500" />
            <Input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-600"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-gray-700' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-gray-700">
                <label className="block text-sm font-medium text-gray-300 mb-2">Status Filter</label>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'processing', 'succeeded', 'completed', 'failed', 'refunded'] as PaymentStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                        selectedStatus === status
                          ? STATUS_COLORS[status]
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <motion.div 
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <CreditCard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {searchTerm || selectedStatus !== 'all' ? 'No payments found' : 'No payments yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || selectedStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Record your first payment to get started'
            }
          </p>
          {!searchTerm && selectedStatus === 'all' && (
            <Link href="/payments/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Record Your First Payment
              </Button>
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Payment #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredPayments.map((payment, index) => {
                  const StatusIcon = STATUS_ICONS[payment.status] || Clock
                  
                  return (
                    <motion.tr 
                      key={payment.id}
                      className="hover:bg-gray-800/50 transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.03 }}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/payments/${payment.id}`} className="font-medium text-blue-400 hover:text-blue-300">
                          {payment.payment_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>{formatDate(payment.payment_date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{payment.customer_name || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-100 font-medium">{formatCurrency(payment.amount)}</div>
                        {payment.refund_amount && payment.refund_amount > 0 && (
                          <div className="text-sm text-orange-400">
                            Refunded: {formatCurrency(payment.refund_amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-300">
                            {PROVIDER_NAMES[payment.payment_method] || payment.payment_method || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium border ${STATUS_COLORS[payment.status] || STATUS_COLORS.pending}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {payment.invoice_id ? (
                          <Link 
                            href={`/invoices/${payment.invoice_id}`}
                            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
                          >
                            <FileText className="h-4 w-4" />
                            <span>{payment.invoice_number || 'View'}</span>
                          </Link>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/payments/${payment.id}`}>
                          <motion.button
                            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                            title="View Details"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Eye className="h-4 w-4" />
                          </motion.button>
                        </Link>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      {filteredPayments.length > 0 && (
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-semibold text-gray-100 mb-4">Payment Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Payments', value: filteredPayments.length },
              { label: 'Total Received', value: formatCurrency(totalReceived) },
              { label: 'Pending', value: formatCurrency(pendingAmount) },
              { label: 'Refunded', value: formatCurrency(refundedAmount) }
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <motion.p 
                  className="text-2xl font-bold text-gray-100"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1, type: "spring", stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
