'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calculator,
  FolderTree,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from '@/components/ui'

type Mode = 'create' | 'edit'

interface Category {
  id: string
  name: string
  color: string | null
}

interface ProductIngredient {
  id?: string
  name: string
  unit: string
  quantity: string
  cost: string
  sort_order?: number
}

interface ProductApiResponse {
  id: string
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  cost_price: number | string | null
  selling_price: number | string
  compare_at_price: number | string | null
  labor_minutes?: number
  quantity: number
  low_stock_threshold: number
  is_taxable: boolean
  track_inventory: boolean
  status: string
  category_id: string | null
  has_ingredients?: boolean
  ingredients?: Array<{
    id: string
    name: string
    unit: string
    quantity: number | string
    cost: number | string
    sort_order: number
  }>
}

type ApiErrorShape = {
  response?: {
    data?: {
      detail?:
        | string
        | Array<{
            msg?: string
          }>
    }
  }
}

type ProductUpsertIngredient = {
  name: string
  unit: string
  quantity: number
  cost: number
  sort_order: number
}

type ProductUpsertPayload = {
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  cost_price: number | null
  selling_price: number
  compare_at_price: number | null
  labor_minutes: number
  quantity: number
  low_stock_threshold: number
  is_taxable: boolean
  track_inventory: boolean
  status: string
  category_id: string | null
  ingredients?: ProductUpsertIngredient[]
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getApiErrorMessage(err: unknown, fallback: string) {
  const anyErr = err as ApiErrorShape
  const detail = anyErr.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const msg = first?.msg
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export function ProductForm({ mode, productId }: { mode: Mode; productId?: string }) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<Category[]>([])

  const [bomEnabled, setBomEnabled] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    cost_price: '',
    selling_price: '',
    compare_at_price: '',
    labor_minutes: '0',
    quantity: '0',
    low_stock_threshold: '10',
    is_taxable: true,
    track_inventory: true,
    status: 'active',
    category_id: '',
  })

  const [ingredients, setIngredients] = useState<ProductIngredient[]>([])

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await apiClient.get<{ items: Category[] }>('/categories')
        setCategories(response.data.items)
      } catch {
        // ignore
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !productId) return

    async function fetchProduct() {
      try {
        setIsFetching(true)
        setError(null)

        const response = await apiClient.get<ProductApiResponse>(`/products/${productId}`)
        const product = response.data

        setFormData({
          name: product.name || '',
          description: product.description || '',
          sku: product.sku || '',
          barcode: product.barcode || '',
          cost_price: product.cost_price !== null && product.cost_price !== undefined ? String(product.cost_price) : '',
          selling_price: String(product.selling_price ?? ''),
          compare_at_price:
            product.compare_at_price !== null && product.compare_at_price !== undefined
              ? String(product.compare_at_price)
              : '',
          labor_minutes: String(product.labor_minutes ?? 0),
          quantity: String(product.quantity ?? 0),
          low_stock_threshold: String(product.low_stock_threshold ?? 10),
          is_taxable: product.is_taxable ?? true,
          track_inventory: product.track_inventory ?? true,
          status: product.status || 'active',
          category_id: product.category_id || '',
        })

        const incomingIngredients = (product.ingredients || []).map((ing) => ({
          id: ing.id,
          name: ing.name || '',
          unit: ing.unit || 'unit',
          quantity: String(ing.quantity ?? ''),
          cost: String(ing.cost ?? ''),
          sort_order: ing.sort_order,
        }))

        setIngredients(incomingIngredients)
        setBomEnabled(Boolean(product.has_ingredients) || incomingIngredients.length > 0)
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to load product. Please try again.'))
      } finally {
        setIsFetching(false)
      }
    }

    fetchProduct()
  }, [mode, productId])

  const ingredientLineTotals = useMemo(() => {
    return ingredients.map((ing) => {
      const qty = toNumber(ing.quantity, 0)
      const cost = toNumber(ing.cost, 0)
      return qty * cost
    })
  }, [ingredients])

  const ingredientsTotal = useMemo(() => ingredientLineTotals.reduce((sum, v) => sum + v, 0), [ingredientLineTotals])

  const costPrice = useMemo(() => {
    if (bomEnabled) return ingredientsTotal
    return toNumber(formData.cost_price, 0)
  }, [bomEnabled, ingredientsTotal, formData.cost_price])

  const sellingPrice = useMemo(() => toNumber(formData.selling_price, 0), [formData.selling_price])

  const profit = useMemo(() => sellingPrice - costPrice, [sellingPrice, costPrice])

  const profitMargin = useMemo(() => {
    if (sellingPrice <= 0 || costPrice <= 0) return 0
    return (profit / sellingPrice) * 100
  }, [profit, sellingPrice, costPrice])

  const markup = useMemo(() => {
    if (costPrice <= 0) return 0
    return (profit / costPrice) * 100
  }, [profit, costPrice])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const addIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        name: '',
        unit: 'unit',
        quantity: '1',
        cost: '0',
        sort_order: prev.length,
      },
    ])
  }

  const removeIngredientRow = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index).map((ing, i) => ({ ...ing, sort_order: i })))
  }

  const updateIngredientField = (index: number, field: keyof ProductIngredient, value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => {
        if (i !== index) return ing
        return { ...ing, [field]: value }
      })
    )
  }

  const generateSku = () => {
    if (!formData.name) return
    const prefix = formData.name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3)
    const timestamp = Date.now().toString().slice(-4)
    const newSku = `${prefix}-${timestamp}`
    setFormData((prev) => ({ ...prev, sku: newSku }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const ingredientsPayload = bomEnabled
        ? ingredients
            .map((ing, idx) => ({
              name: safeTrimmedString(ing.name),
              unit: safeTrimmedString(ing.unit) || 'unit',
              quantity: toNumber(ing.quantity, 0),
              cost: toNumber(ing.cost, 0),
              sort_order: typeof ing.sort_order === 'number' ? ing.sort_order : idx,
            }))
            .filter((ing) => ing.name)
        : undefined

      const payload: ProductUpsertPayload = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        barcode: formData.barcode || null,
        cost_price: bomEnabled ? null : formData.cost_price ? parseFloat(formData.cost_price) : null,
        selling_price: parseFloat(formData.selling_price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        labor_minutes: parseInt(formData.labor_minutes) || 0,
        quantity: parseInt(formData.quantity) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        is_taxable: formData.is_taxable,
        track_inventory: formData.track_inventory,
        status: formData.status,
        category_id: formData.category_id || null,
      }

      if (ingredientsPayload !== undefined) payload.ingredients = ingredientsPayload

      if (mode === 'create') {
        await apiClient.post('/products', payload)
        router.push('/products')
      } else {
        await apiClient.put(`/products/${productId}`, payload)
        router.push(`/products/${productId}`)
      }
    } catch (err) {
      setError(getApiErrorMessage(err, mode === 'create' ? 'Failed to create product. Please try again.' : 'Failed to update product. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500 mx-auto" />
          <p className="mt-2 text-gray-400">Loading product...</p>
        </div>
      </div>
    )
  }

  const title = mode === 'create' ? 'Add New Product' : 'Edit Product'
  const description = mode === 'create' ? 'Create a new product in your catalog' : 'Update product details and pricing'
  const backHref = mode === 'create' ? '/products' : `/products/${productId}`

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link href={backHref}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {mode === 'create' ? 'Back to Products' : 'Back to Product'}
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Product Name *</label>
                  <Input name="name" value={formData.name} onChange={handleChange} placeholder="Enter product name" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter product description"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">SKU</label>
                    <div className="flex gap-2">
                      <Input name="sku" value={formData.sku} onChange={handleChange} placeholder="e.g., PRD-001" className="flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateSku}
                        disabled={!formData.name}
                        title="Auto-generate SKU from product name"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Barcode</label>
                    <Input name="barcode" value={formData.barcode} onChange={handleChange} placeholder="e.g., 1234567890" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Costing & Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={bomEnabled}
                    onChange={(e) => setBomEnabled(e.target.checked)}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  Use ingredients (BOM)
                </label>

                {bomEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-400">Ingredients</div>
                      <Button type="button" variant="outline" onClick={addIngredientRow}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Ingredient
                      </Button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-800">
                          <tr className="text-left text-gray-300">
                            <th className="p-3">Name</th>
                            <th className="p-3">Unit</th>
                            <th className="p-3">Qty</th>
                            <th className="p-3">Cost</th>
                            <th className="p-3">Total</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 bg-gray-900/30">
                          {ingredients.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-gray-500">
                                Add ingredients to calculate total cost.
                              </td>
                            </tr>
                          ) : (
                            ingredients.map((ing, idx) => (
                              <tr key={ing.id || idx}>
                                <td className="p-3">
                                  <Input
                                    value={ing.name}
                                    onChange={(e) => updateIngredientField(idx, 'name', e.target.value)}
                                    placeholder="e.g., Flour"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input
                                    value={ing.unit}
                                    onChange={(e) => updateIngredientField(idx, 'unit', e.target.value)}
                                    placeholder="e.g., g"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={ing.quantity}
                                    onChange={(e) => updateIngredientField(idx, 'quantity', e.target.value)}
                                  />
                                </td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={ing.cost}
                                    onChange={(e) => updateIngredientField(idx, 'cost', e.target.value)}
                                  />
                                </td>
                                <td className="p-3 text-gray-200">R {ingredientLineTotals[idx].toFixed(2)}</td>
                                <td className="p-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-gray-700"
                                    onClick={() => removeIngredientRow(idx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Cost Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <Input
                        name="cost_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={bomEnabled ? ingredientsTotal.toFixed(2) : formData.cost_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="pl-8"
                        readOnly={bomEnabled}
                      />
                    </div>
                    {bomEnabled && <p className="text-xs text-gray-500 mt-1">Calculated from ingredients</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Selling Price *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <Input
                        name="selling_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.selling_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="pl-8"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Compare at Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <Input
                        name="compare_at_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.compare_at_price}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Labor Minutes</label>
                    <Input
                      name="labor_minutes"
                      type="number"
                      min="0"
                      value={formData.labor_minutes}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-200">Pricing Calculator</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-2 bg-gray-800/50 rounded">
                      <div className="text-xs text-gray-400 mb-1">Profit</div>
                      <span className={`text-lg font-semibold ${profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        R {profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded">
                      <div className="text-xs text-gray-400 mb-1">Margin</div>
                      <span className={`text-lg font-semibold ${profitMargin > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                        {profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded">
                      <div className="text-xs text-gray-400 mb-1">Markup</div>
                      <span className={`text-lg font-semibold ${markup > 0 ? 'text-purple-400' : 'text-gray-400'}`}>
                        {markup.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    name="is_taxable"
                    checked={formData.is_taxable}
                    onChange={handleChange}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  This product is taxable (VAT)
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    name="track_inventory"
                    checked={formData.track_inventory}
                    onChange={handleChange}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  Track inventory for this product
                </label>

                {formData.track_inventory && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Quantity in Stock</label>
                      <Input name="quantity" type="number" min="0" value={formData.quantity} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Low Stock Alert</label>
                      <Input
                        name="low_stock_threshold"
                        type="number"
                        min="0"
                        value={formData.low_stock_threshold}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4" />
                  Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <Link href="/categories" className="block mt-2 text-xs text-blue-400 hover:text-blue-300">
                  Manage Categories →
                </Link>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" variant="gradient" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : mode === 'create' ? 'Save Product' : 'Update Product'}
              </Button>
              <Link href={backHref}>
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
