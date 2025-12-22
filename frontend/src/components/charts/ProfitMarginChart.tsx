'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { chartTheme } from './ChartRegistry'

type ChartValue = number | string
type ChartName = string | number

interface Product {
  name: string
  profit_margin: number
  selling_price: number
  total_cost: number
}

interface ProfitMarginChartProps {
  products: Product[]
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function ProfitMarginChart({ products }: ProfitMarginChartProps) {
  const chartData = products.map((p) => ({
    name: p.name.length > 15 ? `${p.name.substring(0, 15)}...` : p.name,
    profit_margin: p.profit_margin,
  }))

  const maxMargin = Math.max(0, ...products.map((p) => p.profit_margin))

  const renderTooltip = ({ active, payload, label }: TooltipContentProps<ChartValue, ChartName>) => {
    if (!active || !payload?.length) return null
    const value = toNumber(payload[0]?.value, 0)

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-200 text-sm font-medium mb-1">{String(label ?? '')}</p>
        <p className="text-gray-300 text-sm">Profit Margin: {Number.isFinite(value) ? value.toFixed(1) : '0.0'}%</p>
      </div>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
          <XAxis dataKey="name" stroke={chartTheme.textColor} fontSize={12} />
          <YAxis
            stroke={chartTheme.textColor}
            fontSize={12}
            domain={[0, maxMargin + 10]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={renderTooltip} />
          <Bar
            dataKey="profit_margin"
            name="Profit Margin (%)"
            fill={`${chartTheme.colors.primary}66`}
            stroke={chartTheme.colors.primary}
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ProfitMarginChart
