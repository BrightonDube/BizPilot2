'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileSpreadsheet, Loader2, Check, AlertTriangle, Download } from 'lucide-react'
import { Button } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface BulkProductImportProps {
  onClose: () => void
  onSuccess?: () => void
}

interface ImportResult {
  success: boolean
  updated: number
  created: number
  skipped: number
  errors: string[]
}

interface ImportErrorDetail {
  message?: string
  errors?: string[]
  updated?: number
  created?: number
  skipped?: number
}

interface ApiErrorResponse {
  response?: {
    data?: {
      detail?: ImportErrorDetail | string
    }
  }
}

export function BulkProductImport({ onClose, onSuccess }: BulkProductImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'result'>('upload')

  const handleFile = async (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls']
    const hasValidExtension = validExtensions.some(ext => 
      selectedFile.name.toLowerCase().endsWith(ext)
    )
    
    if (!hasValidExtension) {
      setError('Please upload an Excel spreadsheet (.xlsx or .xls)')
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiClient.post<ImportResult>('/products/import/excel', formData)
      // Note: Don't set Content-Type header manually for multipart/form-data
      // axios will set it automatically with the correct boundary

      setImportResult(response.data)
      setStep('result')
      
      if (response.data.success && (response.data.updated > 0 || response.data.created > 0) && onSuccess) {
        onSuccess()
      }
    } catch (err: unknown) {
      console.error('Import failed:', err)
      const axiosError = err as ApiErrorResponse
      const detail = axiosError.response?.data?.detail
      
      if (detail) {
        if (typeof detail === 'object' && detail.errors) {
          setImportResult({
            success: false,
            updated: detail.updated ?? 0,
            created: detail.created ?? 0,
            skipped: detail.skipped ?? 0,
            errors: detail.errors,
          })
          setStep('result')
        } else if (typeof detail === 'string') {
          setError(detail)
        } else {
          setError('Failed to import product data')
        }
      } else {
        setError('Failed to import product data')
      }
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await apiClient.get('/products/template/excel', {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'product_import_template.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download template:', err)
      setError('Failed to download template')
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
                <Upload className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Import Products</h2>
                <p className="text-sm text-gray-400">
                  {step === 'upload' && 'Upload an Excel spreadsheet to add products'}
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
          <div className="p-6 overflow-y-auto flex-1">
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    file 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-gray-600 hover:border-purple-500 hover:bg-purple-500/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const selected = e.target.files?.[0]
                      if (selected) {
                        await handleFile(selected)
                      }
                    }}
                    className="hidden"
                  />
                  {file ? (
                    <>
                      <Check className="h-12 w-12 mx-auto text-green-400 mb-4" />
                      <p className="text-white font-medium mb-2">{file.name}</p>
                      <p className="text-sm text-gray-400">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-white font-medium mb-2">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-400">Excel spreadsheets only (.xlsx, .xls)</p>
                    </>
                  )}
                </div>

                {/* Requirements */}
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
                  <p className="text-sm text-white font-medium">Requirements:</p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Product Name column is required</li>
                    <li>• Selling Price column is required</li>
                    <li>• SKU is optional but must be unique</li>
                    <li>• Products will be auto-added to inventory</li>
                  </ul>
                </div>

                {/* Download Template */}
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-sm text-white font-medium">Need a template?</p>
                    <p className="text-xs text-gray-400">Download Excel template with correct columns</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                </div>

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {step === 'result' && importResult && (
              <div className="text-center py-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  importResult.success ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  {importResult.success ? (
                    <Check className="h-8 w-8 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-yellow-400" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  {importResult.success ? 'Import Complete' : 'Import Completed with Issues'}
                </h3>
                <div className="flex justify-center gap-6 mb-4">
                  {importResult.updated > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">{importResult.updated}</p>
                      <p className="text-sm text-gray-400">Updated</p>
                    </div>
                  )}
                  {importResult.created > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{importResult.created}</p>
                      <p className="text-sm text-gray-400">Created</p>
                    </div>
                  )}
                  {importResult.skipped > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-400">{importResult.skipped}</p>
                      <p className="text-sm text-gray-400">Skipped</p>
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
          <div className="flex justify-end gap-3 p-6 border-t border-gray-700 flex-shrink-0">
            {step === 'upload' && (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || isImporting}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </>
            )}
            {step === 'result' && (
              <Button onClick={onClose} className="bg-gradient-to-r from-purple-600 to-pink-600">
                Done
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
