'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface TrendDataPoint {
  date: string
  value: number
  label: string
}

interface OrdersTrendChartProps {
  data: TrendDataPoint[]
  total: number
  average: number
}

export function OrdersTrendChart({ data, total, average }: OrdersTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      orders: point.value,
    }))
  }, [data])

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
            <p key={index} className="text-sm text-green-400">
              Orders: {Math.round(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-900/50 rounded-lg">
        <div className="text-center text-gray-500">
          <p>No order data available</p>
          <p className="text-sm">Start creating orders to see trends</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-400">Orders</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <span>Total: {total}</span>
          <span>Avg: {average.toFixed(1)}/day</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorOrdersTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
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
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="orders"
            fill="url(#colorOrdersTrend)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default OrdersTrendChart
