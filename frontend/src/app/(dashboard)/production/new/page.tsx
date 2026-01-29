'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from '@/components/ui'
import { toNumber, safeToFixed } from '@/lib/utils'

interface Product {
  id: string
  name: string
  selling_price: number
  has_ingredients: boolean
  ingredients: Array<{
    id: string
    name: string
    unit: string
    quantity: number
    cost: number
    source_product_id: string | null
    source_product_name: string | null
  }>
}

interface ProductListResponse {
  items: Product[]
  total: number
}

export default function NewProductionPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    product_id: '',
    quantity_to_produce: '1',
    scheduled_date: '',
    notes: '',
  })

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await apiClient.get<ProductListResponse>('/products?per_page=100&status=active')
        // Filter products that have ingredients (can be manufactured)
        const manufacturableProducts = response.data.items.filter((p) => p.has_ingredients)
        setProducts(manufacturableProducts)
      } catch (err) {
        console.error('Failed to fetch products:', err)
      }
    }
    fetchProducts()
  }, [])

  useEffect(() => {
    if (formData.product_id) {
      const product = products.find((p) => p.id === formData.product_id)
      setSelectedProduct(product || null)
    } else {
      setSelectedProduct(null)
    }
  }, [formData.product_id, products])

  const estimatedCost = selectedProduct
    ? selectedProduct.ingredients.reduce((sum, ing) => sum + ing.cost * ing.quantity, 0) *
      toNumber(formData.quantity_to_produce, 1)
    : 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        product_id: formData.product_id,
        quantity_to_produce: parseInt(formData.quantity_to_produce) || 1,
        scheduled_date: formData.scheduled_date || null,
        notes: formData.notes || null,
      }

      await apiClient.post('/production', payload)
      router.push('/production')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to create production order')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="New Production Order"
        description="Create a new production order to manufacture products"
        actions={
          <Link href="/production">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Production
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Production Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Product to Manufacture *
                  </label>
                  <select
                    name="product_id"
                    value={formData.product_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  {products.length === 0 && (
                    <p className="text-sm text-yellow-400 mt-2">
                      No products with ingredients found. Add ingredients to products first.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Quantity to Produce *
                    </label>
                    <Input
                      name="quantity_to_produce"
                      type="number"
                      min="1"
                      value={formData.quantity_to_produce}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Scheduled Date
                    </label>
                    <Input
                      name="scheduled_date"
                      type="datetime-local"
                      value={formData.scheduled_date}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Optional notes for this production order..."
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            {selectedProduct && selectedProduct.ingredients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Bill of Materials</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-800">
                        <tr className="text-left text-gray-300">
                          <th className="p-3">Ingredient</th>
                          <th className="p-3">Unit</th>
                          <th className="p-3">Qty per Unit</th>
                          <th className="p-3">Total Qty</th>
                          <th className="p-3">Unit Cost</th>
                          <th className="p-3">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-900/30">
                        {selectedProduct.ingredients.map((ing) => {
                          const totalQty = ing.quantity * toNumber(formData.quantity_to_produce, 1)
                          const totalCost = ing.cost * totalQty
                          return (
                            <tr key={ing.id}>
                              <td className="p-3 text-gray-200">
                                {ing.name}
                                {ing.source_product_name && (
                                  <span className="text-xs text-blue-400 ml-2">
                                    (Linked: {ing.source_product_name})
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-gray-400">{ing.unit}</td>
                              <td className="p-3 text-gray-400">{safeToFixed(ing.quantity, 2)}</td>
                              <td className="p-3 text-gray-200">{safeToFixed(totalQty, 2)}</td>
                              <td className="p-3 text-gray-400">R {safeToFixed(ing.cost, 2)}</td>
                              <td className="p-3 text-gray-200">R {safeToFixed(totalCost, 2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-gray-800">
                        <tr>
                          <td colSpan={5} className="p-3 text-right font-medium text-gray-200">
                            Estimated Total Cost:
                          </td>
                          <td className="p-3 font-semibold text-green-400">
                            R {safeToFixed(estimatedCost, 2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Product:</span>
                  <span className="text-white">{selectedProduct?.name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Quantity:</span>
                  <span className="text-white">{formData.quantity_to_produce || '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Ingredients:</span>
                  <span className="text-white">{selectedProduct?.ingredients.length || 0}</span>
                </div>
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-300">Estimated Cost:</span>
                    <span className="font-semibold text-green-400">R {safeToFixed(estimatedCost, 2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" variant="gradient" disabled={isLoading || !formData.product_id}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Creating...' : 'Create Production Order'}
              </Button>
              <Link href="/production">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
