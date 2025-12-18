'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, FileSpreadsheet, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface BulkInventoryExportProps {
  onClose: () => void
}

interface InventoryItem {
  id: string
  product_name: string
  sku: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  reorder_point: number
  reorder_quantity: number
  location: string | null
  bin_location: string | null
  average_cost: number
  is_low_stock: boolean
}

type ExportFormat = 'csv' | 'xlsx'

export function BulkInventoryExport({ onClose }: BulkInventoryExportProps) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [includeHeaders, setIncludeHeaders] = useState(true)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    try {
      setIsExporting(true)
      setError(null)

      // Fetch all inventory items
      const params = new URLSearchParams({ per_page: '1000' })
      if (lowStockOnly) {
        params.append('low_stock', 'true')
      }

      const response = await apiClient.get<{ items: InventoryItem[] }>(`/inventory?${params}`)
      const items = response.data.items

      if (items.length === 0) {
        setError('No inventory items to export')
        return
      }

      // Generate CSV content
      const headers = [
        'Product Name',
        'SKU',
        'Quantity On Hand',
        'Quantity Reserved',
        'Quantity Available',
        'Reorder Point',
        'Reorder Quantity',
        'Location',
        'Bin Location',
        'Average Cost',
        'Low Stock'
      ]

      const rows = items.map(item => [
        item.product_name || '',
        item.sku || '',
        item.quantity_on_hand.toString(),
        item.quantity_reserved.toString(),
        item.quantity_available.toString(),
        item.reorder_point.toString(),
        item.reorder_quantity.toString(),
        item.location || '',
        item.bin_location || '',
        item.average_cost.toFixed(2),
        item.is_low_stock ? 'Yes' : 'No'
      ])

      let csvContent = ''
      if (includeHeaders) {
        csvContent += headers.map(h => `"${h}"`).join(',') + '\n'
      }
      csvContent += rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Export failed:', err)
      setError('Failed to export inventory data')
    } finally {
      setIsExporting(false)
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
          className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Export Inventory</h2>
                <p className="text-sm text-gray-400">Download inventory data as spreadsheet</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {exportSuccess ? (
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Export Complete!</h3>
                <p className="text-gray-400">Your file is downloading...</p>
              </motion.div>
            ) : (
              <>
                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Export Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['csv', 'xlsx'] as ExportFormat[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`p-3 rounded-lg border transition-all ${
                          format === f
                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <span className="font-medium uppercase">{f}</span>
                        <p className="text-xs mt-1 opacity-70">
                          {f === 'csv' ? 'Comma Separated' : 'Excel Format'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Options</label>
                  
                  <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={includeHeaders}
                      onChange={(e) => setIncludeHeaders(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm text-white">Include column headers</p>
                      <p className="text-xs text-gray-400">First row will contain column names</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={lowStockOnly}
                      onChange={(e) => setLowStockOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm text-white">Low stock items only</p>
                      <p className="text-xs text-gray-400">Export only items below reorder point</p>
                    </div>
                  </label>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!exportSuccess && (
            <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
