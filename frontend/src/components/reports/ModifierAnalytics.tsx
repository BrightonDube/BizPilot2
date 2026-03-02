/**
 * Modifier Analytics dashboard component.
 *
 * Displays modifier selection frequency, revenue breakdown, and
 * summary statistics.  Uses the /reports/modifiers/* API endpoints.
 *
 * Why separate components for each report section?
 * Each section (frequency, revenue, rankings) has its own data shape
 * and refresh cadence.  Splitting them keeps renders efficient and
 * lets us lazy-load less-used sections later.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, TrendingUp, BarChart3, DollarSign, Users } from 'lucide-react'
import { Badge } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface ModifierSummary {
  total_selections: number
  total_revenue: number
  orders_with_modifiers: number
  total_orders: number
  modifier_adoption_rate: number
}

interface FrequencyItem {
  modifier_name: string
  group_name: string
  selection_count: number
}

interface RevenueItem {
  modifier_name: string
  group_name: string
  total_revenue: number
  selection_count: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function ModifierAnalytics() {
  const [summary, setSummary] = useState<ModifierSummary | null>(null)
  const [frequency, setFrequency] = useState<FrequencyItem[]>([])
  const [revenue, setRevenue] = useState<RevenueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [summaryRes, freqRes, revRes] = await Promise.all([
        apiClient.get('/reports/modifiers/summary'),
        apiClient.get('/reports/modifiers/frequency?limit=10'),
        apiClient.get('/reports/modifiers/revenue?limit=10'),
      ])
      setSummary(summaryRes.data)
      setFrequency(freqRes.data)
      setRevenue(revRes.data)
    } catch {
      setError('Failed to load modifier analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Modifier Analytics</h2>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-gray-400">Total Selections</span>
            </div>
            <p className="text-2xl font-bold text-white">{summary.total_selections.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-400">Modifier Revenue</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_revenue)}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-gray-400">Orders with Modifiers</span>
            </div>
            <p className="text-2xl font-bold text-white">{summary.orders_with_modifiers.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-orange-400" />
              <span className="text-sm text-gray-400">Adoption Rate</span>
            </div>
            <p className="text-2xl font-bold text-white">{summary.modifier_adoption_rate}%</p>
          </div>
        </div>
      )}

      {/* Top modifiers by frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg font-medium text-white mb-4">Most Popular Modifiers</h3>
          {frequency.length === 0 ? (
            <p className="text-gray-500 text-sm">No modifier data yet.</p>
          ) : (
            <div className="space-y-3">
              {frequency.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{item.modifier_name}</p>
                    <p className="text-gray-500 text-xs">{item.group_name}</p>
                  </div>
                  <Badge variant="default">{item.selection_count} times</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top modifiers by revenue */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg font-medium text-white mb-4">Top Revenue Modifiers</h3>
          {revenue.length === 0 ? (
            <p className="text-gray-500 text-sm">No modifier revenue data yet.</p>
          ) : (
            <div className="space-y-3">
              {revenue.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{item.modifier_name}</p>
                    <p className="text-gray-500 text-xs">{item.group_name}</p>
                  </div>
                  <span className="text-green-400 text-sm font-medium">
                    {formatCurrency(item.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
