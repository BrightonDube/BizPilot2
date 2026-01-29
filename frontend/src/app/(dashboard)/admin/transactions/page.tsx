'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  CreditCard, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Search
} from 'lucide-react'
import Link from 'next/link'
import { adminApi } from '@/lib/admin-api'

interface Transaction {
  id: string
  user_id: string
  user_email: string
  tier_name: string
  amount_cents: number
  currency: string
  status: 'success' | 'pending' | 'failed' | 'refunded'
  payment_provider: string
  payment_reference: string | null
  paid_at: string | null
  created_at: string
}

interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  per_page: number
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    success: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
    refunded: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: XCircle },
  }
  const config = colors[status] || colors.pending
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const data: TransactionListResponse = await adminApi.listTransactions({
        page,
        per_page: 20,
        status: statusFilter || undefined,
      })
      setTransactions(data.transactions || [])
      setTotal(data.total || 0)
      setTotalPages(Math.ceil((data.total || 0) / 20))
    } catch (error) {
      console.error('Failed to load transactions:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const formatAmount = (cents: number, currency: string) => {
    const amount = cents / 100
    if (currency === 'ZAR') {
      return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-green-500" />
              Transactions
            </h1>
            <p className="text-gray-400 mt-1">View payment history and subscription transactions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Transactions</p>
          <p className="text-2xl font-bold text-white">{total}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Amount</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Provider</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {formatDate(tx.paid_at || tx.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{tx.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {tx.tier_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      {formatAmount(tx.amount_cents, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {tx.payment_provider || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {tx.payment_reference ? tx.payment_reference.substring(0, 12) + '...' : '-'}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-sm text-gray-400">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
