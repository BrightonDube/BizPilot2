import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Warehouse, TrendingUp, AlertTriangle, Building2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useInventory } from '../../hooks/useInventory'
import { useBusiness } from '../../hooks/useBusiness'
import { supabase } from '../../lib/supabase'
import { formatPercentage } from '../../utils/calculations'
import { DashboardCharts } from './DashboardCharts'
import { StatCardSkeleton, PageSkeleton } from '../ui/skeleton'
import '../charts/ChartRegistry' // Initialize Chart.js

interface DashboardStats {
  totalProducts: number
  inventoryItems: number
  lowStockItems: number
  avgMargin: number
}

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { business, loading: businessLoading } = useBusiness() // New business hook
  const { inventory, loading: inventoryLoading, error: inventoryError } = useInventory() // Use useInventory hook

  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    inventoryItems: 0,
    lowStockItems: 0,
    avgMargin: 40
  })
  const [loadingProducts, setLoadingProducts] = useState(true) // Separate loading for products
  const [productError, setProductError] = useState('') // Separate error for products

  useEffect(() => {
    if (user && business) {
      fetchProductStats()
    }
  }, [user, business])

  useEffect(() => {
    // Update inventory stats when inventory data changes
    if (!inventoryLoading) {
      const inventoryItems = inventory?.length || 0
      const lowStockItems = inventory?.filter(item =>
        item.current_quantity <= (item.low_stock_alert || 0)
      ).length || 0

      setStats(prev => ({
        ...prev,
        inventoryItems,
        lowStockItems
      }))
    }
  }, [inventory, inventoryLoading])


  const fetchProductStats = async () => {
    if (!user || !business) return

    try {
      setLoadingProducts(true)
      setProductError('')

      // Fetch products count and average margin
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('profit_margin')
        .eq('business_id', business.id)

      if (productsError) throw productsError

      // Calculate stats
      const totalProducts = products?.length || 0
      
      // Calculate average margin
      const avgMargin = totalProducts > 0 
        ? products.reduce((sum, product) => sum + (product.profit_margin || 0), 0) / totalProducts
        : 40

      setStats(prev => ({
        ...prev,
        totalProducts,
        avgMargin
      }))
    } catch (err) {
      console.error('Error fetching product stats:', err)
      setProductError('Failed to load product statistics')
    } finally {
      setLoadingProducts(false)
    }
  }

  // Determine loading states more carefully
  const isBusinessDataLoading = businessLoading
  const isProductDataLoading = business && loadingProducts // Only load products if we have a business
  const isInventoryDataLoading = business && inventoryLoading // Only load inventory if we have a business
  
  const overallLoading = isBusinessDataLoading || isProductDataLoading || isInventoryDataLoading
  const overallError = productError || inventoryError

  // Show business setup prompt when business loading is complete but no business exists
  const showBusinessSetup = !businessLoading && !business;

  // Show skeleton loaders instead of spinner for better UX
  // Keep the data visible and just show loading states

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

      {overallError && (
        <motion.div 
          className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {overallError}
        </motion.div>
      )}

      {/* Business Setup Prompt (centered card) */}
      {showBusinessSetup && (
        <div className="flex justify-center items-center min-h-[60vh]">
          <motion.div 
            className="max-w-md w-full"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="text-center mb-8">
              <motion.div
                className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-600 to-accent-600 rounded-full flex items-center justify-center mb-4"
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
                Let's set up your business to get started
              </motion.p>
            </div>
            <motion.div 
              className="bg-dark-900 rounded-xl shadow-xl border border-dark-700 p-8"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.button
                onClick={() => navigate('/business/new')}
                className="w-full bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
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
      )}

      {/* Hide the rest of the dashboard content if business setup is needed */}
      {!showBusinessSetup && (
        <>
          {/* Stats Cards - Show skeletons while loading, data when ready */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {overallLoading ? (
              // Show skeleton loaders
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              // Show actual data
              [
                { icon: Package, label: 'Total Products', value: stats.totalProducts, color: 'blue' },
                { icon: Warehouse, label: 'Inventory Items', value: stats.inventoryItems, color: 'green' },
                { icon: TrendingUp, label: 'Avg. Margin', value: formatPercentage(stats.avgMargin), color: 'primary' },
                { icon: AlertTriangle, label: 'Low Stock', value: stats.lowStockItems, color: 'red' }
              ].map((stat, index) => (
                <motion.div 
                  key={stat.label}
                  className="card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <div className="flex items-center">
                    <motion.div 
                      className={`p-2 bg-gradient-to-br from-${stat.color}-600/20 to-${stat.color}-500/20 rounded-lg border border-${stat.color}-500/30`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <stat.icon className={`h-6 w-6 text-${stat.color}-400`} />
                    </motion.div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                      <motion.p 
                        className="text-2xl font-bold text-gray-100"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4 + index * 0.1, type: "spring", stiffness: 300 }}
                    >
                      {stat.value}
                    </motion.p>
                  </div>
                </div>
              </motion.div>
            ))
            )}
          </div>

          {/* Quick Actions */}
          <motion.div 
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { 
                  icon: Package, 
                  title: 'Add Product', 
                  desc: 'Create a new product with ingredients',
                  action: () => navigate('/products/new')
                },
                { 
                  icon: Warehouse, 
                  title: 'Update Inventory', 
                  desc: 'Track your stock levels',
                  action: () => navigate('/inventory')
                },
                { 
                  icon: TrendingUp, 
                  title: 'Pricing Analysis', 
                  desc: 'Get AI insights on pricing',
                  action: () => navigate('/ai')
                }
              ].map((action, index) => (
                <motion.button
                  key={action.title}
                  onClick={action.action}
                  className="p-4 border border-dark-600 rounded-lg hover:bg-dark-800 transition-colors text-left group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <action.icon className="h-8 w-8 text-primary-400 mb-2 group-hover:text-primary-300 transition-colors" />
                  </motion.div>
                  <h3 className="font-medium text-gray-100">{action.title}</h3>
                  <p className="text-sm text-gray-400">{action.desc}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Remove the old cards code since we replaced it above */}

          {/* Getting Started - Only show when no products exist */}
          {stats.totalProducts === 0 && (
            <motion.div 
              className="card bg-gradient-to-br from-primary-900/20 to-accent-900/20 border-primary-700/30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary-300">Getting Started</h2>
              {user?.email_confirmed_at ? (
                <motion.span 
                  className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded-full border border-green-500/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2, type: "spring", stiffness: 300 }}
                >
                  Email Verified
                </motion.span>
              ) : (
                <motion.span 
                  className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2, type: "spring", stiffness: 300 }}
                >
                  Email Pending
                </motion.span>
              )}
            </div>
            <div className="space-y-3">
              {[
                { step: 1, text: 'Set up your business profile in Settings', completed: false },
                { step: 2, text: 'Add your first product with ingredients', completed: stats.totalProducts > 0, action: () => navigate('/products/new') },
                { step: 3, text: 'Track your inventory items', completed: stats.inventoryItems > 0, action: () => navigate('/inventory') },
                { step: 4, text: 'Ask your AI assistant for insights', completed: false, action: () => navigate('/ai') }
              ].map((item, index) => (
                <motion.div 
                  key={item.step}
                  className="flex items-center"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.3 + index * 0.1 }}
                >
                  <motion.div 
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-sm font-medium mr-3 ${
                      item.completed 
                        ? 'bg-gradient-to-br from-primary-600 to-accent-600 text-white' 
                        : 'bg-dark-600 text-gray-400'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.4 + index * 0.1, type: "spring", stiffness: 300 }}
                  >
                    {item.step}
                  </motion.div>
                  {item.action ? (
                    <motion.button 
                      onClick={item.action}
                      className="text-primary-400 hover:text-primary-300 underline"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {item.text}
                    </motion.button>
                  ) : (
                    <span className="text-gray-300">{item.text}</span>
                  )}
                </motion.div>
              ))}
            </div>
            </motion.div>
          )}

          {/* Performance Insights */}
          {stats.totalProducts > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
            >
              <DashboardCharts />
            </motion.div>
          )}

          {/* Low Stock Alert */}
          {stats.lowStockItems > 0 && (
            <motion.div 
              className="card bg-red-900/20 border-red-500/30"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2, type: "spring", stiffness: 300, damping: 30 }}
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
                  <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                </motion.div>
                <div>
                  <h3 className="font-medium text-red-400">Stock Alert</h3>
                  <p className="text-red-300 text-sm mt-1">
                    You have {stats.lowStockItems} item{stats.lowStockItems !== 1 ? 's' : ''} running low on stock.
                  </p>
                </div>
                <motion.button 
                  onClick={() => navigate('/inventory')}
                  className="ml-auto btn-secondary text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View Inventory
                </motion.button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}