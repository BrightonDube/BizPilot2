'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  Truck,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  Grid3X3,
  List,
  Mail,
  Phone,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Supplier {
  id: string
  business_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  tax_number: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  notes: string | null
  tags: string[]
  display_name: string
  full_address: string
  created_at: string
  updated_at: string
}

interface SupplierListResponse {
  items: Supplier[]
  total: number
  page: number
  per_page: number
  pages: number
}

function SupplierCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="h-20 bg-gray-700/60 rounded-lg mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  )
}

export function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '20',
        })

        if (searchTerm) {
          params.append('search', searchTerm)
        }

        const response = await apiClient.get<SupplierListResponse>(`/suppliers?${params}`)
        setSuppliers(response.data.items)
        setTotal(response.data.total)
        setPages(response.data.pages)
      } catch (err) {
        console.error('Failed to fetch suppliers:', err)
        setError('Failed to load suppliers')
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchSuppliers, 300)
    return () => clearTimeout(timeoutId)
  }, [page, searchTerm])

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${supplierName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(supplierId)
      await apiClient.delete(`/suppliers/${supplierId}`)
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierId))
    } catch (err) {
      console.error('Failed to delete supplier:', err)
      setError('Failed to delete supplier')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading && suppliers.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Suppliers</h1>
            <p className="text-gray-400">Manage your suppliers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <SupplierCardSkeleton key={i} />
          ))}
        </div>
      </motion.div>
    )
  }

  if (error && suppliers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center"
      >
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-medium text-lg mb-2 text-white">Unable to load suppliers</h3>
        <p className="text-sm mb-4 text-gray-400">{error}</p>
        <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-blue-600 to-purple-600">
          Try Again
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Suppliers</h1>
          <p className="text-gray-400">Manage your suppliers ({total} suppliers)</p>
        </div>
        <Link href="/suppliers/new">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </Link>
      </motion.div>

      <motion.div
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500" />
            <Input
              type="text"
              placeholder="Search suppliers by name, contact, or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-10 bg-gray-900/50 border-gray-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-900/50 rounded-lg p-1 border border-gray-600">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                title="Grid view"
                type="button"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                title="List view"
                type="button"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {error}
        </motion.div>
      )}

      {suppliers.length === 0 ? (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Truck className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">{searchTerm ? 'No suppliers found' : 'No suppliers yet'}</h3>
          <p className="text-gray-400 mb-6">{searchTerm ? 'Try adjusting your search terms' : 'Add your first supplier to get started'}</p>
          {!searchTerm && (
            <Link href="/suppliers/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Supplier
              </Button>
            </Link>
          )}
        </motion.div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {suppliers.map((supplier, index) => (
            <motion.div
              key={supplier.id}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-100 mb-1 truncate">{supplier.display_name || supplier.name}</h3>
                  {supplier.contact_name && <p className="text-sm text-gray-400 truncate">{supplier.contact_name}</p>}
                </div>
                <div className="flex space-x-1">
                  <Link href={`/suppliers/${supplier.id}/edit`}>
                    <motion.button
                      className="p-1 text-gray-500 hover:text-gray-300"
                      title="Edit supplier"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Edit className="h-4 w-4" />
                    </motion.button>
                  </Link>
                  <motion.button
                    onClick={() => handleDeleteSupplier(supplier.id, supplier.display_name || supplier.name)}
                    className="p-1 text-gray-500 hover:text-red-400"
                    title="Delete supplier"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={deletingId === supplier.id}
                  >
                    {deletingId === supplier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </motion.button>
                </div>
              </div>

              <div className="mb-3 h-20 bg-gray-700/40 rounded-lg flex items-center justify-center">
                <Truck className="h-10 w-10 text-gray-500" />
              </div>

              <div className="space-y-2">
                {supplier.email ? (
                  <div className="flex items-center gap-2 text-sm text-gray-300 min-w-0">
                    <Mail className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="h-4 w-4 text-gray-600" />
                    <span>No email</span>
                  </div>
                )}

                {supplier.phone ? (
                  <div className="flex items-center gap-2 text-sm text-gray-300 min-w-0">
                    <Phone className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="truncate">{supplier.phone}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="h-4 w-4 text-gray-600" />
                    <span>No phone</span>
                  </div>
                )}

                {supplier.tags?.length ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {supplier.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs max-w-full truncate">
                        {tag}
                      </Badge>
                    ))}
                    {supplier.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{supplier.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-700">
                <Link href={`/suppliers/${supplier.id}`}>
                  <motion.button
                    className="w-full flex items-center justify-center text-sm text-blue-400 hover:text-blue-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-left text-sm font-medium text-gray-400">Supplier</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Contact</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Email</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, index) => (
                <motion.tr
                  key={supplier.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                        <Truck className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-white truncate block">{supplier.display_name || supplier.name}</span>
                        {supplier.tags?.length ? (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{supplier.tags.join(', ')}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400">{supplier.contact_name || '-'}</td>
                  <td className="p-4 text-gray-400">{supplier.email || '-'}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/suppliers/${supplier.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/suppliers/${supplier.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDeleteSupplier(supplier.id, supplier.display_name || supplier.name)}
                        disabled={deletingId === supplier.id}
                      >
                        {deletingId === supplier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} suppliers)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
