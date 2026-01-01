'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileSpreadsheet, Loader2, Check, AlertTriangle, Download } from 'lucide-react'
import { Button } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface BulkInventoryImportProps {
  onClose: () => void
  onSuccess?: () => void
}

interface ImportRow {
  product_name: string
  sku: string
  quantity_on_hand: number
  reorder_point: number
  reorder_quantity: number
  location: string
  bin_location: string
  average_cost: number
}

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export function BulkInventoryImport({ onClose, onSuccess }: BulkInventoryImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ImportRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setFile(selectedFile)
    setError(null)
    setIsProcessing(true)

    try {
      const text = await selectedFile.text()
      const rows = parseCSV(text)

      if (rows.length === 0) {
        setError('No data found in the file')
        setIsProcessing(false)
        return
      }

      setParsedData(rows)
      setStep('preview')
    } catch (err) {
      console.error('Failed to parse CSV:', err)
      setError('Failed to parse CSV file. Please check the format.')
    } finally {
      setIsProcessing(false)
    }
  }

  const parseCSV = (text: string): ImportRow[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows: ImportRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < 2) continue

      const row: ImportRow = {
        product_name: getColumnValue(headers, values, ['product_name', 'product', 'name', 'item']),
        sku: getColumnValue(headers, values, ['sku', 'product_sku', 'item_sku']),
        quantity_on_hand: parseInt(getColumnValue(headers, values, ['quantity_on_hand', 'quantity', 'qty', 'stock'])) || 0,
        reorder_point: parseInt(getColumnValue(headers, values, ['reorder_point', 'reorder', 'min_stock'])) || 10,
        reorder_quantity: parseInt(getColumnValue(headers, values, ['reorder_quantity', 'reorder_qty'])) || 50,
        location: getColumnValue(headers, values, ['location', 'warehouse']),
        bin_location: getColumnValue(headers, values, ['bin_location', 'bin', 'shelf']),
        average_cost: parseFloat(getColumnValue(headers, values, ['average_cost', 'cost', 'unit_cost'])) || 0,
      }

      if (row.product_name || row.sku) {
        rows.push(row)
      }
    }

    return rows
  }

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  const getColumnValue = (headers: string[], values: string[], possibleNames: string[]): string => {
    for (const name of possibleNames) {
      const index = headers.indexOf(name)
      if (index !== -1 && values[index]) {
        return values[index].replace(/"/g, '')
      }
    }
    return ''
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return

    setIsImporting(true)
    setError(null)

    const result: ImportResult = { success: 0, failed: 0, errors: [] }

    // First, get existing products to map SKUs to product IDs
    try {
      const products: { id: string; sku: string; name: string }[] = []
      let page = 1
      let pages = 1
      do {
        const productsRes = await apiClient.get<{ items: { id: string; sku: string; name: string }[]; pages?: number }>(
          `/products?page=${page}&per_page=100`,
        )
        products.push(...(productsRes.data.items || []))
        pages = productsRes.data.pages ?? 1
        page += 1
      } while (page <= pages)
      const skuToProduct = new Map(products.map(p => [p.sku?.toLowerCase(), p]))
      const nameToProduct = new Map(products.map(p => [p.name?.toLowerCase(), p]))

      for (const row of parsedData) {
        try {
          // Find product by SKU or name
          const product = skuToProduct.get(row.sku?.toLowerCase()) || nameToProduct.get(row.product_name?.toLowerCase())
          
          if (!product) {
            result.failed++
            result.errors.push(`Product not found: ${row.sku || row.product_name}`)
            continue
          }

          // Check if inventory item already exists
          const existingRes = await apiClient.get(`/inventory/product/${product.id}`).catch(() => null)
          
          if (existingRes?.data) {
            // Update existing inventory item
            await apiClient.put(`/inventory/${existingRes.data.id}`, {
              quantity_on_hand: row.quantity_on_hand,
              reorder_point: row.reorder_point,
              reorder_quantity: row.reorder_quantity,
              location: row.location || null,
              bin_location: row.bin_location || null,
            })
          } else {
            // Create new inventory item
            await apiClient.post('/inventory', {
              product_id: product.id,
              quantity_on_hand: row.quantity_on_hand,
              reorder_point: row.reorder_point,
              reorder_quantity: row.reorder_quantity,
              location: row.location || null,
              bin_location: row.bin_location || null,
              average_cost: row.average_cost.toString(),
              last_cost: row.average_cost.toString(),
            })
          }
          result.success++
        } catch (err: unknown) {
          result.failed++
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          result.errors.push(`Failed to import ${row.sku || row.product_name}: ${errorMessage}`)
        }
      }

      setImportResult(result)
      setStep('result')
      
      if (result.success > 0 && onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Import failed:', err)
      setError('Failed to import inventory data')
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    const template = `"Product Name","SKU","Quantity On Hand","Reorder Point","Reorder Quantity","Location","Bin Location","Average Cost"
"Example Product","SKU-001",100,10,50,"Warehouse A","Shelf B3",25.99
"Another Product","SKU-002",50,5,25,"Warehouse A","Shelf A1",15.50`
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventory_import_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
          className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Upload className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Import Inventory</h2>
                <p className="text-sm text-gray-400">
                  {step === 'upload' && 'Upload a CSV file to import inventory data'}
                  {step === 'preview' && `Preview ${parsedData.length} items to import`}
                  {step === 'result' && 'Import completed'}
                </p>
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
          <div className="p-6">
            {step === 'upload' && (
              <div className="space-y-6">
                {/* Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const dropped = e.dataTransfer.files?.[0]
                    if (dropped) {
                      await handleFile(dropped)
                    }
                  }}
                  className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={async (e) => {
                      const selected = e.target.files?.[0]
                      if (selected) {
                        await handleFile(selected)
                      }
                    }}
                    className="hidden"
                  />
                  {isProcessing ? (
                    <Loader2 className="h-12 w-12 mx-auto text-blue-400 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  )}
                  <p className="text-white font-medium mb-2">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-sm text-gray-400">CSV files only</p>
                </div>

                {/* Download Template */}
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-sm text-white font-medium">Need a template?</p>
                    <p className="text-xs text-gray-400">Download our CSV template with example data</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                </div>

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                {/* Preview Table */}
                <div className="max-h-64 overflow-auto border border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-gray-300">Product</th>
                        <th className="text-left p-3 text-gray-300">SKU</th>
                        <th className="text-right p-3 text-gray-300">Qty</th>
                        <th className="text-left p-3 text-gray-300">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-gray-700">
                          <td className="p-3 text-white">{row.product_name || '-'}</td>
                          <td className="p-3 text-gray-400">{row.sku || '-'}</td>
                          <td className="p-3 text-right text-white">{row.quantity_on_hand}</td>
                          <td className="p-3 text-gray-400">{row.location || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 10 && (
                  <p className="text-sm text-gray-400 text-center">
                    ...and {parsedData.length - 10} more items
                  </p>
                )}

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}

            {step === 'result' && importResult && (
              <div className="text-center py-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  importResult.failed === 0 ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  {importResult.failed === 0 ? (
                    <Check className="h-8 w-8 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-yellow-400" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Import Complete</h3>
                <div className="flex justify-center gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{importResult.success}</p>
                    <p className="text-sm text-gray-400">Successful</p>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400">{importResult.failed}</p>
                      <p className="text-sm text-gray-400">Failed</p>
                    </div>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-auto text-left p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-sm text-red-400">{err}</p>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p className="text-sm text-gray-400 mt-2">...and {importResult.errors.length - 5} more errors</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
            {step === 'upload' && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setParsedData([]) }}>
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {parsedData.length} Items
                    </>
                  )}
                </Button>
              </>
            )}
            {step === 'result' && (
              <Button onClick={onClose} className="bg-gradient-to-r from-blue-600 to-purple-600">
                Done
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
