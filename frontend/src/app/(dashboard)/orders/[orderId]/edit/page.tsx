'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, ShoppingBag } from 'lucide-react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Customer {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
}

interface OrderDetail {
  id: string
  order_number: string
  customer_id: string | null
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
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'eft', label: 'EFT' },
  { value: 'payfast', label: 'PayFast' },
  { value: 'yoco', label: 'Yoco' },
  { value: 'snapscan', label: 'SnapScan' },
  { value: 'other', label: 'Other' },
]

export default function EditOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  const [formData, setFormData] = useState({
    customer_id: '',
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: 'cash',
    order_date: '',
    discount_amount: '0',
    shipping_amount: '0',
    notes: '',
    internal_notes: '',
  })

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)
        
        const [orderRes, customersRes] = await Promise.all([
          apiClient.get<OrderDetail>(`/orders/${orderId}`),
          apiClient.get<{ items: Customer[] }>('/customers?per_page=100'),
        ])
        
        const order = orderRes.data
        setCustomers(customersRes.data.items || [])
        
        setFormData({
          customer_id: order.customer_id || '',
          status: order.status || 'pending',
          payment_status: order.payment_status || 'unpaid',
          payment_method: order.payment_method || 'cash',
          order_date: order.order_date ? order.order_date.split('T')[0] : '',
          discount_amount: (order.discount_amount || 0).toString(),
          shipping_amount: (order.shipping_amount || 0).toString(),
          notes: order.notes || '',
          internal_notes: order.internal_notes || '',
        })
      } catch (err) {
        console.error('Error fetching order:', err)
        setError('Failed to load order')
      } finally {
        setIsLoading(false)
      }
    }

    if (orderId) {
      fetchData()
    }
  }, [orderId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      await apiClient.put(`/orders/${orderId}`, {
        customer_id: formData.customer_id || null,
        status: formData.status,
        payment_status: formData.payment_status,
        payment_method: formData.payment_method || null,
        order_date: formData.order_date || null,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        shipping_amount: parseFloat(formData.shipping_amount) || 0,
        notes: formData.notes || null,
        internal_notes: formData.internal_notes || null,
      })
      router.push(`/orders/${orderId}`)
    } catch (err) {
      console.error('Error updating order:', err)
      setError('Failed to update order')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading order...</p>
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
          <h1 className="text-2xl font-bold text-gray-100">Edit Order</h1>
          <p className="text-gray-400">Update order details</p>
        </div>
        <Link href={`/orders/${orderId}`}>
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
            <ShoppingBag className="h-5 w-5 text-blue-400" />
            Order Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Customer
              </label>
              <select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name || `${customer.first_name} ${customer.last_name}`}
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

            <div className="grid grid-cols-2 gap-4">
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
                placeholder="Notes visible to customer..."
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
                placeholder="Internal notes (not visible to customer)..."
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/orders/${orderId}`}>
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
