'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import {
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  Grid3X3,
  List,
  Upload,
  Download,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import { apiClient } from '@/lib/api'

const BulkProductImport = dynamic(() => import('@/components/products/BulkProductImport').then(mod => ({ default: mod.BulkProductImport })), { ssr: false })

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  status: string
  quantity: number
  selling_price: number | string
  cost_price: number | string | null
  image_url: string | null
  category_id: string | null
}

interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  per_page: number
  pages: number
}

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
  out_of_stock: 'danger',
}

function ProductCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="h-32 bg-gray-700 rounded-lg mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  )
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await apiClient.get<ProductListResponse>(`/products?${params}`)
      setProducts(response.data.items)
      setTotal(response.data.total)
      setPages(response.data.pages)
    } catch (err) {
      console.error('Failed to fetch products:', err)
      setError('Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(fetchProducts, 300)
    return () => clearTimeout(timeoutId)
  }, [page, searchTerm])

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(productId)
      await apiClient.delete(`/products/${productId}`)
      setProducts(products.filter((p) => p.id !== productId))
    } catch (err) {
      console.error('Failed to delete product:', err)
      setError('Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading && products.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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

  if (error && products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center"
      >
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-medium text-lg mb-2 text-white">Unable to load products</h3>
        <p className="text-sm mb-4 text-gray-400">{error}</p>
        <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-blue-600 to-purple-600">
          Try Again
        </Button>
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
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Products</h1>
          <p className="text-gray-400">Manage your products and pricing ({total} products)</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowImport(true)}
            className="border-gray-600 hover:bg-gray-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Link href="/products/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500" />
            <Input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-10 bg-gray-900/50 border-gray-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-900/50 rounded-lg p-1 border border-gray-600">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                title="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {error}
        </motion.div>
      )}

      {products.length === 0 ? (
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
          <p className="text-gray-400 mb-6">{searchTerm ? 'Try adjusting your search terms' : 'Create your first product to get started'}</p>
          {!searchTerm && (
            <Link href="/products/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Button>
            </Link>
          )}
        </motion.div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-100 mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-400">{product.sku && <span className="mr-2">SKU: {product.sku}</span>}</p>
                </div>
                <div className="flex space-x-1">
                  <Link href={`/products/${product.id}/edit`}>
                    <motion.button
                      className="p-1 text-gray-500 hover:text-gray-300"
                      title="Edit product"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Edit className="h-4 w-4" />
                    </motion.button>
                  </Link>
                  <motion.button
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                    className="p-1 text-gray-500 hover:text-red-400"
                    title="Delete product"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={deletingId === product.id}
                  >
                    {deletingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </motion.button>
                </div>
              </div>

              <div className="mb-3 h-32 bg-gray-700/50 rounded-lg flex items-center justify-center">
                <Package className="h-12 w-12 text-gray-500" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Status:</span>
                  <Badge variant={statusColors[product.status] || 'default'}>{product.status}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Stock:</span>
                  <span className="font-medium text-gray-100">{product.quantity}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Price:</span>
                  <span className="font-medium text-gray-100">{formatCurrency(toNumber(product.selling_price, 0))}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-700">
                <Link href={`/products/${product.id}`}>
                  <motion.button
                    className="w-full flex items-center justify-center text-sm text-blue-400 hover:text-blue-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-left text-sm font-medium text-gray-400">Product</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">SKU</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Status</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Stock</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Price</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <motion.tr
                  key={product.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <span className="font-medium text-white">{product.name}</span>
                        {product.description && <p className="text-xs text-gray-400 truncate max-w-xs">{product.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400">{product.sku || '-'}</td>
                  <td className="p-4">
                    <Badge variant={statusColors[product.status] || 'default'}>{product.status}</Badge>
                  </td>
                  <td className="p-4 text-gray-400">{product.quantity}</td>
                  <td className="p-4 text-white">{formatCurrency(toNumber(product.selling_price, 0))}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/products/${product.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/products/${product.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        disabled={deletingId === product.id}
                      >
                        {deletingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <motion.div className="flex items-center justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} products)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Next
            </Button>
          </div>
        </motion.div>
      )}

      {/* Import Modal */}
      {showImport && (
        <BulkProductImport 
          onClose={() => setShowImport(false)} 
          onSuccess={() => {
            setShowImport(false)
            setPage(1)
            fetchProducts()
          }}
        />
      )}
    </motion.div>
  )
}
