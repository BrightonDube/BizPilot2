'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  Calendar,
  DollarSign,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  PackageCheck,
  Send,
  ChevronDown,
} from 'lucide-react'
import { Button, Card, CardContent, Badge, PageHeader } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface OrderItem {
  id: string
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  tax_amount: number
  discount_amount: number
  total: number
}

interface PurchaseDetail {
  id: string
  order_number: string
  supplier_id: string | null
  supplier_name: string | null
  direction: string
  status: string
  payment_status: string
  payment_method: string | null
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_amount: number
  total: number
  amount_paid: number
  balance_due: number
  is_paid: boolean
  order_date: string
  notes: string | null
  items: OrderItem[]
  items_count: number
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  draft: { color: 'bg-gray-500', icon: Clock, label: 'Draft' },
  pending: { color: 'bg-yellow-500', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-500', icon: CheckCircle, label: 'Confirmed' },
  processing: { color: 'bg-purple-500', icon: Package, label: 'Processing' },
  shipped: { color: 'bg-indigo-500', icon: Truck, label: 'Shipped' },
  delivered: { color: 'bg-green-500', icon: CheckCircle, label: 'Delivered' },
  received: { color: 'bg-green-500', icon: CheckCircle, label: 'Received' },
  cancelled: { color: 'bg-red-500', icon: XCircle, label: 'Cancelled' },
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PurchaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const purchaseId = params.id as string

  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  useEffect(() => {
    async function fetchPurchase() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiClient.get<PurchaseDetail>(`/orders/${purchaseId}`)
        setPurchase(response.data)
      } catch (err) {
        console.error('Error fetching purchase:', err)
        setError('Failed to load purchase order')
      } finally {
        setIsLoading(false)
      }
    }

    if (purchaseId) {
      fetchPurchase()
    }
  }, [purchaseId])

  const handleDelete = async () => {
    if (!purchase) return
    if (!window.confirm(`Are you sure you want to delete purchase order ${purchase.order_number}? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await apiClient.delete(`/orders/${purchaseId}`)
      router.push('/purchases')
    } catch (err) {
      console.error('Error deleting purchase:', err)
      setError('Failed to delete purchase order')
      setIsDeleting(false)
    }
  }

  const handleDownloadPdf = async () => {
    try {
      const response = await apiClient.get(`/orders/${purchaseId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${purchase?.order_number || 'purchase'}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      setError('Failed to download PDF')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!purchase) return
    setShowStatusDropdown(false)
    
    try {
      setIsUpdatingStatus(true)
      await apiClient.patch(`/orders/${purchaseId}`, { status: newStatus })
      setPurchase({ ...purchase, status: newStatus })
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update order status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleSendPurchaseOrder = async () => {
    if (!purchase) return
    
    try {
      setIsUpdatingStatus(true)
      await apiClient.patch(`/orders/${purchaseId}`, { status: 'pending' })
      setPurchase({ ...purchase, status: 'pending' })
    } catch (err) {
      console.error('Error sending purchase order:', err)
      setError('Failed to send purchase order')
    } finally {
      setIsUpdatingStatus(false)
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

  if (error || !purchase) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">Purchase order not found</h3>
        <p className="text-gray-400 mb-6">{error || 'The purchase order you are looking for does not exist.'}</p>
        <Link href="/purchases">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchases
          </Button>
        </Link>
      </div>
    )
  }

  const statusInfo = STATUS_CONFIG[purchase.status] || STATUS_CONFIG.pending
  const StatusIcon = statusInfo.icon

  return (
    <div>
      <PageHeader
        title={`Purchase Order ${purchase.order_number}`}
        description={`Created on ${formatDate(purchase.created_at)}`}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/purchases">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            
            {/* Status Change Dropdown */}
            <div className="relative">
              <Button 
                variant="outline" 
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <StatusIcon className="h-4 w-4 mr-2" />
                )}
                {statusInfo.label}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
              {showStatusDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        purchase.status === option.value ? 'text-purple-400 bg-gray-700/50' : 'text-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send Purchase Order button - only for draft orders */}
            {purchase.status === 'draft' && (
              <Button 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={handleSendPurchaseOrder}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Purchase Order
              </Button>
            )}

            {purchase.status !== 'delivered' && purchase.status !== 'received' && purchase.status !== 'cancelled' && (
              <Link href={`/purchases/${purchase.id}/receive`}>
                <Button className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700">
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Receive Order
                </Button>
              </Link>
            )}
            <Link href={`/purchases/${purchase.id}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      />

      {/* Click outside to close dropdown */}
      {showStatusDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowStatusDropdown(false)}
        />
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-gray-800/50 border border-gray-700">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${statusInfo.color} bg-opacity-20`}>
                  <StatusIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{formatCurrency(purchase.total)}</h2>
                    <Badge variant={purchase.status === 'delivered' || purchase.status === 'received' ? 'success' : 'secondary'}>
                      {statusInfo.label}
                    </Badge>
                    <Badge variant={purchase.is_paid ? 'success' : 'warning'}>
                      {purchase.payment_status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400">Order #{purchase.order_number}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Order Details</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Order Date: {formatDate(purchase.order_date)}</span>
                  </div>
                  {purchase.supplier_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Truck className="w-4 h-4 text-gray-500" />
                      <span>Supplier: {purchase.supplier_name}</span>
                    </div>
                  )}
                  {purchase.payment_method && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span>Payment: {purchase.payment_method}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Financials</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(purchase.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatCurrency(purchase.tax_amount)}</span>
                    </div>
                    {purchase.discount_amount > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Discount:</span>
                        <span>-{formatCurrency(purchase.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-white pt-1 border-t border-gray-700">
                      <span>Total:</span>
                      <span>{formatCurrency(purchase.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span>{formatCurrency(purchase.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Balance Due:</span>
                      <span className={purchase.balance_due > 0 ? 'text-red-400' : 'text-green-400'}>
                        {formatCurrency(purchase.balance_due)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {purchase.notes && (
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
                  <p className="text-gray-200 whitespace-pre-wrap text-sm">{purchase.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border border-gray-700">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Items ({purchase.items_count})</h3>
              {purchase.items && purchase.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-700">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase py-2">Item</th>
                        <th className="text-right text-xs font-medium text-gray-400 uppercase py-2">Qty</th>
                        <th className="text-right text-xs font-medium text-gray-400 uppercase py-2">Unit Price</th>
                        <th className="text-right text-xs font-medium text-gray-400 uppercase py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {purchase.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3">
                            <div className="text-white">{item.name}</div>
                            {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                          </td>
                          <td className="py-3 text-right text-gray-300">{item.quantity}</td>
                          <td className="py-3 text-right text-gray-300">{formatCurrency(item.unit_price)}</td>
                          <td className="py-3 text-right text-white font-medium">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No items in this order</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-800/50 border border-gray-700">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Order ID</span>
                  <span className="text-gray-200 font-mono text-xs truncate" title={purchase.id}>
                    {purchase.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Direction</span>
                  <Badge variant="secondary">{purchase.direction}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Created</span>
                  <span className="text-gray-200">{formatDate(purchase.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Updated</span>
                  <span className="text-gray-200">{formatDate(purchase.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
