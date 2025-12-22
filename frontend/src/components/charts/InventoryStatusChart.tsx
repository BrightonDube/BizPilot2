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
import { chartTheme } from './ChartRegistry'

type ChartValue = number | string
type ChartName = string | number

interface InventoryItem {
  name: string
  current_quantity: number
  low_stock_alert: number
}

interface InventoryStatusChartProps {
  inventory: InventoryItem[]
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function InventoryStatusChart({ inventory }: InventoryStatusChartProps) {
  const inStock = inventory.filter((item) => item.current_quantity > (item.low_stock_alert || 0)).length
  const lowStock = inventory.filter(
    (item) => item.current_quantity <= (item.low_stock_alert || 0) && item.current_quantity > 0
  ).length
  const outOfStock = inventory.filter((item) => item.current_quantity === 0).length

  const chartData = [
    { name: 'In Stock', value: inStock, color: chartTheme.colors.success },
    { name: 'Low Stock', value: lowStock, color: chartTheme.colors.warning },
    { name: 'Out of Stock', value: outOfStock, color: chartTheme.colors.danger },
  ]

  const renderTooltip = ({ active, payload }: TooltipContentProps<ChartValue, ChartName>) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    const value = toNumber(item?.value, 0)
    const total = inventory.length
    const percentage = total > 0 && Number.isFinite(value / total) ? ((value / total) * 100).toFixed(1) : '0'

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-200 text-sm font-medium mb-1">{String(item.name ?? '')}</p>
        <p className="text-gray-300 text-sm">
          {value} items ({percentage}%)
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
            innerRadius={55}
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

export default InventoryStatusChart
