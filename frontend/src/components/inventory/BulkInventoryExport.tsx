'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, FileSpreadsheet, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface BulkInventoryExportProps {
  onClose: () => void
}

export function BulkInventoryExport({ onClose }: BulkInventoryExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    try {
      setIsExporting(true)
      setError(null)

      // Use backend API to generate Excel file
      const response = await apiClient.get('/inventory/export/excel', {
        responseType: 'blob',
      })

      // Create download link
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/)
        if (match) filename = match[1]
      }
      
      link.download = filename
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
          className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md overflow-hidden max-h-[calc(100vh-8rem)] flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Export Inventory</h2>
                <p className="text-sm text-gray-400">Download inventory as Excel spreadsheet</p>
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
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                <p className="text-gray-400">Your Excel file is downloading...</p>
              </motion.div>
            ) : (
              <>
                {/* Export Info */}
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <FileSpreadsheet className="h-5 w-5 text-green-400" />
                    <span className="font-medium">Excel Spreadsheet (.xlsx)</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Export includes all inventory items with:
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1 ml-4">
                    <li>• SKU and Product Name</li>
                    <li>• Quantities (on hand, reserved, incoming)</li>
                    <li>• Reorder settings</li>
                    <li>• Location and bin information</li>
                    <li>• Cost data</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-400 text-center">
                  You can edit the exported file and import it back to update inventory.
                </p>

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
            <div className="flex justify-end gap-3 p-6 border-t border-gray-700 flex-shrink-0">
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
                    Export to Excel
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
