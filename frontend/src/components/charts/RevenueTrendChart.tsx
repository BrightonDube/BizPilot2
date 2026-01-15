'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface TrendDataPoint {
  date: string
  value: number
  label: string
}

interface RevenueTrendChartProps {
  data: TrendDataPoint[]
  total: number
  average: number
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-300 font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-purple-400">
            Revenue: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function RevenueTrendChart({ data, total, average }: RevenueTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      revenue: point.value,
    }))
  }, [data])

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-900/50 rounded-lg">
        <div className="text-center text-gray-500">
          <p>No revenue data available</p>
          <p className="text-sm">Start making sales to see trends</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-gray-400">Revenue</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <span>Total: {formatCurrency(total)}</span>
          <span>Avg: {formatCurrency(average)}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenueTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            tickFormatter={(value) => `R${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenueTrend)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RevenueTrendChart
