'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Edit3, Loader2, Check, AlertTriangle } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface InventoryItem {
  id: string
  product_name: string
  sku: string
  quantity_on_hand: number
  reorder_point: number
  location: string | null
}

interface BulkEditModalProps {
  items: InventoryItem[]
  onClose: () => void
  onSuccess: () => void
}

type EditField = 'reorder_point' | 'location' | 'quantity_adjustment'

export function BulkEditModal({ items, onClose, onSuccess }: BulkEditModalProps) {
  const [editField, setEditField] = useState<EditField>('reorder_point')
  const [value, setValue] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('Bulk stock adjustment')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleApply = async () => {
    if (!value.trim()) {
      setError('Please enter a value')
      return
    }

    setIsProcessing(true)
    setError(null)
    setProgress(0)

    let success = 0
    let failed = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        if (editField === 'quantity_adjustment') {
          const quantityChange = parseInt(value)
          if (isNaN(quantityChange)) {
            failed++
            continue
          }
          await apiClient.post(`/inventory/${item.id}/adjust`, {
            quantity_change: quantityChange,
            reason: adjustmentReason,
          })
        } else {
          const updateData: Record<string, string | number | null> = {}
          if (editField === 'reorder_point') {
            updateData.reorder_point = parseInt(value)
          } else if (editField === 'location') {
            updateData.location = value.trim()
          }
          await apiClient.put(`/inventory/${item.id}`, updateData)
        }
        success++
      } catch (err) {
        console.error(`Failed to update ${item.product_name}:`, err)
        failed++
      }
      setProgress(Math.round(((i + 1) / items.length) * 100))
    }

    setResult({ success, failed })
    setIsProcessing(false)

    if (success > 0) {
      setTimeout(() => {
        onSuccess()
      }, 1500)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg overflow-hidden max-h-[calc(100vh-8rem)] flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Edit3 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Bulk Edit</h2>
                <p className="text-sm text-gray-400">
                  Edit {items.length} selected item{items.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {result ? (
              <motion.div
                className="text-center py-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  result.failed === 0 ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  {result.failed === 0 ? (
                    <Check className="h-8 w-8 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-yellow-400" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Update Complete</h3>
                <div className="flex justify-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{result.success}</p>
                    <p className="text-sm text-gray-400">Updated</p>
                  </div>
                  {result.failed > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                      <p className="text-sm text-gray-400">Failed</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : isProcessing ? (
              <div className="text-center py-4">
                <Loader2 className="h-8 w-8 mx-auto text-purple-400 animate-spin mb-4" />
                <p className="text-white mb-2">Updating items...</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-2">{progress}% complete</p>
              </div>
            ) : (
              <>
                {/* Field Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">What to edit</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'reorder_point', label: 'Reorder Point' },
                      { key: 'location', label: 'Location' },
                      { key: 'quantity_adjustment', label: 'Adjust Qty' },
                    ].map((field) => (
                      <button
                        key={field.key}
                        onClick={() => { setEditField(field.key as EditField); setValue('') }}
                        className={`p-3 rounded-lg border text-sm transition-all ${
                          editField === field.key
                            ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {editField === 'reorder_point' && 'New Reorder Point'}
                    {editField === 'location' && 'New Location'}
                    {editField === 'quantity_adjustment' && 'Quantity Change (+ or -)'}
                  </label>
                  <Input
                    type={editField === 'location' ? 'text' : 'number'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={
                      editField === 'reorder_point' ? 'e.g., 10' :
                      editField === 'location' ? 'e.g., Warehouse A' :
                      'e.g., +5 or -3'
                    }
                    className="bg-gray-900/50 border-gray-600"
                  />
                  {editField === 'quantity_adjustment' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Use positive numbers to add stock, negative to remove
                    </p>
                  )}
                </div>

                {/* Adjustment Reason */}
                {editField === 'quantity_adjustment' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Reason for adjustment
                    </label>
                    <Input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="e.g., Stocktake correction"
                      className="bg-gray-900/50 border-gray-600"
                    />
                  </div>
                )}

                {/* Selected Items Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Selected Items
                  </label>
                  <div className="max-h-32 overflow-auto border border-gray-700 rounded-lg">
                    {items.slice(0, 5).map((item) => (
                      <div key={item.id} className="p-2 border-b border-gray-700 last:border-b-0">
                        <p className="text-sm text-white truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-400">{item.sku || 'No SKU'}</p>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <div className="p-2 text-sm text-gray-400 text-center">
                        ...and {items.length - 5} more
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!result && !isProcessing && (
            <div className="flex justify-end gap-3 p-6 border-t border-gray-700 flex-shrink-0">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!value.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Apply to {items.length} Items
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
