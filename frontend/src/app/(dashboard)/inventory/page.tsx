'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Search, 
  Plus,
  Package,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ArrowUpDown,
  History,
  Loader2,
  Edit,
  Trash2,
  Grid,
  List,
  Warehouse,
  Check,
  X,
  Upload,
  Download
} from 'lucide-react'
import { Button, Input, Badge } from '@/components/ui'
import { apiClient } from '@/lib/api'
import { useCallback } from 'react'
import dynamic from 'next/dynamic'

const BulkInventoryExport = dynamic(() => import('@/components/inventory/BulkInventoryExport').then(mod => ({ default: mod.BulkInventoryExport })), { ssr: false })
const BulkInventoryImport = dynamic(() => import('@/components/inventory/BulkInventoryImport').then(mod => ({ default: mod.BulkInventoryImport })), { ssr: false })
const BulkEditModal = dynamic(() => import('@/components/inventory/BulkEditModal').then(mod => ({ default: mod.BulkEditModal })), { ssr: false })

interface InventoryItem {
  id: string
  product_id: string
  product_name?: string
  sku?: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  reorder_point: number
  location: string | null
  bin_location: string | null
  average_cost: number | string | null
  is_low_stock: boolean
  created_at: string
}

interface InventoryListResponse {
  items: InventoryItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function InventoryCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-gray-700 rounded-lg w-10 h-10" />
        <div className="ml-4 space-y-2 flex-1">
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchInventory() {
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
        
        if (showLowStockOnly) {
          params.append('low_stock', 'true')
        }
        
        const response = await apiClient.get<InventoryListResponse>(`/inventory?${params}`)
        setInventoryItems(response.data.items)
        setTotal(response.data.total)
        setPages(response.data.pages)
      } catch (err) {
        console.error('Failed to fetch inventory:', err)
        setError('Failed to load inventory')
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchInventory, 300)
    return () => clearTimeout(timeoutId)
  }, [page, searchTerm, showLowStockOnly])

  const totalItems = total
  const totalValue = inventoryItems.reduce((sum, i) => sum + (i.quantity_on_hand * toNumber(i.average_cost, 0)), 0)
  const lowStockCount = inventoryItems.filter(i => i.is_low_stock).length
  const outOfStockCount = inventoryItems.filter(i => i.quantity_on_hand === 0).length

  const startEditing = useCallback((item: InventoryItem) => {
    setEditingId(item.id)
    setEditValue(item.quantity_on_hand)
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingId(null)
    setEditValue(0)
  }, [])

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedItems.size === inventoryItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(inventoryItems.map(i => i.id)))
    }
  }, [inventoryItems, selectedItems.size])

  const getSelectedInventoryItems = useCallback(() => {
    return inventoryItems.filter(i => selectedItems.has(i.id)).map(i => ({
      id: i.id,
      product_name: i.product_name || 'Unknown',
      sku: i.sku || '',
      quantity_on_hand: i.quantity_on_hand,
      reorder_point: i.reorder_point,
      location: i.location,
    }))
  }, [inventoryItems, selectedItems])

  const saveStock = useCallback(async (itemId: string) => {
    try {
      setIsSaving(true)
      const item = inventoryItems.find(i => i.id === itemId)
      if (!item) return

      const quantityChange = editValue - item.quantity_on_hand
      if (quantityChange === 0) {
        cancelEditing()
        return
      }

      await apiClient.post(`/inventory/${itemId}/adjust`, {
        quantity_change: quantityChange,
        reason: 'Manual stock adjustment',
      })

      // Update local state
      setInventoryItems(prev => 
        prev.map(i => i.id === itemId 
          ? { ...i, quantity_on_hand: editValue, quantity_available: editValue - i.quantity_reserved }
          : i
        )
      )
      cancelEditing()
    } catch (err) {
      console.error('Failed to update stock:', err)
      setError('Failed to update stock')
    } finally {
      setIsSaving(false)
    }
  }, [editValue, inventoryItems, cancelEditing])

  // Loading state with skeletons
  if (isLoading && inventoryItems.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Inventory</h1>
            <p className="text-gray-400">Track and manage your stock levels</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
              <div className="flex items-center">
                <div className="p-2 bg-gray-700 rounded-lg w-10 h-10" />
                <div className="ml-4 space-y-2">
                  <div className="h-3 bg-gray-700 rounded w-20" />
                  <div className="h-6 bg-gray-700 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  // Error state
  if (error && inventoryItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center"
      >
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-medium text-lg mb-2 text-white">Unable to load inventory</h3>
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
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Inventory</h1>
          <p className="text-gray-400">Track and manage your stock levels ({totalItems} items)</p>
        </div>
        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <Button 
              onClick={() => setShowBulkEdit(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit {selectedItems.size} Items
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => setShowImport(true)}
            className="border-gray-600 hover:bg-gray-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowExport(true)}
            className="border-gray-600 hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/inventory/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Warehouse, label: 'Total Items', value: totalItems, color: 'blue' },
          { icon: DollarSign, label: 'Total Value', value: formatCurrency(totalValue), color: 'green' },
          { icon: AlertTriangle, label: 'Low Stock', value: lowStockCount, color: 'yellow' },
          { icon: TrendingDown, label: 'Out of Stock', value: outOfStockCount, color: 'red' }
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="flex items-center">
              <motion.div 
                className={`p-2 bg-${stat.color}-500/20 rounded-lg border border-${stat.color}-500/30`}
                whileHover={{ scale: 1.1, rotate: 5 }}
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
        ))}
      </div>

      {/* Search and Filters */}
      <motion.div 
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500" />
            <Input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-10 bg-gray-900/50 border-gray-600"
            />
          </div>
          <Button 
            variant={showLowStockOnly ? "default" : "outline"}
            className={showLowStockOnly ? "bg-red-600 hover:bg-red-700" : ""}
            onClick={() => {
              setShowLowStockOnly(!showLowStockOnly)
              setPage(1)
            }}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Low Stock Only
          </Button>
          <div className="bg-gray-900/50 rounded-lg p-1 border border-gray-600">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
              title="Card view"
            >
              <Grid className="h-4 w-4" />
            </button>
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

      {/* Inventory Display */}
      {inventoryItems.length === 0 ? (
        <motion.div 
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Warehouse className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {searchTerm || showLowStockOnly ? 'No inventory items found' : 'No inventory yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || showLowStockOnly
              ? 'Try adjusting your search or filters'
              : 'Start tracking your inventory by adding items'
            }
          </p>
          {!searchTerm && !showLowStockOnly && (
            <Link href="/inventory/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            </Link>
          )}
        </motion.div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventoryItems.map((item, index) => {
            const available = item.quantity_available ?? (item.quantity_on_hand - item.quantity_reserved)
            const value = item.quantity_on_hand * toNumber(item.average_cost, 0)
            const isOutOfStock = item.quantity_on_hand === 0

            return (
              <motion.div 
                key={item.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-100 mb-1">{item.product_name || 'Unknown Product'}</h3>
                    <p className="text-sm text-gray-400">{item.sku || 'No SKU'}</p>
                  </div>
                  <div>
                    {isOutOfStock ? (
                      <Badge variant="danger">Out of Stock</Badge>
                    ) : item.is_low_stock ? (
                      <Badge variant="warning">Low Stock</Badge>
                    ) : (
                      <Badge variant="success">In Stock</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">On Hand:</span>
                    <span className={`font-medium ${
                      isOutOfStock ? 'text-red-400' : 
                      item.is_low_stock ? 'text-yellow-400' : 'text-gray-100'
                    }`}>
                      {item.quantity_on_hand}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Available:</span>
                    <span className="text-gray-100">{available}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Reorder Point:</span>
                    <span className="text-gray-100">{item.reorder_point}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                    <span className="text-sm text-gray-400">Value:</span>
                    <span className="font-bold text-green-400">{formatCurrency(value)}</span>
                  </div>
                </div>

                {item.location && (
                  <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-400">
                    📍 {item.location}{item.bin_location && ` - ${item.bin_location}`}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      ) : (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="w-10 py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === inventoryItems.length && inventoryItems.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Product</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">SKU</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">On Hand</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Available</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Reorder Point</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Location</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Value</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item, index) => {
                  const available = item.quantity_available ?? (item.quantity_on_hand - item.quantity_reserved)
                  const value = item.quantity_on_hand * item.average_cost
                  const isOutOfStock = item.quantity_on_hand === 0

                  return (
                    <motion.tr 
                      key={item.id} 
                      className={`border-b border-gray-800 hover:bg-gray-800/50 ${selectedItems.has(item.id) ? 'bg-blue-900/20' : ''}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.03 }}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{item.product_name || 'Unknown Product'}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{item.sku || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-right bg-gray-900 border border-gray-600 rounded text-white text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveStock(item.id)
                                if (e.key === 'Escape') cancelEditing()
                              }}
                            />
                            <button
                              onClick={() => saveStock(item.id)}
                              disabled={isSaving}
                              className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={isSaving}
                              className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(item)}
                            className={`font-medium hover:underline cursor-pointer ${
                              isOutOfStock ? 'text-red-400' : 
                              item.is_low_stock ? 'text-yellow-400' : 'text-white'
                            }`}
                            title="Click to edit"
                          >
                            {item.quantity_on_hand}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-400">{available}</td>
                      <td className="py-3 px-4 text-right text-gray-400">{item.reorder_point}</td>
                      <td className="py-3 px-4">
                        <div className="text-white">{item.location || 'Not assigned'}</div>
                        {item.bin_location && (
                          <div className="text-xs text-gray-500">{item.bin_location}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-white">
                        {formatCurrency(value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <Badge variant="danger">Out of Stock</Badge>
                        ) : item.is_low_stock ? (
                          <Badge variant="warning">Low Stock</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} items)
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      {inventoryItems.length > 0 && (
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="font-semibold text-gray-100 mb-4">Inventory Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Items', value: totalItems },
              { label: 'Total Value', value: formatCurrency(totalValue) },
              { label: 'Low Stock', value: lowStockCount },
              { label: 'Out of Stock', value: outOfStockCount }
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <motion.p 
                  className="text-2xl font-bold text-gray-100"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, type: "spring", stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Import/Export/Bulk Edit Modals */}
      {showImport && (
        <BulkInventoryImport 
          onClose={() => setShowImport(false)} 
          onSuccess={() => {
            setShowImport(false)
            setPage(1)
          }}
        />
      )}
      {showExport && (
        <BulkInventoryExport onClose={() => setShowExport(false)} />
      )}
      {showBulkEdit && selectedItems.size > 0 && (
        <BulkEditModal
          items={getSelectedInventoryItems()}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => {
            setShowBulkEdit(false)
            setSelectedItems(new Set())
            setPage(1)
          }}
        />
      )}
    </motion.div>
  )
}
