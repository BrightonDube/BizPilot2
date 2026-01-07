'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, Warehouse } from 'lucide-react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface InventoryDetail {
  id: string
  product_id: string
  product_name: string | null
  sku: string | null
  quantity_on_hand: number
  quantity_reserved: number
  quantity_incoming: number
  reorder_point: number
  reorder_quantity: number
  location: string | null
  bin_location: string | null
  average_cost: number | null
  last_cost: number | null
}

export default function EditInventoryPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productName, setProductName] = useState<string>('')

  const [formData, setFormData] = useState({
    quantity_on_hand: '0',
    quantity_reserved: '0',
    quantity_incoming: '0',
    reorder_point: '10',
    reorder_quantity: '20',
    location: '',
    bin_location: '',
    average_cost: '0',
    last_cost: '0',
  })

  useEffect(() => {
    async function fetchItem() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiClient.get<InventoryDetail>(`/inventory/${itemId}`)
        const item = response.data
        setProductName(item.product_name || 'Unknown Product')
        setFormData({
          quantity_on_hand: item.quantity_on_hand.toString(),
          quantity_reserved: item.quantity_reserved.toString(),
          quantity_incoming: item.quantity_incoming.toString(),
          reorder_point: item.reorder_point.toString(),
          reorder_quantity: item.reorder_quantity.toString(),
          location: item.location || '',
          bin_location: item.bin_location || '',
          average_cost: (item.average_cost || 0).toString(),
          last_cost: (item.last_cost || 0).toString(),
        })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      await apiClient.put(`/inventory/${itemId}`, {
        quantity_on_hand: parseInt(formData.quantity_on_hand) || 0,
        quantity_reserved: parseInt(formData.quantity_reserved) || 0,
        quantity_incoming: parseInt(formData.quantity_incoming) || 0,
        reorder_point: parseInt(formData.reorder_point) || 0,
        reorder_quantity: parseInt(formData.reorder_quantity) || 0,
        location: formData.location || null,
        bin_location: formData.bin_location || null,
        average_cost: parseFloat(formData.average_cost) || null,
        last_cost: parseFloat(formData.last_cost) || null,
      })
      router.push(`/inventory/${itemId}`)
    } catch (err) {
      console.error('Error updating inventory item:', err)
      setError('Failed to update inventory item')
    } finally {
      setIsSaving(false)
    }
  }

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Edit Inventory</h1>
          <p className="text-gray-400">{productName}</p>
        </div>
        <Link href={`/inventory/${itemId}`}>
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
            <Warehouse className="h-5 w-5 text-blue-400" />
            Inventory Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Quantity On Hand
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Reserved
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantity_reserved}
                  onChange={(e) => setFormData({ ...formData, quantity_reserved: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Incoming
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantity_incoming}
                  onChange={(e) => setFormData({ ...formData, quantity_incoming: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Reorder Point
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.reorder_point}
                  onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Reorder Quantity
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({ ...formData, reorder_quantity: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Suggested order quantity</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Location
                </label>
                <Input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Warehouse A"
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Bin Location
                </label>
                <Input
                  type="text"
                  value={formData.bin_location}
                  onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })}
                  placeholder="e.g., A-01-03"
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Average Cost (ZAR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.average_cost}
                  onChange={(e) => setFormData({ ...formData, average_cost: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Last Cost (ZAR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.last_cost}
                  onChange={(e) => setFormData({ ...formData, last_cost: e.target.value })}
                  className="bg-gray-900/50 border-gray-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/inventory/${itemId}`}>
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
