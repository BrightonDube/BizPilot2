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
  Loader2,
  AlertTriangle,
  LayoutGrid,
  List,
  Mail,
  Phone,
  MapPin,
  Users,
  Package,
  DollarSign,
} from 'lucide-react'

import { Button, Input, Card, CardContent } from '@/components/ui'
import { apiClient } from '@/lib/api'
import { formatCurrency, toNumber } from '@/lib/utils'

const statColorClasses: Record<
  string,
  {
    container: string
    icon: string
  }
> = {
  blue: {
    container: 'bg-blue-500/20 border-blue-500/30',
    icon: 'text-blue-400',
  },
  green: {
    container: 'bg-green-500/20 border-green-500/30',
    icon: 'text-green-400',
  },
  purple: {
    container: 'bg-purple-500/20 border-purple-500/30',
    icon: 'text-purple-400',
  },
  yellow: {
    container: 'bg-yellow-500/20 border-yellow-500/30',
    icon: 'text-yellow-400',
  },
}

interface Supplier {
  id: string
  business_id: string
  name: string
  contact_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  tax_number: string | null
  website: string | null
  address: string | null
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
  total_orders?: number
  total_spent?: number
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
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/3" />
        </div>
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

  const handleDeleteSupplier = async (supplierId: string, supplierName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
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

  // Calculate stats
  const totalSuppliers = total
  const totalSpent = suppliers.reduce((sum, s) => sum + toNumber(s.total_spent, 0), 0)
  const totalOrders = suppliers.reduce((sum, s) => sum + toNumber(s.total_orders, 0), 0)
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

  if (isLoading && suppliers.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Suppliers</h1>
            <p className="text-gray-400">Manage your suppliers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
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
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Suppliers</h1>
          <p className="text-gray-400">Manage your suppliers ({totalSuppliers} suppliers)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-gray-800/50 border border-gray-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                viewMode === 'list' ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:text-white'
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                viewMode === 'grid' ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:text-white'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </button>
          </div>

          <Link href="/suppliers/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Suppliers', value: totalSuppliers, color: 'blue' },
          { icon: DollarSign, label: 'Total Spent', value: formatCurrency(totalSpent), color: 'green' },
          { icon: Package, label: 'Total Orders', value: totalOrders, color: 'purple' },
          { icon: Truck, label: 'Avg Order Value', value: formatCurrency(avgOrderValue), color: 'yellow' }
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="flex items-center">
              <motion.div 
                className={`p-2 rounded-lg border ${statColorClasses[stat.color]?.container ?? 'bg-gray-500/20 border-gray-500/30'}`}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <stat.icon className={`h-6 w-6 ${statColorClasses[stat.color]?.icon ?? 'text-gray-400'}`} />
              </motion.div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                <motion.p 
                  className="text-2xl font-bold text-gray-100"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1, type: "spring", stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <motion.div
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
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

      {/* Suppliers List/Grid */}
      {suppliers.length === 0 ? (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Truck className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {searchTerm ? 'No suppliers found' : 'No suppliers yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchTerm ? 'Try adjusting your search terms' : 'Add your first supplier to get started'}
          </p>
          {!searchTerm && (
            <Link href="/suppliers/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Supplier
              </Button>
            </Link>
          )}
        </motion.div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {suppliers.map((supplier, index) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.02 }}
            >
              <Link href={`/suppliers/${supplier.id}`} className="block">
                <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-400">
                          <Truck className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-100 truncate">
                              {supplier.display_name || supplier.name}
                            </h3>
                          </div>

                          <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300 min-w-0">
                            {supplier.email && (
                              <div className="flex items-center gap-2 min-w-0">
                                <Mail className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                <span className="truncate">{supplier.email}</span>
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-2 min-w-0">
                                <Phone className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                <span className="truncate">{supplier.phone}</span>
                              </div>
                            )}
                            {(supplier.city || supplier.full_address) && (
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                <span className="truncate">
                                  {supplier.city || supplier.full_address}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-gray-300">
                            <div className="text-xs text-gray-500">Orders</div>
                            <div className="font-semibold">{supplier.total_orders || 0}</div>
                          </div>
                          <div className="text-gray-300">
                            <div className="text-xs text-gray-500">Spent</div>
                            <div className="font-semibold text-green-400">
                              {formatCurrency(supplier.total_spent || 0)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Link
                            href={`/suppliers/${supplier.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <motion.button
                              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Edit"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Edit className="h-4 w-4" />
                            </motion.button>
                          </Link>
                          <motion.button
                            onClick={(e) => handleDeleteSupplier(supplier.id, supplier.name, e)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            disabled={deletingId === supplier.id}
                          >
                            {deletingId === supplier.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier, index) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <Link href={`/suppliers/${supplier.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all cursor-pointer h-full overflow-hidden">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-400">
                          <Truck className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold text-gray-100 truncate">
                            {supplier.display_name || supplier.name}
                          </h3>
                          {supplier.contact_name && (
                            <p className="text-sm text-gray-400 truncate">{supplier.contact_name}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <Link
                          href={`/suppliers/${supplier.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <motion.button
                            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                            title="Edit"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Edit className="h-4 w-4" />
                          </motion.button>
                        </Link>
                        <motion.button
                          onClick={(e) => handleDeleteSupplier(supplier.id, supplier.name, e)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          disabled={deletingId === supplier.id}
                        >
                          {deletingId === supplier.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </motion.button>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 mb-4">
                      {supplier.email && (
                        <div className="flex items-center space-x-2 text-sm text-gray-300 min-w-0">
                          <Mail className="h-4 w-4 text-gray-500 shrink-0" />
                          <span className="truncate min-w-0">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center space-x-2 text-sm text-gray-300 min-w-0">
                          <Phone className="h-4 w-4 text-gray-500 shrink-0" />
                          <span className="truncate min-w-0">{supplier.phone}</span>
                        </div>
                      )}
                      {(supplier.city || supplier.full_address) && (
                        <div className="flex items-center space-x-2 text-sm text-gray-300 min-w-0">
                          <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
                          <span className="truncate min-w-0">{supplier.city || supplier.full_address}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                          <Package className="h-3 w-3" />
                          <span>Orders</span>
                        </div>
                        <div className="text-lg font-semibold text-gray-200">
                          {supplier.total_orders || 0}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                          <DollarSign className="h-3 w-3" />
                          <span>Total Spent</span>
                        </div>
                        <div className="text-lg font-semibold text-green-400">
                          {formatCurrency(supplier.total_spent || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {supplier.tags && supplier.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1 min-w-0">
                        {supplier.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs rounded-full bg-purple-900/30 text-purple-400 border border-purple-500/30 max-w-full truncate"
                          >
                            {tag}
                          </span>
                        ))}
                        {supplier.tags.length > 3 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-400">
                            +{supplier.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
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
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
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

      {/* Summary Stats */}
      {suppliers.length > 0 && (
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="font-semibold text-gray-100 mb-4">Supplier Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Suppliers', value: totalSuppliers },
              { label: 'Total Spent', value: formatCurrency(totalSpent) },
              { label: 'Total Orders', value: totalOrders },
              { label: 'Avg Order Value', value: formatCurrency(avgOrderValue) },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <motion.p
                  className="text-2xl font-bold text-gray-100"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, type: 'spring', stiffness: 300 }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
