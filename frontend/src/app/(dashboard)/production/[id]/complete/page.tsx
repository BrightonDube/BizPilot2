'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, LoadingSpinner } from '@/components/ui'
import { safeToFixed } from '@/lib/utils'

interface ProductionOrder {
  id: string
  order_number: string
  product_name: string | null
  quantity_to_produce: number
  estimated_cost: number
}

export default function CompleteProductionPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    quantity_produced: '',
    actual_cost: '',
  })

  useEffect(() => {
    async function fetchOrder() {
      try {
        setIsLoading(true)
        const response = await apiClient.get<ProductionOrder>(`/production/${orderId}`)
        setOrder(response.data)
        setFormData({
          quantity_produced: String(response.data.quantity_to_produce),
          actual_cost: safeToFixed(response.data.estimated_cost, 2),
        })
      } catch (err) {
        setError('Failed to load production order')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrder()
  }, [orderId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        quantity_produced: parseInt(formData.quantity_produced) || 0,
        actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
      }

      await apiClient.post(`/production/${order.id}/complete`, payload)
      router.push(`/production/${order.id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to complete production')
    } finally {
      setIsSubmitting(false)
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
        title="Complete Production"
        description={`Complete production order ${order.order_number}`}
        actions={
          <Link href={`/production/${order.id}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Order
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Production Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Product</label>
                <p className="text-foreground">{order.product_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Quantity Produced *
                </label>
                <Input
                  name="quantity_produced"
                  type="number"
                  min="1"
                  max={order.quantity_to_produce * 2}
                  value={formData.quantity_produced}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {order.quantity_to_produce} units
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  Actual Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R</span>
                  <Input
                    name="actual_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.actual_cost}
                    onChange={handleChange}
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimated: R {safeToFixed(order.estimated_cost, 2)}
                </p>
              </div>

              <div className="pt-4">
                <Button type="submit" variant="gradient" disabled={isSubmitting} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Completing...' : 'Complete Production'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                This will add the produced quantity to inventory and deduct ingredients.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
