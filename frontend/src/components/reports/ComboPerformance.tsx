/**
 * Combo deal performance dashboard component.
 *
 * Displays combo deal metrics — savings given, active status,
 * and pricing breakdown.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Package, DollarSign, Tag } from 'lucide-react'
import { Badge } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface ComboPerformanceItem {
  combo_id: string
  name: string
  combo_price: number
  original_price: number
  savings_per_combo: number
  is_active: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function ComboPerformance() {
  const [combos, setCombos] = useState<ComboPerformanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await apiClient.get('/reports/combos/performance?limit=20')
      setCombos(data)
    } catch {
      setError('Failed to load combo performance data')
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
      <h2 className="text-xl font-bold text-white">Combo Deal Performance</h2>

      {combos.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No combo deals configured yet.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-left text-sm font-medium text-gray-400">Combo</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Original</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Combo Price</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Savings</th>
                <th className="p-4 text-center text-sm font-medium text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {combos.map((combo) => (
                <tr
                  key={combo.combo_id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4 text-white font-medium">{combo.name}</td>
                  <td className="p-4 text-right text-gray-400">
                    {formatCurrency(combo.original_price)}
                  </td>
                  <td className="p-4 text-right text-white font-medium">
                    {formatCurrency(combo.combo_price)}
                  </td>
                  <td className="p-4 text-right text-green-400 font-medium">
                    {formatCurrency(combo.savings_per_combo)}
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant={combo.is_active ? 'success' : 'warning'}>
                      {combo.is_active ? 'Active' : 'Inactive'}
                    </Badge>
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
