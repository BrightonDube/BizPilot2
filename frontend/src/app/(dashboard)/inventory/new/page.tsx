'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Package, 
  Save, 
  Loader2,
  MapPin,
  Hash,
  AlertTriangle
} from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Product {
  id: string
  name: string
  sku: string
  price: number
  cost_price: number
}

interface ProductListResponse {
  items: Product[]
  total: number
}

export default function NewInventoryPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    product_id: '',
    quantity_on_hand: 0,
    quantity_reserved: 0,
    quantity_incoming: 0,
    reorder_point: 10,
    reorder_quantity: 50,
    location: '',
    bin_location: '',
    average_cost: 0,
    last_cost: 0,
  })

  // Load products for selection
  useEffect(() => {
    async function fetchProducts() {
      try {
        setIsLoading(true)
        const response = await apiClient.get<ProductListResponse>('/products?per_page=100')
        setProducts(response.data.items)
      } catch (err) {
        console.error('Failed to fetch products:', err)
        setError('Failed to load products')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedProduct = products.find(p => p.id === formData.product_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.product_id) {
      setError('Please select a product')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      await apiClient.post('/inventory', {
        ...formData,
        average_cost: formData.average_cost.toString(),
        last_cost: formData.last_cost.toString(),
      })

      router.push('/inventory')
    } catch (err: unknown) {
      console.error('Failed to create inventory item:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create inventory item'
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin" />
          <p className="mt-2 text-gray-400">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="space-y-6 max-w-4xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center space-x-4">
          <Link href="/inventory">
            <motion.button
              className="p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-800"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Add Inventory Item</h1>
            <p className="text-gray-400">Track stock for a product</p>
          </div>
        </div>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div 
          className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertTriangle className="h-5 w-5" />
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Selection */}
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            Select Product
          </h2>
          
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-900/50 border-gray-600"
            />

            <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-lg">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  No products found. <Link href="/products/new" className="text-blue-400 hover:underline">Create one first</Link>
                </div>
              ) : (
                filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => {
                      handleInputChange('product_id', product.id)
                      handleInputChange('average_cost', product.cost_price || 0)
                      handleInputChange('last_cost', product.cost_price || 0)
                    }}
                    className={`p-3 cursor-pointer border-b border-gray-700 last:border-b-0 transition-colors ${
                      formData.product_id === product.id 
                        ? 'bg-blue-600/20 border-l-2 border-l-blue-500' 
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-white">{product.name}</p>
                        <p className="text-sm text-gray-400">SKU: {product.sku || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Cost: R{product.cost_price?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedProduct && (
              <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400">Selected: <span className="font-medium text-white">{selectedProduct.name}</span></p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stock Quantities */}
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Hash className="h-5 w-5 text-green-400" />
            Stock Quantities
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantity On Hand *
              </label>
              <Input
                type="number"
                min="0"
                value={formData.quantity_on_hand}
                onChange={(e) => handleInputChange('quantity_on_hand', parseInt(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Current stock available</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantity Reserved
              </label>
              <Input
                type="number"
                min="0"
                value={formData.quantity_reserved}
                onChange={(e) => handleInputChange('quantity_reserved', parseInt(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Stock reserved for orders</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantity Incoming
              </label>
              <Input
                type="number"
                min="0"
                value={formData.quantity_incoming}
                onChange={(e) => handleInputChange('quantity_incoming', parseInt(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Expected from suppliers</p>
            </div>
          </div>
        </motion.div>

        {/* Reorder Settings */}
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            Reorder Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reorder Point
              </label>
              <Input
                type="number"
                min="0"
                value={formData.reorder_point}
                onChange={(e) => handleInputChange('reorder_point', parseInt(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reorder Quantity
              </label>
              <Input
                type="number"
                min="0"
                value={formData.reorder_quantity}
                onChange={(e) => handleInputChange('reorder_quantity', parseInt(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Suggested quantity to reorder</p>
            </div>
          </div>
        </motion.div>

        {/* Location */}
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-400" />
            Storage Location
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Location
              </label>
              <Input
                type="text"
                placeholder="e.g., Warehouse A"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="bg-gray-900/50 border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bin Location
              </label>
              <Input
                type="text"
                placeholder="e.g., Shelf B3"
                value={formData.bin_location}
                onChange={(e) => handleInputChange('bin_location', e.target.value)}
                className="bg-gray-900/50 border-gray-600"
              />
            </div>
          </div>
        </motion.div>

        {/* Cost Information */}
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Cost Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Average Cost (ZAR)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.average_cost}
                onChange={(e) => handleInputChange('average_cost', parseFloat(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Last Cost (ZAR)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.last_cost}
                onChange={(e) => handleInputChange('last_cost', parseFloat(e.target.value) || 0)}
                className="bg-gray-900/50 border-gray-600"
              />
            </div>
          </div>
        </motion.div>

        {/* Submit Buttons */}
        <motion.div 
          className="flex justify-end gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Link href="/inventory">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button 
            type="submit" 
            disabled={isSaving || !formData.product_id}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Inventory Item
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  )
}
