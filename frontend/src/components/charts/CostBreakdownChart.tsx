'use client'

import {
  type TooltipContentProps,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/utils'
import { chartTheme } from './ChartRegistry'

interface CostBreakdownData {
  materialCost: number
  laborCost: number
  totalCost: number
}

interface CostBreakdownChartProps {
  data: CostBreakdownData
}

type ChartValue = number | string
type ChartName = string | number

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const { currency } = useCurrency()

  const chartData = [
    { name: 'Material Costs', value: data.materialCost, color: chartTheme.colors.info },
    { name: 'Labor Costs', value: data.laborCost, color: chartTheme.colors.accent },
  ]

  const renderTooltip = ({ active, payload }: TooltipContentProps<ChartValue, ChartName>) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    const value = toNumber(item?.value, 0)
    const total = data.totalCost || 0
    const percentage = total > 0 && Number.isFinite(value / total) ? ((value / total) * 100).toFixed(1) : '0'

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-200 text-sm font-medium mb-1">{String(item.name ?? '')}</p>
        <p className="text-gray-300 text-sm">
          {formatCurrency(value, currency)} ({percentage}%)
        </p>
      </div>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={`${entry.color}CC`} />
            ))}
          </Pie>
          <Tooltip content={renderTooltip} />
          <Legend
            verticalAlign="bottom"
            formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CostBreakdownChart
