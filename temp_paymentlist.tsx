import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  CreditCard,
  Calendar,
  FileText
} from 'lucide-react'
import { usePayments } from '../../hooks/usePayments'
import { useBusiness } from '../../hooks/useBusiness'
import { useCurrency } from '../../hooks/useCurrency'
import type { PaymentStatus } from '../../types/payments'

// Status color mapping
const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  succeeded: 'bg-green-900/30 text-green-400 border-green-500/30',
  failed: 'bg-red-900/30 text-red-400 border-red-500/30',
  refunded: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
  cancelled: 'bg-gray-900/30 text-gray-400 border-gray-500/30'
}

const STATUS_ICONS: Record<PaymentStatus, React.ComponentType<any>> = {
  pending: Clock,
  processing: RefreshCw,
  succeeded: CheckCircle,
  failed: XCircle,
  refunded: DollarSign,
  cancelled: XCircle
}

// Payment provider display names
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

export function PaymentList() {
  const navigate = useNavigate()
  const { userRole, hasPermission } = useBusiness()
  const { format: formatCurrency } = useCurrency()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentStatus[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  const { payments, loading, error, getPaymentStats } = usePayments({
    status: statusFilter.length > 0 ? statusFilter : undefined
  })

  // Check permissions
  const canCreate = hasPermission('payments', 'create') || userRole === 'admin' || userRole === 'manager'

  // Filter payments based on search term
  const filteredPayments = useMemo(() => {
    if (!searchTerm) return payments

    const term = searchTerm.toLowerCase()
    return payments.filter(payment => 
      payment.payment_number.toLowerCase().includes(term) ||
      payment.description?.toLowerCase().includes(term) ||
      payment.provider?.toLowerCase().includes(term)
    )
  }, [payments, searchTerm])

  const handleCreatePayment = () => {
    navigate('/payments/new')
  }

  const handleViewPayment = (id: string) => {
    navigate(`/payments/${id}`)
  }

  const toggleStatusFilter = (status: PaymentStatus) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-400">Loading payments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-900/20 border-red-500/30">
        <div className="text-red-400">
          <h3 className="font-medium">Error loading payments</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Payments</h1>
          <p className="text-gray-400 mt-1">Track and manage payment transactions</p>
        </div>
        {canCreate && (
          <motion.button
            onClick={handleCreatePayment}
            className="btn-primary flex items-center space-x-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-5 w-5" />
            <span>Record Payment</span>
          </motion.button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filters</span>
              {statusFilter.length > 0 && (
                <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                  {statusFilter.length}
                </span>
              )}
            </button>

            {statusFilter.length > 0 && (
              <button
                onClick={() => setStatusFilter([])}
                className="text-sm text-primary-400 hover:text-primary-300"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 border-t border-dark-700">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'processing', 'succeeded', 'failed', 'refunded'] as PaymentStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => toggleStatusFilter(status)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                          statusFilter.includes(status)
                            ? STATUS_COLORS[status]
                            : 'bg-dark-800 text-gray-400 border-dark-700 hover:border-dark-600'
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
        </div>
      </div>

      {/* Payments Table */}
      <div className="card overflow-hidden">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300">No payments found</h3>
            <p className="text-gray-400 mt-2">
              {searchTerm || statusFilter.length > 0
                ? 'Try adjusting your search or filters'
                : 'Record your first payment to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-800 border-b border-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Payment #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredPayments.map((payment) => {
                  const StatusIcon = STATUS_ICONS[payment.status]
                  
                  return (
                    <motion.tr 
                      key={payment.id}
                      className="hover:bg-dark-800 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewPayment(payment.id)}
                          className="font-medium text-primary-400 hover:text-primary-300"
                        >
                          {payment.payment_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>{formatDate(payment.paid_at || payment.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-300 font-medium">
                          {formatCurrency(payment.amount)}
                        </div>
                        {payment.refund_amount > 0 && (
                          <div className="text-sm text-orange-400">
                            Refunded: {formatCurrency(payment.refund_amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-300">
                            {PROVIDER_NAMES[payment.provider || ''] || payment.provider || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium border ${STATUS_COLORS[payment.status]}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {payment.invoice_id ? (
                          <button
                            onClick={() => navigate(`/invoices/${payment.invoice_id}`)}
                            className="flex items-center space-x-1 text-primary-400 hover:text-primary-300 text-sm"
                          >
                            <FileText className="h-4 w-4" />
                            <span>View Invoice</span>
                          </button>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewPayment(payment.id)}
                            className="p-1 text-gray-400 hover:text-primary-400 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {filteredPayments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-sm text-gray-400">Total Payments</div>
            <div className="text-2xl font-bold text-gray-100 mt-1">
              {filteredPayments.length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Total Received</div>
            <div className="text-2xl font-bold text-green-400 mt-1">
              {formatCurrency(filteredPayments.reduce((sum, p) => 
                p.status === 'succeeded' ? sum + p.amount - p.refund_amount : sum, 0
              ))}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Pending</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">
              {formatCurrency(filteredPayments.reduce((sum, p) => 
                ['pending', 'processing'].includes(p.status) ? sum + p.amount : sum, 0
              ))}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Refunded</div>
            <div className="text-2xl font-bold text-orange-400 mt-1">
              {formatCurrency(filteredPayments.reduce((sum, p) => sum + p.refund_amount, 0))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
