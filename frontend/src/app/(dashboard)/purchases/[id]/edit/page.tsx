'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, Package } from 'lucide-react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Supplier {
  id: string
  name: string
  display_name: string
}

interface PurchaseDetail {
  id: string
  order_number: string
  supplier_id: string | null
  status: string
  payment_status: string
  payment_method: string | null
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_amount: number
  total: number
  order_date: string
  notes: string | null
  internal_notes: string | null
  shipping_address: string | null
  billing_address: string | null
}

const ORDER_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'eft', label: 'EFT' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
]

export default function EditPurchasePage() {
  const params = useParams()
  const router = useRouter()
  const purchaseId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [formData, setFormData] = useState({
    supplier_id: '',
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: 'cash',
    order_date: '',
    tax_rate: '15',
    discount_amount: '0',
    shipping_amount: '0',
    notes: '',
    internal_notes: '',
    shipping_address: '',
    billing_address: '',
  })

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)
        
        const [purchaseRes, suppliersRes] = await Promise.all([
          apiClient.get<PurchaseDetail>(`/orders/${purchaseId}`),
          apiClient.get<{ items: Supplier[] }>('/suppliers?per_page=100'),
        ])
        
        const purchase = purchaseRes.data
        setSuppliers(suppliersRes.data.items || [])
        
        setFormData({
          supplier_id: purchase.supplier_id || '',
          status: purchase.status || 'pending',
          payment_status: purchase.payment_status || 'unpaid',
          payment_method: purchase.payment_method || 'cash',
          order_date: purchase.order_date ? purchase.order_date.split('T')[0] : '',
          tax_rate: '15',
          discount_amount: (purchase.discount_amount || 0).toString(),
          shipping_amount: (purchase.shipping_amount || 0).toString(),
          notes: purchase.notes || '',
          internal_notes: purchase.internal_notes || '',
          shipping_address: purchase.shipping_address || '',
          billing_address: purchase.billing_address || '',
        })
      } catch (err) {
        console.error('Error fetching purchase:', err)
        setError('Failed to load purchase order')
      } finally {
        setIsLoading(false)
      }
    }

    if (purchaseId) {
      fetchData()
    }
  }, [purchaseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      await apiClient.put(`/orders/${purchaseId}`, {
        supplier_id: formData.supplier_id || null,
        status: formData.status,
        payment_status: formData.payment_status,
        payment_method: formData.payment_method || null,
        order_date: formData.order_date || null,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        shipping_amount: parseFloat(formData.shipping_amount) || 0,
        notes: formData.notes || null,
        internal_notes: formData.internal_notes || null,
        shipping_address: formData.shipping_address || null,
        billing_address: formData.billing_address || null,
      })
      router.push(`/purchases/${purchaseId}`)
    } catch (err) {
      console.error('Error updating purchase:', err)
      setError('Failed to update purchase order')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading purchase order...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Edit Purchase Order</h1>
          <p className="text-gray-400">Update purchase order details</p>
        </div>
        <Link href={`/purchases/${purchaseId}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            Purchase Order Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Supplier
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select a supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.display_name || supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white"
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={formData.payment_status}
                  onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white"
                >
                  {PAYMENT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Order Date
                </label>
                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tax Rate (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Discount (ZAR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Shipping (ZAR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.shipping_amount}
                  onChange={(e) => setFormData({ ...formData, shipping_amount: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Notes visible to supplier..."
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Internal Notes
              </label>
              <textarea
                value={formData.internal_notes}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                rows={2}
                placeholder="Internal notes (not visible to supplier)..."
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/purchases/${purchaseId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isSaving ? (
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
        </CardContent>
      </Card>
    </motion.div>
  )
}
