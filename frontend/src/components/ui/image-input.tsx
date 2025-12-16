'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  X, 
  Link, 
  FileImage, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'

interface ImageInputProps {
  value?: string
  onChange: (value: string) => void
  onError?: (error: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  accept?: string
  maxSize?: number // in MB
  aspectRatio?: number // width/height
}

export function ImageInput({
  value,
  onChange,
  onError,
  className = "",
  disabled = false,
  accept = "image/*",
  maxSize = 5, // 5MB default
  aspectRatio
}: ImageInputProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('url')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState('')

  const validateImage = useCallback(async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        setError(`File size must be less than ${maxSize}MB`)
        resolve(false)
        return
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file')
        resolve(false)
        return
      }

      // Validate image dimensions if aspectRatio is specified
      if (aspectRatio) {
        const img = new Image()
        img.onload = () => {
          const ratio = img.width / img.height
          const tolerance = 0.1
          if (Math.abs(ratio - aspectRatio) > tolerance) {
            setError(`Image aspect ratio should be ${aspectRatio}:1`)
            resolve(false)
          } else {
            setError(null)
            resolve(true)
          }
        }
        img.onerror = () => {
          setError('Invalid image file')
          resolve(false)
        }
        img.src = URL.createObjectURL(file)
      } else {
        setError(null)
        resolve(true)
      }
    })
  }, [maxSize, aspectRatio])

  const handleFileUpload = useCallback(async (file: File) => {
    if (disabled) return

    setIsLoading(true)
    setError(null)

    try {
      const isValid = await validateImage(file)
      if (!isValid) {
        setIsLoading(false)
        return
      }

      // Convert to base64
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        onChange(result)
        setIsLoading(false)
        onError?.('')
      }
      reader.onerror = () => {
        setError('Failed to read file')
        setIsLoading(false)
        onError?.('Failed to read file')
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Failed to process image')
      setIsLoading(false)
      onError?.('Failed to process image')
    }
  }, [disabled, validateImage, onChange, onError])

  const handleUrlSubmit = useCallback(async (url: string) => {
    if (disabled || !url.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      // Normalize URL - add protocol if missing
      let normalizedUrl = url.trim()
      if (!normalizedUrl.match(/^https?:\/\//)) {
        normalizedUrl = `https://${normalizedUrl}`
      }

      // Validate URL
      const urlObj = new URL(normalizedUrl)
      if (!urlObj.protocol.startsWith('http')) {
        throw new Error('Invalid URL protocol')
      }

      // Test if image loads
      const img = new Image()
      img.onload = () => {
        onChange(normalizedUrl)
        setIsLoading(false)
        setUrlInput('')
        onError?.('')
      }
      img.onerror = () => {
        setError('Invalid image URL')
        setIsLoading(false)
        onError?.('Invalid image URL')
      }
      img.src = normalizedUrl
    } catch (err) {
      setError('Please enter a valid image URL')
      setIsLoading(false)
      onError?.('Please enter a valid image URL')
    }
  }, [disabled, onChange, onError])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))

    if (imageFile) {
      handleFileUpload(imageFile)
    } else {
      setError('Please drop a valid image file')
      onError?.('Please drop a valid image file')
    }
  }, [disabled, handleFileUpload, onError])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleRemoveImage = useCallback(() => {
    onChange('')
    setError(null)
    onError?.('')
  }, [onChange, onError])

  const handleUrlInputKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleUrlSubmit(urlInput)
    }
  }, [urlInput, handleUrlSubmit])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Image Preview */}
      {value && (
        <motion.div
          className="relative group"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <div className="relative rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
            <img
              src={value}
              alt="Preview"
              className="w-full h-48 object-cover"
              onError={() => setError('Failed to load image')}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
              <motion.button
                type="button"
                onClick={handleRemoveImage}
                className="opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-all duration-200"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Input Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setInputMode('url')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            inputMode === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
          }`}
          disabled={disabled}
        >
          <Link className="h-4 w-4 inline mr-1" />
          URL
        </button>
        <button
          type="button"
          onClick={() => setInputMode('upload')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            inputMode === 'upload'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
          }`}
          disabled={disabled}
        >
          <Upload className="h-4 w-4 inline mr-1" />
          Upload
        </button>
      </div>

      {/* URL Input */}
      <AnimatePresence>
        {inputMode === 'url' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={handleUrlInputKeyPress}
                placeholder="Enter image URL (e.g., example.com/image.jpg)"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled || isLoading}
              />
              <motion.button
                type="button"
                onClick={() => handleUrlSubmit(urlInput)}
                disabled={disabled || isLoading || !urlInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Add
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Area */}
      <AnimatePresence>
        {inputMode === 'upload' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                isDragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !disabled && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileInputChange}
                className="hidden"
                disabled={disabled}
              />

              <motion.div
                className="flex flex-col items-center gap-3"
                whileHover={{ scale: isDragOver ? 1.05 : 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {isLoading ? (
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                ) : (
                  <FileImage className="h-8 w-8 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    {isDragOver ? 'Drop image here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG, JPG, GIF up to {maxSize}MB
                    {aspectRatio && ` • Aspect ratio ${aspectRatio}:1`}
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
