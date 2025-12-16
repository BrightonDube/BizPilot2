import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Package, Edit, Trash2, Calculator, Tag, Truck, Grid3X3, List, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useBusiness } from '../../hooks/useBusiness'
import { useCurrency } from '../../hooks/useCurrency'
import { supabase } from '../../lib/supabase'
import { formatPercentage } from '../../utils/calculations'
import { ImageDisplay } from '../ui/image-display'
import { ProductCardSkeleton } from '../ui/skeleton'

interface Product {
  id: string
  name: string
  total_cost: number | null
  labor_minutes: number
  selling_price: number | null
  profit_margin: number | null
  created_at: string
  sku: string | null
  min_stock_level: number | null
  reorder_point: number | null
  location: string | null
  image_url: string | null
  barcode: string | null
  ingredient_count: number
  categories?: { name: string } | null
  suppliers?: { name: string } | null
}

export function ProductList() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { business } = useBusiness()
  const { format: formatCurrency } = useCurrency()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeoutError, setTimeoutError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (user && business) {
      fetchProducts()
    }
  }, [user, business])

  const fetchProducts = async () => {
    if (!user || !business) return

    setLoading(true)
    setError('')
    setTimeoutError(false)
    
    // Set 15 second timeout
    const timeoutId = setTimeout(() => {
      setTimeoutError(true)
      setLoading(false)
      setError('Loading is taking longer than expected. Please check your connection.')
    }, 15000)
    
    try {

      // Fetch products with ingredient count, category name, and supplier name
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          total_cost,
          labor_minutes,
          selling_price,
          profit_margin,
          created_at,
          sku,
          min_stock_level,
          reorder_point,
          location,
          image_url,
          barcode,
          ingredients (count),
          categories (name),
          suppliers (name)
        `)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the data to include ingredient count, category name, and supplier name
      const productsWithDetails = data.map(product => ({
        ...product,
        ingredient_count: Array.isArray(product.ingredients) ? product.ingredients.length : 0,
        categories: Array.isArray(product.categories) && product.categories.length > 0 ? product.categories[0] : null,
        suppliers: Array.isArray(product.suppliers) && product.suppliers.length > 0 ? product.suppliers[0] : null,
      }))

      setProducts(productsWithDetails as Product[])
    } catch (err) {
      console.error('Error fetching products:', err)
      setError('Failed to load products')
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const deleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      setProducts(products.filter(p => p.id !== productId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.categories?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Show skeleton loaders while loading
  if (loading && products.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Products</h1>
            <p className="text-gray-400">Manage your product catalog</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </motion.div>
    )
  }
  
  // Show error state
  if (error || timeoutError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card bg-red-900/20 border-red-500/30"
      >
        <div className="text-red-400 text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-2">Unable to load products</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchProducts()}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Products</h1>
          <p className="text-gray-400">Manage your products and pricing</p>
        </div>
        <Link to="/products/new" className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Link>
      </motion.div>

      {/* Search */}
      <motion.div 
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500" />
          <motion.input
            type="text"
            placeholder="Search products by name, SKU, barcode, location, category, or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
            whileFocus={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          />
        </div>
      </motion.div>

      {error && (
        <motion.div 
          className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {error}
        </motion.div>
      )}

      {/* View Toggle */}
      {filteredProducts.length > 0 && (
        <motion.div 
          className="flex justify-end"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="bg-dark-800 rounded-lg p-1 border border-dark-600">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Products Display */}
      {filteredProducts.length === 0 ? (
        <motion.div 
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Package className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {searchTerm ? 'No products found' : 'No products yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Create your first product to get started with cost calculations and pricing insights'
            }
          </p>
          {!searchTerm && (
            <Link to="/products/new" className="btn-primary group inline-flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Product
            </Link>
          )}
        </motion.div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredProducts.map((product, index) => (
            <motion.div 
              key={product.id} 
              className={`card hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 border-dark-600 hover:border-primary-600/30 ${
                viewMode === 'list' ? 'flex flex-row items-center space-x-6' : ''
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: viewMode === 'grid' ? 1.02 : 1.01, y: viewMode === 'grid' ? -4 : 0 }}
            >
              {viewMode === 'grid' ? (
                // Grid View Layout
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-100 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-400">
                        {product.sku && <span className="mr-2">SKU: {product.sku}</span>}
                        {product.ingredient_count} ingredient{product.ingredient_count !== 1 ? 's' : ''}
                        {product.labor_minutes > 0 && ` • ${product.labor_minutes} min labor`}
                      </p>
                      {product.categories?.name && (
                        <p className="text-xs text-gray-500 flex items-center mt-1">
                          <Tag className="h-3 w-3 mr-1" /> {product.categories.name}
                        </p>
                      )}
                      {product.suppliers?.name && (
                        <p className="text-xs text-gray-500 flex items-center mt-1">
                          <Truck className="h-3 w-3 mr-1" /> {product.suppliers.name}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <motion.button
                        onClick={() => navigate(`/products/edit/${product.id}`)}
                        className="p-1 text-gray-500 hover:text-gray-300"
                        title="Edit product"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Edit className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => deleteProduct(product.id, product.name)}
                        className="p-1 text-gray-500 hover:text-red-400"
                        title="Delete product"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <ImageDisplay
                      src={product.image_url}
                      alt={product.name}
                      size="lg"
                      showZoom={true}
                      className="w-full h-32"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Total Cost:</span>
                      <span className="font-medium text-gray-100">
                        {formatCurrency(product.total_cost || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Selling Price:</span>
                      <span className="font-medium text-gray-100">
                        {formatCurrency(product.selling_price || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Profit Margin:</span>
                      <span className={`font-medium ${
                        (product.profit_margin || 0) >= 30 ? 'text-green-400' : 
                        (product.profit_margin || 0) >= 15 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {formatPercentage(product.profit_margin || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-dark-700">
                      <span className="text-sm text-gray-400">Profit:</span>
                      <span className="font-bold text-green-400">
                        {formatCurrency((product.selling_price || 0) - (product.total_cost || 0))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-dark-700">
                    <motion.button 
                      className="w-full flex items-center justify-center text-sm text-primary-400 hover:text-primary-300"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Calculator className="h-4 w-4 mr-1" />
                      View Details
                    </motion.button>
                  </div>
                </>
              ) : (
                // List View Layout
                <>
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <ImageDisplay
                      src={product.image_url}
                      alt={product.name}
                      size="md"
                      showZoom={true}
                      className="w-20 h-20"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-100 text-lg mb-1">{product.name}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-2">
                          {product.sku && <span>SKU: {product.sku}</span>}
                          <span>{product.ingredient_count} ingredient{product.ingredient_count !== 1 ? 's' : ''}</span>
                          {product.labor_minutes > 0 && <span>{product.labor_minutes} min labor</span>}
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          {product.categories?.name && (
                            <span className="flex items-center">
                              <Tag className="h-3 w-3 mr-1" /> {product.categories.name}
                            </span>
                          )}
                          {product.suppliers?.name && (
                            <span className="flex items-center">
                              <Truck className="h-3 w-3 mr-1" /> {product.suppliers.name}
                            </span>
                          )}
                          {product.location && <span>Location: {product.location}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Info */}
                  <div className="flex-shrink-0 text-right">
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-400">Cost: </span>
                        <span className="font-medium text-gray-100">{formatCurrency(product.total_cost || 0)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Price: </span>
                        <span className="font-medium text-gray-100">{formatCurrency(product.selling_price || 0)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Margin: </span>
                        <span className={`font-medium ${
                          (product.profit_margin || 0) >= 30 ? 'text-green-400' : 
                          (product.profit_margin || 0) >= 15 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {formatPercentage(product.profit_margin || 0)}
                        </span>
                      </div>
                      <div className="text-sm pt-1 border-t border-dark-700">
                        <span className="text-gray-400">Profit: </span>
                        <span className="font-bold text-green-400">
                          {formatCurrency((product.selling_price || 0) - (product.total_cost || 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col space-y-2">
                    <motion.button
                      onClick={() => navigate(`/products/edit/${product.id}`)}
                      className="p-2 text-gray-500 hover:text-gray-300 hover:bg-dark-700 rounded"
                      title="Edit product"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Edit className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      onClick={() => deleteProduct(product.id, product.name)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-dark-700 rounded"
                      title="Delete product"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {filteredProducts.length > 0 && (
        <motion.div 
          className="card bg-gradient-to-br from-dark-800 to-dark-900 border-dark-600"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + filteredProducts.length * 0.1 }}
        >
          <h3 className="font-semibold text-gray-100 mb-4">Portfolio Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Products', value: filteredProducts.length },
              { 
                label: 'Avg. Cost', 
                value: formatCurrency(
                  filteredProducts.reduce((sum, p) => sum + (p.total_cost || 0), 0) / filteredProducts.length
                )
              },
              { 
                label: 'Avg. Price', 
                value: formatCurrency(
                  filteredProducts.reduce((sum, p) => sum + (p.selling_price || 0), 0) / filteredProducts.length
                )
              },
              { 
                label: 'Avg. Margin', 
                value: formatPercentage(
                  filteredProducts.reduce((sum, p) => sum + (p.profit_margin || 0), 0) / filteredProducts.length
                )
              }
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <motion.p 
                  className="text-2xl font-bold text-gray-100"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, type: "spring", stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
              <p className="text-sm text-gray-400">Total Products</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}