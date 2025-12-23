'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Package,
  Warehouse,
  TrendingUp,
  AlertTriangle,
  Building2,
  ArrowRight,
  DollarSign,
  ShoppingCart,
  Users,
  FileText,
  Loader2
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiClient } from '@/lib/api'
import dynamic from 'next/dynamic'

const statColorClasses: Record<
  string,
  {
    container: string
    icon: string
  }
> = {
  blue: {
    container: 'bg-blue-500/20 border-blue-500/30',
    icon: 'text-blue-400',
  },
  green: {
    container: 'bg-green-500/20 border-green-500/30',
    icon: 'text-green-400',
  },
  purple: {
    container: 'bg-purple-500/20 border-purple-500/30',
    icon: 'text-purple-400',
  },
  red: {
    container: 'bg-red-500/20 border-red-500/30',
    icon: 'text-red-400',
  },
}

const DashboardCharts = dynamic(
  () => import('@/components/charts/DashboardCharts').then((mod) => mod.DashboardCharts),
  { 
    ssr: false,
    loading: () => (
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
)

interface DashboardStats {
  total_revenue: number
  total_orders: number
  total_customers: number
  total_products: number
  orders_today: number
  revenue_today: number
  orders_this_month: number
  revenue_this_month: number
  pending_invoices: number
  pending_invoice_amount: number
  low_stock_products: number
  currency: string
}

interface RecentOrder {
  id: string
  order_number: string
  customer_name: string
  total: number
  status: string
  created_at: string
}

interface TopProduct {
  id: string
  name: string
  sku: string | null
  quantity_sold: number
  revenue: number
}

interface DashboardData {
  stats: DashboardStats
  recent_orders: RecentOrder[]
  top_products: TopProduct[]
  revenue_by_month?: { month: string; revenue: number; orders: number }[]
  products_by_category?: { category: string; count: number }[]
  inventory_status?: { name: string; in_stock: number; low_stock: number }[]
}

function formatCurrency(amount: number, currency: string = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPercentage(value: number): string {
  const n = Number.isFinite(value) ? value : 0
  return `${n.toFixed(1)}%`
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'completed':
    case 'paid':
      return 'text-green-400'
    case 'processing':
    case 'shipped':
    case 'confirmed':
      return 'text-yellow-400'
    case 'pending':
    case 'draft':
      return 'text-gray-400'
    case 'cancelled':
    case 'refunded':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}

function StatCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="flex items-center">
        <div className="p-2 bg-gray-700 rounded-lg w-10 h-10" />
        <div className="ml-4 space-y-2">
          <div className="h-3 bg-gray-700 rounded w-20" />
          <div className="h-6 bg-gray-700 rounded w-16" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsBusinessSetup, setNeedsBusinessSetup] = useState(false)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await apiClient.get('/dashboard')
        setDashboardData(response.data)
        setNeedsBusinessSetup(false)
      } catch (err: unknown) {
        console.error('Failed to fetch dashboard data:', err)
        const axiosError = err as { response?: { status?: number; data?: { detail?: string } } }
        if (axiosError.response?.status === 404 || axiosError.response?.data?.detail?.includes('business')) {
          setNeedsBusinessSetup(true)
        } else {
          setError(axiosError.response?.data?.detail || 'Failed to load dashboard data')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  // Business Setup Prompt
  if (needsBusinessSetup) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <motion.div 
          className="max-w-md w-full"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="text-center mb-8">
            <motion.div
              className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
            >
              <Building2 className="h-8 w-8 text-white" />
            </motion.div>
            <motion.h1 
              className="text-2xl font-bold text-gray-100 mb-2"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Welcome to BizPilot!
            </motion.h1>
            <motion.p 
              className="text-gray-400"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Let&apos;s set up your business to get started
            </motion.p>
          </div>
          <motion.div 
            className="bg-gray-800/50 rounded-xl shadow-xl border border-gray-700 p-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              onClick={() => router.push('/business/setup')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>Set Up Your Business</span>
              <ArrowRight className="h-5 w-5" />
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Loading state with skeletons
  if (isLoading) {
    return (
      <motion.div 
        className="space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-gray-400">Welcome to your business command center</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </motion.div>
    )
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center min-h-[60vh]"
      >
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-2 text-white">Unable to load dashboard</h3>
          <p className="text-sm mb-4 text-gray-400">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            Try Again
          </Button>
        </div>
      </motion.div>
    )
  }

  const stats = dashboardData?.stats
  const recentOrders = dashboardData?.recent_orders || []
  const topProducts = dashboardData?.top_products || []

  const statCards = [
    { 
      icon: DollarSign, 
      label: 'Total Revenue', 
      value: formatCurrency(stats?.total_revenue || 0), 
      color: 'blue',
      subtext: `+${formatCurrency(stats?.revenue_this_month || 0)} this month`
    },
    { 
      icon: ShoppingCart, 
      label: 'Total Orders', 
      value: stats?.total_orders || 0, 
      color: 'green',
      subtext: `${stats?.orders_today || 0} today`
    },
    { 
      icon: Users, 
      label: 'Customers', 
      value: stats?.total_customers || 0, 
      color: 'purple',
      subtext: 'Active customers'
    },
    { 
      icon: AlertTriangle, 
      label: 'Low Stock', 
      value: stats?.low_stock_products || 0, 
      color: 'red',
      subtext: 'Items need attention'
    }
  ]

  return (
    <motion.div 
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400">Welcome to your business command center</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
        {statCards.map((stat, index) => (
          <motion.div 
            key={stat.label}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <motion.div 
                className={`p-2 rounded-lg border ${statColorClasses[stat.color]?.container ?? 'bg-gray-500/20 border-gray-500/30'}`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <stat.icon className={`h-6 w-6 ${statColorClasses[stat.color]?.icon ?? 'text-gray-400'}`} />
              </motion.div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis leading-snug">{stat.label}</p>
                <motion.p 
                  className="text-xl sm:text-2xl font-bold text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis leading-snug"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1, type: "spring", stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-xs text-gray-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis leading-snug">{stat.subtext}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div 
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Package, title: 'Add Product', desc: 'Create a new product', href: '/products/new' },
            { icon: Warehouse, title: 'Update Inventory', desc: 'Track your stock levels', href: '/inventory' },
            { icon: FileText, title: 'New Invoice', desc: 'Create customer invoice', href: '/invoices/new' },
            { icon: TrendingUp, title: 'AI Insights', desc: 'Get business analytics', href: '/ai' }
          ].map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link 
                href={action.href}
                className="block p-4 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition-colors text-left group"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <action.icon className="h-8 w-8 text-blue-400 mb-2 group-hover:text-blue-300 transition-colors" />
                </motion.div>
                <h3 className="font-medium text-gray-100">{action.title}</h3>
                <p className="text-sm text-gray-400">{action.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Recent Orders</CardTitle>
              <Link href="/orders" className="text-sm text-blue-400 hover:text-blue-300 flex items-center">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No orders yet</p>
              ) : (
                <div className="space-y-4">
                  {recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{order.order_number}</p>
                        <p className="text-xs text-gray-400">{order.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{formatCurrency(order.total)}</p>
                        <p className={`text-xs ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Top Products</CardTitle>
              <Link href="/products" className="text-sm text-blue-400 hover:text-blue-300 flex items-center">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No products yet</p>
              ) : (
                <div className="space-y-4">
                  {topProducts.slice(0, 5).map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-400 w-6">#{index + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{product.name}</p>
                          <p className="text-xs text-gray-400">{product.quantity_sold} sold</p>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-white">{formatCurrency(product.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <DashboardCharts data={dashboardData ? {
          revenue_by_month: dashboardData.revenue_by_month,
          products_by_category: dashboardData.products_by_category,
          inventory_status: dashboardData.inventory_status
        } : undefined} />
      </motion.div>

      {/* Low Stock Alert */}
      {stats && stats.low_stock_products > 0 && (
        <motion.div 
          className="bg-red-900/20 border border-red-500/30 rounded-xl p-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, type: "spring", stiffness: 300, damping: 30 }}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
            </motion.div>
            <div className="flex-1">
              <h3 className="font-medium text-red-400">Stock Alert</h3>
              <p className="text-red-300 text-sm mt-1">
                You have {stats.low_stock_products} item{stats.low_stock_products !== 1 ? 's' : ''} running low on stock.
              </p>
            </div>
            <Link href="/inventory">
              <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                View Inventory
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Pending Invoices Alert */}
      {stats && stats.pending_invoices > 0 && (
        <motion.div 
          className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-yellow-400 mr-3" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-400">Pending Invoices</h3>
              <p className="text-yellow-300 text-sm mt-1">
                {stats.pending_invoices} invoice{stats.pending_invoices !== 1 ? 's' : ''} pending - {formatCurrency(stats.pending_invoice_amount)} outstanding
              </p>
            </div>
            <Link href="/invoices?status=pending">
              <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                View Invoices
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
