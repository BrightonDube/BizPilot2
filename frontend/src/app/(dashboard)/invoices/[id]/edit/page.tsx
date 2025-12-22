'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { Button, Card, CardContent } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Customer {
  id: string
  first_name: string
  last_name: string
  company_name?: string
  email?: string
}

interface Product {
  id: string
  name: string
  selling_price: number
  sku?: string
}

interface InvoiceItem {
  id?: string
  tempId: string
  product_id?: string
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  tax_rate: number
}

interface InvoiceFormData {
  customer_id: string
  issue_date: string
  due_date: string
  notes: string
  terms: string
  items: InvoiceItem[]
}

interface InvoiceApiResponse {
  id: string
  invoice_number: string
  customer_id: string | null
  issue_date: string
  due_date: string
  notes?: string
  terms?: string
  status: string
  items: Array<{
    id: string
    product_id?: string | null
    description: string
    quantity: number
    unit_price: number
    discount_percent?: number
    discount_percentage?: number
    tax_rate?: number
    tax_percentage?: number
  }>
}

function safeDateOnly(dateString: string | undefined | null): string {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
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

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [formData, setFormData] = useState<InvoiceFormData>({
    customer_id: '',
    issue_date: '',
    due_date: '',
    notes: '',
    terms: '',
    items: [
      {
        tempId: '1',
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_rate: 15,
      },
    ],
  })

  const totals = useMemo(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    const discount = formData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price
      return sum + (itemSubtotal * (item.discount_percent || 0)) / 100
    }, 0)
    const taxable = subtotal - discount
    const tax = formData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price
      const itemDiscount = (itemSubtotal * (item.discount_percent || 0)) / 100
      const itemTaxable = itemSubtotal - itemDiscount
      return sum + (itemTaxable * (item.tax_rate || 0)) / 100
    }, 0)
    const total = taxable + tax

    return { subtotal, discount, tax, total }
  }, [formData.items])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')

        const [invoiceRes, customersRes, productsRes] = await Promise.all([
          apiClient.get<InvoiceApiResponse>(`/invoices/${invoiceId}`),
          apiClient.get('/customers?per_page=100'),
          apiClient.get('/products?per_page=100'),
        ])

        const invoice = invoiceRes.data

        const items: InvoiceItem[] = (invoice.items || []).map((item, idx) => ({
          id: item.id,
          tempId: item.id || `${idx + 1}`,
          product_id: item.product_id || undefined,
          description: item.description || '',
          quantity: toNumber(item.quantity ?? 1, 1),
          unit_price: toNumber(item.unit_price ?? 0, 0),
          discount_percent: toNumber(item.discount_percent ?? item.discount_percentage ?? 0, 0),
          tax_rate: toNumber(item.tax_rate ?? item.tax_percentage ?? 15, 15),
        }))

        setFormData({
          customer_id: invoice.customer_id || '',
          issue_date: safeDateOnly(invoice.issue_date),
          due_date: safeDateOnly(invoice.due_date),
          notes: invoice.notes || '',
          terms: invoice.terms || '',
          items: items.length > 0 ? items : formData.items,
        })

        setCustomers(customersRes.data.items || [])
        setProducts(productsRes.data.items || [])
      } catch (err: unknown) {
        const e = err as { response?: { data?: { detail?: string } } }
        setError(e.response?.data?.detail || 'Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }

    if (invoiceId) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  const handleInputChange = (field: keyof InvoiceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          tempId: Date.now().toString(),
          description: '',
          quantity: 1,
          unit_price: 0,
          discount_percent: 0,
          tax_rate: 15,
        },
      ],
    }))
  }

  const removeItem = (index: number) => {
    if (formData.items.length === 1) {
      setError('Invoice must have at least one item')
      return
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    handleItemChange(index, 'product_id', product.id)
    handleItemChange(index, 'description', product.name)
    handleItemChange(index, 'unit_price', product.selling_price || 0)
  }

  const validateForm = (): string[] => {
    const errors: string[] = []

    if (!formData.customer_id) errors.push('Please select a customer')
    if (!formData.issue_date) errors.push('Issue date is required')
    if (!formData.due_date) errors.push('Due date is required')

    if (formData.issue_date && formData.due_date) {
      if (new Date(formData.due_date) < new Date(formData.issue_date)) {
        errors.push('Due date must be after issue date')
      }
    }

    if (formData.items.length === 0) errors.push('Invoice must have at least one item')

    formData.items.forEach((item, index) => {
      if (!item.description.trim()) errors.push(`Item ${index + 1}: Description is required`)
      if (item.quantity <= 0) errors.push(`Item ${index + 1}: Quantity must be greater than 0`)
      if (item.unit_price < 0) errors.push(`Item ${index + 1}: Unit price cannot be negative`)
    })

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '))
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const invoiceData = {
        customer_id: formData.customer_id,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        notes: formData.notes.trim() || undefined,
        terms: formData.terms.trim() || undefined,
        items: formData.items.map((item) => ({
          product_id: item.product_id || undefined,
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          tax_rate: item.tax_rate || 15,
        })),
      }

      await apiClient.put(`/invoices/${invoiceId}`, invoiceData)
      router.push(`/invoices/${invoiceId}`)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2.response?.data?.detail || 'Failed to update invoice')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading invoice...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/invoices/${invoiceId}`)}
            className="p-2 text-gray-400 hover:text-gray-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Invoice</h1>
            <p className="text-gray-400 mt-1">Update invoice details</p>
          </div>
        </div>
      </div>

      {error && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-4">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Invoice Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Customer *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleInputChange('customer_id', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name || `${customer.first_name} ${customer.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Issue Date *</label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange('issue_date', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Due Date *</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Payment Terms</label>
                <input
                  type="text"
                  value={formData.terms}
                  onChange={(e) => handleInputChange('terms', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Payment due within 30 days"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Invoice Items</h2>
              <Button type="button" onClick={addItem} variant="outline" size="sm" className="border-gray-600">
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div
                  key={item.tempId}
                  className="p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Product (Optional)</label>
                      <select
                        value={item.product_id || ''}
                        onChange={(e) => selectProduct(index, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select product...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.selling_price)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Description *</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="Item description"
                        required
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Qty *</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                        min="1"
                        step="1"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Unit Price *</label>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-400 mb-1">VAT %</label>
                      <input
                        type="number"
                        value={item.tax_rate}
                        onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.5"
                      />
                    </div>

                    <div className="md:col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                        disabled={formData.items.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-white">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-red-400">-{formatCurrency(totals.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">VAT</span>
                    <span className="text-white">{formatCurrency(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-700">
                    <span className="text-white">Total</span>
                    <span className="text-white">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Additional Notes</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Add any additional notes for the customer..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.push(`/invoices/${invoiceId}`)} className="border-gray-600">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}
