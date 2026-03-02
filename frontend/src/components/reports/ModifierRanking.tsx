/**
 * Modifier ranking component for the reports dashboard.
 *
 * Shows a ranked list of modifiers by popularity, revenue, or
 * average price.  Supports switching between ranking modes.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Trophy, ArrowUpDown } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface RankingItem {
  modifier_name: string
  group_name: string
  selection_count: number
  total_revenue: number
  avg_price: number
  rank: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

type RankMode = 'popular' | 'unpopular' | 'revenue'

export function ModifierRanking() {
  const [rankings, setRankings] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<RankMode>('popular')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await apiClient.get(`/reports/modifiers/rankings?order_by=${mode}&limit=10`)
      setRankings(data)
    } catch {
      setError('Failed to load modifier rankings')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Modifier Rankings</h2>
        <div className="flex gap-2">
          {(['popular', 'unpopular', 'revenue'] as RankMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode(m)}
            >
              {m === 'popular' ? 'Most Popular' : m === 'unpopular' ? 'Least Popular' : 'Top Revenue'}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && rankings.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No modifier ranking data available yet.</p>
        </div>
      )}

      {!loading && rankings.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-left text-sm font-medium text-gray-400 w-12">#</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Modifier</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Selections</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Revenue</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((item) => (
                <tr
                  key={`${item.modifier_name}-${item.group_name}`}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4">
                    <span className="flex items-center justify-center w-7 h-7 bg-gray-700 rounded-lg text-sm font-mono text-gray-400">
                      {item.rank}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-white text-sm font-medium">{item.modifier_name}</p>
                    <p className="text-gray-500 text-xs">{item.group_name}</p>
                  </td>
                  <td className="p-4 text-right text-gray-300">
                    {item.selection_count.toLocaleString()}
                  </td>
                  <td className="p-4 text-right text-green-400 font-medium">
                    {formatCurrency(item.total_revenue)}
                  </td>
                  <td className="p-4 text-right text-gray-300">
                    {formatCurrency(item.avg_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
