'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { apiClient } from '@/lib/api'
import { ProfitMarginChart } from '@/components/charts/ProfitMarginChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import { InventoryStatusChart } from '@/components/charts/InventoryStatusChart'
import { CostBreakdownChart } from '@/components/charts/CostBreakdownChart'

interface RevenueData {
  name: string
  revenue: number
  orders: number
}

interface ProductData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface InventoryData {
  name: string
  inStock: number
  lowStock: number
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(value)
}

interface DashboardChartsProps {
  data?: {
    revenue_by_month?: { month: string; revenue: number; orders: number }[]
    products_by_category?: { category: string; count: number }[]
    inventory_status?: { name: string; in_stock: number; low_stock: number }[]
  }
}

interface ProductsListResponse {
  items: Array<{
    name: string
    selling_price: number
    total_cost: number | null
    profit_margin: number
    created_at: string
  }>
}

interface InventoryListResponse {
  items: Array<{
    product_name: string | null
    quantity_on_hand: number
    reorder_point: number
  }>
}

export function DashboardCharts({ data: propData }: DashboardChartsProps) {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [productData, setProductData] = useState<ProductData[]>([])
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([])
  const [isLoading, setIsLoading] = useState(!propData)
  const [hasData, setHasData] = useState(false)

  const [productsForCharts, setProductsForCharts] = useState<Array<{
    name: string
    selling_price: number
    total_cost: number
    profit_margin: number
    created_at: string
  }>>([])

  const [inventoryForCharts, setInventoryForCharts] = useState<Array<{
    name: string
    current_quantity: number
    low_stock_alert: number
  }>>([])

  const costBreakdown = {
    materialCost: productsForCharts.reduce((sum, p) => sum + (Number.isFinite(p.total_cost) ? p.total_cost : 0), 0),
    laborCost: 0,
    totalCost: productsForCharts.reduce((sum, p) => sum + (Number.isFinite(p.total_cost) ? p.total_cost : 0), 0),
  }

  useEffect(() => {
    // If data is passed as prop, use it directly (avoid duplicate API call)
    if (propData) {
      transformData(propData)
      fetchAdditionalChartData()
      return
    }
    // Only fetch if no data provided
    fetchChartData()
  }, [propData])

  const transformData = (data: NonNullable<DashboardChartsProps['data']>) => {
    // Transform revenue data
    if (data.revenue_by_month && data.revenue_by_month.length > 0) {
      setRevenueData(data.revenue_by_month.map((item) => ({
        name: item.month,
        revenue: item.revenue,
        orders: item.orders
      })))
      setHasData(true)
    }

    // Transform product category data
    if (data.products_by_category && data.products_by_category.length > 0) {
      setProductData(data.products_by_category.map((item, index) => ({
        name: item.category,
        value: item.count,
        color: COLORS[index % COLORS.length]
      })))
    }

    // Transform inventory status data
    if (data.inventory_status && data.inventory_status.length > 0) {
      setInventoryData(data.inventory_status.map((item) => ({
        name: item.name,
        inStock: item.in_stock,
        lowStock: item.low_stock
      })))
    }
    setIsLoading(false)
  }

  const fetchChartData = async () => {
    try {
      setIsLoading(true)
      const [dashboardResponse] = await Promise.all([
        apiClient.get('/dashboard'),
        fetchAdditionalChartData(),
      ])
      transformData(dashboardResponse.data)
    } catch (error) {
      console.error('Failed to fetch chart data:', error)
      setHasData(false)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAdditionalChartData = async () => {
    try {
      const [productsResponse, inventoryResponse] = await Promise.all([
        apiClient.get<ProductsListResponse>('/products', {
          params: {
            page: 1,
            per_page: 100,
            sort_by: 'created_at',
            sort_order: 'asc',
          },
        }),
        apiClient.get<InventoryListResponse>('/inventory', {
          params: {
            page: 1,
            per_page: 100,
            sort_by: 'created_at',
            sort_order: 'desc',
          },
        }),
      ])

      const products = (productsResponse.data?.items ?? [])
        .filter((p) => p && typeof p.name === 'string')
        .map((p) => ({
          name: p.name,
          selling_price: Number(p.selling_price ?? 0),
          total_cost: Number(p.total_cost ?? 0),
          profit_margin: Number(p.profit_margin ?? 0),
          created_at: p.created_at,
        }))
        .filter((p) => Number.isFinite(p.selling_price) && Number.isFinite(p.total_cost) && !!p.created_at)

      const inventory = (inventoryResponse.data?.items ?? [])
        .filter((i) => i)
        .map((i) => ({
          name: i.product_name ?? 'Unknown',
          current_quantity: Number(i.quantity_on_hand ?? 0),
          low_stock_alert: Number(i.reorder_point ?? 0),
        }))
        .filter((i) => Number.isFinite(i.current_quantity) && Number.isFinite(i.low_stock_alert))

      setProductsForCharts(products)
      setInventoryForCharts(inventory)
    } catch (error) {
      console.error('Failed to fetch additional chart data:', error)
      setProductsForCharts([])
      setInventoryForCharts([])
    }
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-gray-300 font-medium mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'revenue' ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`bg-gray-800/50 border border-gray-700 rounded-xl p-6 ${i === 0 ? 'lg:col-span-2' : ''}`}>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
              <div className="h-64 bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Show empty state if no data
  if (!hasData && revenueData.length === 0 && productData.length === 0 && inventoryData.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-300 mb-1">No Chart Data Yet</h3>
            <p className="text-sm">Start adding orders and products to see your business analytics here.</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Chart - Full Width */}
      <motion.div
        className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Revenue Overview</h3>
            <p className="text-sm text-gray-400">Monthly revenue and order trends</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-gray-400">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-gray-400">Orders</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `R${value / 1000}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#8b5cf6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              dataKey="orders"
              stroke="#06b6d4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorOrders)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Product Categories Pie Chart */}
      <motion.div
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-100">Product Categories</h3>
          <p className="text-sm text-gray-400">Distribution by category</p>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={productData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
            >
              {productData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Inventory Status Bar Chart */}
      <motion.div
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-100">Inventory Status</h3>
          <p className="text-sm text-gray-400">Stock levels this week</p>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={inventoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="inStock" fill="#10b981" radius={[4, 4, 0, 0]} name="In Stock" />
            <Bar dataKey="lowStock" fill="#ef4444" radius={[4, 4, 0, 0]} name="Low Stock" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Profit Margin Chart */}
      {productsForCharts.length > 0 && (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-100">Profit Margins</h3>
            <p className="text-sm text-gray-400">Margin distribution across products</p>
          </div>
          <ProfitMarginChart
            products={productsForCharts.map((p) => ({
              name: p.name,
              profit_margin: p.profit_margin,
              selling_price: p.selling_price,
              total_cost: p.total_cost,
            }))}
          />
        </motion.div>
      )}

      {/* Profit Trend Chart */}
      {productsForCharts.length > 1 && (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-100">Profit Trend</h3>
            <p className="text-sm text-gray-400">Cumulative profit potential by product creation</p>
          </div>
          <ProfitTrendChart
            products={productsForCharts.map((p) => ({
              name: p.name,
              selling_price: p.selling_price,
              total_cost: p.total_cost,
              created_at: p.created_at,
            }))}
          />
        </motion.div>
      )}

      {/* Inventory Health (Pie) */}
      {inventoryForCharts.length > 0 && (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-100">Inventory Health</h3>
            <p className="text-sm text-gray-400">In stock vs low/out of stock</p>
          </div>
          <InventoryStatusChart inventory={inventoryForCharts} />
        </motion.div>
      )}

      {/* Cost Breakdown */}
      {productsForCharts.length > 0 && costBreakdown.totalCost > 0 && (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-100">Cost Breakdown</h3>
            <p className="text-sm text-gray-400">Material vs labor cost composition</p>
          </div>
          <CostBreakdownChart data={costBreakdown} />
        </motion.div>
      )}
    </div>
  )
}

export default DashboardCharts
