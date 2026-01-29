'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  PackageCheck,
  Package,
  Loader2,
  AlertTriangle,
  Check,
  DollarSign,
} from 'lucide-react'
import { Button, Card, CardContent, Input } from '@/components/ui'
import { PageHeader, Badge } from '@/components/ui/bizpilot'
import { apiClient } from '@/lib/api'

interface OrderItem {
  id: string
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  total: number
  product_id: string | null
}

interface PurchaseOrder {
  id: string
  order_number: string
  supplier_name: string | null
  status: string
  total: number
  items: OrderItem[]
  items_count: number
}

interface ReceiveItemInput {
  item_id: string
  quantity_received: number
  unit_price: number | null
}

interface ReceiveResponse {
  success: boolean
  order_id: string
  order_number: string
  status: string
  items_received: number
  total_quantity_received: number
  inventory_updated: boolean
  message: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function ReceivePurchaseOrderPage() {
  const params = useParams()
  const purchaseId = params.id as string

  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receiveResult, setReceiveResult] = useState<ReceiveResponse | null>(null)

  // Track received quantities and prices for each item
  const [itemInputs, setItemInputs] = useState<Record<string, ReceiveItemInput>>({})

  useEffect(() => {
    async function fetchPurchase() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiClient.get<PurchaseOrder>(`/orders/${purchaseId}`)
        setPurchase(response.data)

        // Initialize inputs with order quantities and prices
        const inputs: Record<string, ReceiveItemInput> = {}
        for (const item of response.data.items) {
          inputs[item.id] = {
            item_id: item.id,
            quantity_received: item.quantity,
            unit_price: item.unit_price,
          }
        }
        setItemInputs(inputs)
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

  const handleQuantityChange = (itemId: string, value: string) => {
    const qty = parseInt(value) || 0
    setItemInputs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity_received: qty,
      },
    }))
  }

  const handlePriceChange = (itemId: string, value: string) => {
    const price = parseFloat(value) || 0
    setItemInputs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        unit_price: price,
      },
    }))
  }

  const handleReceive = async () => {
    if (!purchase) return

    // Filter items with quantity > 0
    const itemsToReceive = Object.values(itemInputs).filter(
      (item) => item.quantity_received > 0
    )

    if (itemsToReceive.length === 0) {
      setError('Please enter quantities for at least one item')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await apiClient.post<ReceiveResponse>(
        `/orders/${purchaseId}/receive`,
        {
          items: itemsToReceive.map((item) => ({
            item_id: item.item_id,
            quantity_received: item.quantity_received,
            unit_price: item.unit_price,
          })),
        }
      )

      setReceiveResult(response.data)
    } catch (err: unknown) {
      console.error('Error receiving order:', err)
      const axiosError = err as { response?: { data?: { detail?: string } } }
      setError(axiosError.response?.data?.detail || 'Failed to receive order')
    } finally {
      setIsSubmitting(false)
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

  if (error && !purchase) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">Purchase order not found</h3>
        <p className="text-gray-400 mb-6">{error}</p>
        <Link href="/purchases">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchases
          </Button>
        </Link>
      </div>
    )
  }

  if (!purchase) return null

  // Check if order can be received
  if (purchase.status === 'received' || purchase.status === 'cancelled') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">
          Order cannot be received
        </h3>
        <p className="text-gray-400 mb-6">
          This order is already {purchase.status}.
        </p>
        <Link href={`/purchases/${purchase.id}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Order
          </Button>
        </Link>
      </div>
    )
  }

  // Show success result
  if (receiveResult) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Order Received Successfully
            </h2>
            <p className="text-gray-400 mb-6">{receiveResult.message}</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-400">
                  {receiveResult.items_received}
                </p>
                <p className="text-sm text-gray-400">Items Received</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-400">
                  {receiveResult.total_quantity_received}
                </p>
                <p className="text-sm text-gray-400">Units Total</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-emerald-400">
                  {receiveResult.inventory_updated ? 'Yes' : 'Partial'}
                </p>
                <p className="text-sm text-gray-400">Inventory Updated</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/purchases">
                <Button variant="outline">Back to Purchases</Button>
              </Link>
              <Link href={`/purchases/${receiveResult.order_id}`}>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                  View Order
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalReceiving = Object.values(itemInputs).reduce(
    (sum, item) => sum + item.quantity_received * (item.unit_price || 0),
    0
  )

  return (
    <div>
      <PageHeader
        title={`Receive ${purchase.order_number}`}
        description={`Receive items from ${purchase.supplier_name || 'Supplier'}`}
        actions={
          <div className="flex items-center gap-3">
            <Link href={`/purchases/${purchase.id}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-400" />
                Items to Receive
              </h3>

              <div className="space-y-4">
                {purchase.items.map((item) => {
                  const input = itemInputs[item.id]
                  const originalPrice = item.unit_price
                  const priceChanged =
                    input?.unit_price !== null &&
                    input?.unit_price !== originalPrice

                  return (
                    <div
                      key={item.id}
                      className="bg-gray-700/50 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-white">{item.name}</h4>
                          {item.sku && (
                            <p className="text-sm text-gray-400">SKU: {item.sku}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            Ordered: {item.quantity} units @ {formatCurrency(originalPrice)}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {formatCurrency(item.total)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Quantity Received
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity * 2}
                            value={input?.quantity_received ?? item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            className="bg-gray-800 border-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Unit Price
                            {priceChanged && (
                              <span className="ml-2 text-yellow-400 text-xs">
                                (changed)
                              </span>
                            )}
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={input?.unit_price ?? originalPrice}
                              onChange={(e) =>
                                handlePriceChange(item.id, e.target.value)
                              }
                              className="bg-gray-800 border-gray-600 pl-9"
                            />
                          </div>
                        </div>
                      </div>

                      {(input?.quantity_received ?? 0) > 0 && (
                        <div className="text-right text-sm">
                          <span className="text-gray-400">Line Total: </span>
                          <span className="text-white font-medium">
                            {formatCurrency(
                              (input?.quantity_received ?? 0) *
                                (input?.unit_price ?? originalPrice)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                Receiving Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Original Total:</span>
                  <span className="text-gray-300">
                    {formatCurrency(purchase.total)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Items to Receive:</span>
                  <span className="text-gray-300">
                    {
                      Object.values(itemInputs).filter(
                        (i) => i.quantity_received > 0
                      ).length
                    }{' '}
                    of {purchase.items.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Units:</span>
                  <span className="text-gray-300">
                    {Object.values(itemInputs).reduce(
                      (sum, i) => sum + i.quantity_received,
                      0
                    )}
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <div className="flex justify-between font-semibold">
                    <span className="text-white">Receiving Total:</span>
                    <span className="text-emerald-400">
                      {formatCurrency(totalReceiving)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-white mb-3">
                What happens when you receive:
              </h3>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  Inventory quantities will be updated
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  Product costs will be updated if price changed
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  Order status will change to Received
                </li>
              </ul>
            </CardContent>
          </Card>

          <Button
            onClick={handleReceive}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PackageCheck className="h-4 w-4 mr-2" />
                Receive Order
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
