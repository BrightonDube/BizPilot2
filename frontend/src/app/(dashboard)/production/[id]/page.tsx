'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, CheckCircle, XCircle, Factory } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, LoadingSpinner, Badge } from '@/components/ui'
import { formatDate, safeToFixed } from '@/lib/utils'

interface ProductionOrderItem {
  id: string
  name: string
  unit: string
  quantity_required: number
  quantity_used: number
  unit_cost: number
  line_total: number
  source_product_id: string | null
  source_product_name: string | null
}

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
  started_at: string | null
  completed_at: string | null
  notes: string | null
  completion_percentage: number
  items: ProductionOrderItem[]
  created_at: string
  updated_at: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted/50 text-muted-foreground',
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

export default function ProductionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchOrder = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.get<ProductionOrder>(`/production/${orderId}`)
      setOrder(response.data)
    } catch (err) {
      setError('Failed to load production order')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const handleStart = async () => {
    if (!order) return
    setActionLoading(true)
    try {
      await apiClient.post(`/production/${order.id}/start`)
      fetchOrder()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start production')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!order || !confirm('Are you sure you want to cancel this production order?')) return
    setActionLoading(true)
    try {
      await apiClient.post(`/production/${order.id}/cancel`)
      fetchOrder()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel production')
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Production order not found</p>
        <Link href="/production">
          <Button variant="outline" className="mt-4">
            Back to Production
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Production Order ${order.order_number}`}
        description={order.product_name || 'Unknown Product'}
        actions={
          <div className="flex gap-2">
            {order.status === 'draft' && (
              <Button
                variant="gradient"
                onClick={handleStart}
                disabled={actionLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Production
              </Button>
            )}
            {order.status === 'in_progress' && (
              <Link href={`/production/${order.id}/complete`}>
                <Button variant="gradient">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Production
                </Button>
              </Link>
            )}
            {['draft', 'pending', 'in_progress'].includes(order.status) && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={actionLoading}
                className="text-red-400 border-red-400/50 hover:bg-red-400/10"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Link href="/production">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Production Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <Badge className={statusColors[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Product</span>
                  <p className="text-foreground">{order.product_name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Quantity to Produce</span>
                  <p className="text-foreground font-medium">{order.quantity_to_produce}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Quantity Produced</span>
                  <p className="text-foreground font-medium">{order.quantity_produced}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Scheduled Date</span>
                  <p className="text-foreground">{order.scheduled_date ? formatDate(order.scheduled_date) : '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Started At</span>
                  <p className="text-foreground">{order.started_at ? formatDate(order.started_at) : '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Completed At</span>
                  <p className="text-foreground">{order.completed_at ? formatDate(order.completed_at) : '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Created</span>
                  <p className="text-foreground">{formatDate(order.created_at)}</p>
                </div>
              </div>

              {order.status === 'in_progress' && (
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <div className="mt-2">
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all"
                        style={{ width: `${order.completion_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground mt-1">
                      {order.completion_percentage.toFixed(0)}% complete
                    </span>
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">Notes</span>
                  <p className="text-foreground mt-1">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bill of Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="text-left text-card-foreground">
                      <th className="p-3">Ingredient</th>
                      <th className="p-3">Unit</th>
                      <th className="p-3">Required</th>
                      <th className="p-3">Used</th>
                      <th className="p-3">Unit Cost</th>
                      <th className="p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card/30">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 text-foreground">
                          {item.name}
                          {item.source_product_name && (
                            <span className="text-xs text-blue-400 ml-2">
                              (Linked: {item.source_product_name})
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{item.unit}</td>
                        <td className="p-3 text-foreground">{safeToFixed(item.quantity_required, 2)}</td>
                        <td className="p-3 text-foreground">{safeToFixed(item.quantity_used, 2)}</td>
                        <td className="p-3 text-muted-foreground">R {safeToFixed(item.unit_cost, 2)}</td>
                        <td className="p-3 text-foreground">R {safeToFixed(item.line_total, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cost Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Cost:</span>
                <span className="text-foreground">R {safeToFixed(order.estimated_cost, 2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Actual Cost:</span>
                <span className="text-foreground">R {safeToFixed(order.actual_cost, 2)}</span>
              </div>
              {order.status === 'completed' && order.actual_cost !== order.estimated_cost && (
                <div className="flex justify-between text-sm border-t border-border pt-4">
                  <span className="text-muted-foreground">Variance:</span>
                  <span className={order.actual_cost > order.estimated_cost ? 'text-red-400' : 'text-green-400'}>
                    R {safeToFixed(order.actual_cost - order.estimated_cost, 2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
