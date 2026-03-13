'use client'

/**
 * Quote Reports & Analytics Page
 *
 * Displays conversion rate, value statistics, aging buckets,
 * and lost quotes analysis for proforma invoices.
 */

import { useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

import { apiClient } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
} from '@/components/ui'

/* ── Types ─────────────────────────────────────────────────────────── */

interface ConversionRate {
  total_quotes: number
  approved: number
  converted: number
  rejected: number
  expired: number
  cancelled: number
  conversion_rate: number
  approval_rate: number
}

interface ValueReport {
  period_start: string
  period_end: string
  total_quotes: number
  total_value: number
  avg_value: number
  min_value: number
  max_value: number
}

interface AgingReport {
  bucket_0_7: number
  bucket_8_14: number
  bucket_15_30: number
  bucket_30_plus: number
  total: number
}

interface LostQuote {
  quote_id: string
  quote_number: string
  total: number
  status: string
  reason: string | null
  created_at: string
}

interface LostReport {
  total_lost: number
  total_value: number
  rejected_count: number
  expired_count: number
  items: LostQuote[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)

/* ── Component ─────────────────────────────────────────────────────── */

export default function QuoteReportsPage() {
  const [conversion, setConversion] = useState<ConversionRate | null>(null)
  const [value, setValue] = useState<ValueReport | null>(null)
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [lost, setLost] = useState<LostReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchReports() {
      try {
        const [convRes, valRes, ageRes, lostRes] = await Promise.all([
          apiClient.get<ConversionRate>('/quotes/reports/conversion-rate'),
          apiClient.get<ValueReport>('/quotes/reports/value'),
          apiClient.get<AgingReport>('/quotes/reports/aging'),
          apiClient.get<LostReport>('/quotes/reports/lost'),
        ])
        setConversion(convRes.data)
        setValue(valRes.data)
        setAging(ageRes.data)
        setLost(lostRes.data)
      } catch (err) {
        console.error('Failed to load reports:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchReports()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Quote Reports"
        description="Analytics and insights for proforma invoices"
        actions={
          <Link href="/quotes">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
          </Link>
        }
      />

      {/* Conversion Rate */}
      {conversion && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Conversion Rate</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">{conversion.conversion_rate}%</p>
                <p className="text-sm text-gray-400">Conversion Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">{conversion.approval_rate}%</p>
                <p className="text-sm text-gray-400">Approval Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{conversion.total_quotes}</p>
                <p className="text-sm text-gray-400">Total Quotes</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-400">{conversion.converted}</p>
                <p className="text-sm text-gray-400">Converted</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <p className="text-green-400 font-medium">{conversion.approved}</p>
                <p className="text-gray-500">Approved</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <p className="text-red-400 font-medium">{conversion.rejected}</p>
                <p className="text-gray-500">Rejected</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-yellow-400 font-medium">{conversion.expired}</p>
                <p className="text-gray-500">Expired</p>
              </div>
              <div className="text-center p-3 bg-gray-500/10 rounded-lg">
                <p className="text-gray-400 font-medium">{conversion.cancelled}</p>
                <p className="text-gray-500">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Value Report */}
      {value && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Value Summary (Last 30 Days)</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{value.total_quotes}</p>
                <p className="text-sm text-gray-400">Quotes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{fmt(value.total_value)}</p>
                <p className="text-sm text-gray-400">Total Value</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{fmt(value.avg_value)}</p>
                <p className="text-sm text-gray-400">Average</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{fmt(value.min_value)}</p>
                <p className="text-sm text-gray-400">Minimum</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{fmt(value.max_value)}</p>
                <p className="text-sm text-gray-400">Maximum</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aging Report */}
      {aging && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">Quote Aging</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: '0–7 days', count: aging.bucket_0_7, color: 'text-green-400' },
                { label: '8–14 days', count: aging.bucket_8_14, color: 'text-blue-400' },
                { label: '15–30 days', count: aging.bucket_15_30, color: 'text-yellow-400' },
                { label: '30+ days', count: aging.bucket_30_plus, color: 'text-red-400' },
                { label: 'Total Active', count: aging.total, color: 'text-white' },
              ].map((b) => (
                <div key={b.label} className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <p className={`text-2xl font-bold ${b.color}`}>{b.count}</p>
                  <p className="text-sm text-gray-400">{b.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lost Quotes */}
      {lost && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">
                Lost Quotes (Last 90 Days)
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{lost.total_lost}</p>
                <p className="text-sm text-gray-400">Total Lost</p>
              </div>
              <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-red-400">{fmt(lost.total_value)}</p>
                <p className="text-sm text-gray-400">Lost Value</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <p className="text-xl font-bold text-red-400">{lost.rejected_count}</p>
                <p className="text-sm text-gray-400">Rejected</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-xl font-bold text-yellow-400">{lost.expired_count}</p>
                <p className="text-sm text-gray-400">Expired</p>
              </div>
            </div>

            {lost.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-700">
                      <th className="pb-2">Quote #</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Reason</th>
                      <th className="pb-2 text-right">Value</th>
                      <th className="pb-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lost.items.slice(0, 20).map((q) => (
                      <tr key={q.quote_id} className="border-b border-gray-800">
                        <td className="py-2 text-white">{q.quote_number}</td>
                        <td className="py-2">
                          <span className={q.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}>
                            {q.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400">{q.reason || '—'}</td>
                        <td className="py-2 text-right text-white">{fmt(q.total)}</td>
                        <td className="py-2 text-right text-gray-400">
                          {q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
