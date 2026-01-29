'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  Package,
  Warehouse,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  MapPin,
  Loader2,
  History,
} from 'lucide-react'
import { Button, Card, CardContent, Badge, PageHeader } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface InventoryDetail {
  id: string
  product_id: string
  product_name: string | null
  sku: string | null
  quantity_on_hand: number
  quantity_reserved: number
  quantity_incoming: number
  quantity_available: number
  reorder_point: number
  reorder_quantity: number
  location: string | null
  bin_location: string | null
  average_cost: number | null
  last_cost: number | null
  is_low_stock: boolean
  stock_value: number | null
  last_counted_at: string | null
  last_received_at: string | null
  last_sold_at: string | null
  created_at: string
  updated_at: string
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return 'R 0.00'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function InventoryDetailPage() {
  const params = useParams()
  const itemId = params.id as string

  const [item, setItem] = useState<InventoryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchItem() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiClient.get<InventoryDetail>(`/inventory/${itemId}`)
        setItem(response.data)
      } catch (err) {
        console.error('Error fetching inventory item:', err)
        setError('Failed to load inventory item')
      } finally {
        setIsLoading(false)
      }
    }

    if (itemId) {
      fetchItem()
    }
  }, [itemId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading inventory item...</p>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">Inventory item not found</h3>
        <p className="text-gray-400 mb-6">{error || 'The inventory item you are looking for does not exist.'}</p>
        <Link href="/inventory">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={item.product_name || 'Inventory Item'}
        description={item.sku ? `SKU: ${item.sku}` : 'Inventory details'}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/inventory">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link href={`/inventory/${item.id}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className={`${item.is_low_stock ? 'border-red-500/50' : 'border-gray-700'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.is_low_stock ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                <Package className={`h-5 w-5 ${item.is_low_stock ? 'text-red-400' : 'text-blue-400'}`} />
              </div>
              <div>
                <p className="text-sm text-gray-400">On Hand</p>
                <p className="text-xl font-bold text-white">{item.quantity_on_hand}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <TrendingDown className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Reserved</p>
                <p className="text-xl font-bold text-white">{item.quantity_reserved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Package className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Available</p>
                <p className="text-xl font-bold text-white">{item.quantity_available}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <DollarSign className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Stock Value</p>
                <p className="text-xl font-bold text-white">{formatCurrency(item.stock_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${item.is_low_stock ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  <Warehouse className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{item.product_name || 'Unknown Product'}</h2>
                    {item.is_low_stock && (
                      <Badge variant="danger" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Low Stock
                      </Badge>
                    )}
                  </div>
                  {item.sku && <p className="text-sm text-gray-400">SKU: {item.sku}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Stock Levels</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="flex justify-between">
                      <span>On Hand:</span>
                      <span className="font-medium">{item.quantity_on_hand}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reserved:</span>
                      <span>{item.quantity_reserved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Incoming:</span>
                      <span>{item.quantity_incoming}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-white">
                      <span>Available:</span>
                      <span>{item.quantity_available}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Reorder Settings</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Reorder Point:</span>
                      <span>{item.reorder_point}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reorder Quantity:</span>
                      <span>{item.reorder_quantity}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Location</h3>
                  {item.location || item.bin_location ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span>{[item.location, item.bin_location].filter(Boolean).join(' / ')}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No location set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Costing</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Average Cost:</span>
                      <span>{formatCurrency(item.average_cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Cost:</span>
                      <span>{formatCurrency(item.last_cost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-gray-400" />
                Activity
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Last Counted</span>
                  <span className="text-gray-200">{formatDate(item.last_counted_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Last Received</span>
                  <span className="text-gray-200">{formatDate(item.last_received_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Last Sold</span>
                  <span className="text-gray-200">{formatDate(item.last_sold_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Item ID</span>
                  <span className="text-gray-200 font-mono text-xs truncate" title={item.id}>
                    {item.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Product ID</span>
                  <Link href={`/products/${item.product_id}`} className="text-blue-400 hover:text-blue-300 font-mono text-xs truncate">
                    {item.product_id}
                  </Link>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Created</span>
                  <span className="text-gray-200">{formatDate(item.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Updated</span>
                  <span className="text-gray-200">{formatDate(item.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
