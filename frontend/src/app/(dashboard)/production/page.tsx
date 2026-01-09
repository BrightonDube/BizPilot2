'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Factory, Play, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button, Card, CardContent, PageHeader, LoadingSpinner, Badge } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'

interface ProductionOrder {
  id: string
  order_number: string
  product_id: string
  product_name: string | null
  quantity_to_produce: number
  quantity_produced: number
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled'
  estimated_cost: number
  actual_cost: number
  scheduled_date: string | null
  completed_at: string | null
  completion_percentage: number
  created_at: string
}

interface ProductionListResponse {
  items: ProductionOrder[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  pending: 'bg-yellow-500/20 text-yellow-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-green-500/20 text-green-300',
  cancelled: 'bg-red-500/20 text-red-300',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (statusFilter) params.append('status', statusFilter)
      
      const response = await apiClient.get<ProductionListResponse>(`/production?${params}`)
      setOrders(response.data.items)
      setTotalPages(response.data.total_pages)
    } catch (err) {
      setError('Failed to load production orders')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter])

  const handleStartProduction = async (orderId: string) => {
    try {
      await apiClient.post(`/production/${orderId}/start`)
      fetchOrders()
    } catch (err) {
      console.error('Failed to start production:', err)
    }
  }

  const handleCancelProduction = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this production order?')) return
    try {
      await apiClient.post(`/production/${orderId}/cancel`)
      fetchOrders()
    } catch (err) {
      console.error('Failed to cancel production:', err)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this production order?')) return
    try {
      await apiClient.delete(`/production/${orderId}`)
      fetchOrders()
    } catch (err) {
      console.error('Failed to delete production:', err)
    }
  }

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Production"
        description="Manufacture products from raw ingredients"
        actions={
          <Link href="/production/new">
            <Button variant="gradient">
              <Plus className="h-4 w-4 mr-2" />
              New Production Order
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Factory className="h-12 w-12 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No production orders yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first production order to start manufacturing products from ingredients.
            </p>
            <Link href="/production/new">
              <Button variant="gradient">
                <Plus className="h-4 w-4 mr-2" />
                Create Production Order
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:border-gray-600 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold text-white">{order.order_number}</span>
                      <Badge className={statusColors[order.status]}>
                        {statusLabels[order.status]}
                      </Badge>
                    </div>
                    <p className="text-gray-300">{order.product_name || 'Unknown Product'}</p>
                    <div className="flex gap-6 mt-2 text-sm text-gray-400">
                      <span>Qty: {order.quantity_produced}/{order.quantity_to_produce}</span>
                      <span>Est. Cost: {formatCurrency(order.estimated_cost)}</span>
                      {order.status === 'completed' && (
                        <span>Actual Cost: {formatCurrency(order.actual_cost)}</span>
                      )}
                      {order.scheduled_date && (
                        <span>Scheduled: {formatDate(order.scheduled_date)}</span>
                      )}
                    </div>
                    {order.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${order.completion_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 mt-1">
                          {order.completion_percentage.toFixed(0)}% complete
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/production/${order.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {order.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartProduction(order.id)}
                        className="text-green-400 border-green-400/50 hover:bg-green-400/10"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {order.status === 'in_progress' && (
                      <Link href={`/production/${order.id}/complete`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-400 border-green-400/50 hover:bg-green-400/10"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {['draft', 'pending', 'in_progress'].includes(order.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelProduction(order.id)}
                        className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {['draft', 'cancelled'].includes(order.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteOrder(order.id)}
                        className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
