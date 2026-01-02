'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { chartTheme } from './ChartRegistry'

type ChartValue = number | string
type ChartName = string | number

interface Product {
  name: string
  selling_price: number
  total_cost: number
  created_at: string
}

interface ProfitTrendChartProps {
  products: Product[]
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function ProfitTrendChart({ products }: ProfitTrendChartProps) {
  const { currency } = useCurrency()

  const sortedProducts = [...products].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const trendData = sortedProducts.reduce(
    (acc, product) => {
      const dailyProfit = product.selling_price - product.total_cost
      const cumulativeProfit = acc.cumulativeProfit + dailyProfit

      return {
        cumulativeProfit,
        data: [
          ...acc.data,
          {
            date: new Date(product.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            profit: cumulativeProfit,
            dailyProfit,
          },
        ],
      }
    },
    {
      cumulativeProfit: 0,
      data: [] as Array<{ date: string; profit: number; dailyProfit: number }>,
    }
  ).data

  const renderTooltip = ({ active, payload, label }: TooltipContentProps<ChartValue, ChartName>) => {
    if (!active || !payload?.length) return null
    const profit = toNumber(payload[0]?.value, 0)
    const dailyProfit = toNumber((payload[0]?.payload as { dailyProfit?: unknown } | undefined)?.dailyProfit, 0)

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-200 text-sm font-medium mb-1">{String(label ?? '')}</p>
        <p className="text-gray-300 text-sm">Cumulative: {formatCurrency(profit, currency)}</p>
        <p className="text-gray-400 text-xs mt-1">Daily Addition: {formatCurrency(dailyProfit, currency)}</p>
      </div>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartTheme.colors.success} stopOpacity={0.25} />
              <stop offset="95%" stopColor={chartTheme.colors.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
          <XAxis dataKey="date" stroke={chartTheme.textColor} fontSize={12} />
          <YAxis
            stroke={chartTheme.textColor}
            fontSize={12}
            tickFormatter={(v) => formatCurrency(v, currency)}
          />
          <Tooltip content={renderTooltip} />
          <Area
            type="monotone"
            dataKey="profit"
            name="Cumulative Profit Potential"
            stroke={chartTheme.colors.success}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#profitFill)"
            dot={{ r: 4, strokeWidth: 2, stroke: '#ffffff', fill: chartTheme.colors.success }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ProfitTrendChart
