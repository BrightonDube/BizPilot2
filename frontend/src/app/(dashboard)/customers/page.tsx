'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Building2, 
  User,
  Users,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertTriangle,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  LayoutGrid,
  List
} from 'lucide-react'
import { Button, Input, Select, Card, CardContent } from '@/components/ui'
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
  orange: {
    container: 'bg-orange-500/20 border-orange-500/30',
    icon: 'text-orange-400',
  },
  red: {
    container: 'bg-red-500/20 border-red-500/30',
    icon: 'text-red-400',
  },
}

interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company_name: string | null
  customer_type: string
  total_orders?: number
  total_spent?: number
  tags?: string[]
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  last_order_date?: string
}

interface CustomerListResponse {
  items: Customer[]
  total: number
  page: number
  per_page: number
  pages: number
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function CustomerCardSkeleton() {
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'total_spent' | 'total_orders' | 'recent'>('name')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCustomers() {
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
        
        if (selectedType !== 'all') {
          params.append('customer_type', selectedType)
        }

        if (sortBy === 'name') {
          params.append('sort_by', 'first_name')
          params.append('sort_order', 'asc')
        }
        if (sortBy === 'total_spent') {
          params.append('sort_by', 'total_spent')
          params.append('sort_order', 'desc')
        }
        if (sortBy === 'total_orders') {
          params.append('sort_by', 'total_orders')
          params.append('sort_order', 'desc')
        }
        if (sortBy === 'recent') {
          params.append('sort_by', 'updated_at')
          params.append('sort_order', 'desc')
        }
        
        const response = await apiClient.get<CustomerListResponse>(`/customers?${params}`)
        setCustomers(response.data.items)
        setTotal(response.data.total)
        setPages(response.data.pages)
      } catch (err) {
        console.error('Failed to fetch customers:', err)
        setError('Failed to load customers')
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(timeoutId)
  }, [page, searchTerm, selectedType, sortBy])

  const handleDeleteCustomer = async (customerId: string, customerName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!window.confirm(`Are you sure you want to delete "${customerName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(customerId)
      await apiClient.delete(`/customers/${customerId}`)
      setCustomers(customers.filter(c => c.id !== customerId))
    } catch (err) {
      console.error('Failed to delete customer:', err)
      setError('Failed to delete customer')
    } finally {
      setDeletingId(null)
    }
  }

  const totalCustomers = total
  const totalRevenue = customers.reduce((sum, c) => sum + toNumber(c.total_spent, 0), 0)
  const businessCustomers = customers.filter(c => c.customer_type === 'business').length
  const totalOrders = customers.reduce((sum, c) => sum + toNumber(c.total_orders, 0), 0)
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Loading state with skeletons
  if (isLoading && customers.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Customers</h1>
            <p className="text-gray-400">Manage your customer database</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <CustomerCardSkeleton key={i} />
          ))}
        </div>
      </motion.div>
    )
  }

  // Error state
  if (error && customers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center"
      >
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-medium text-lg mb-2 text-white">Unable to load customers</h3>
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
          <h1 className="text-2xl font-bold text-gray-100">Customers</h1>
          <p className="text-gray-400">Manage your customer database ({totalCustomers} customers)</p>
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

          <Link href="/customers/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Customers', value: totalCustomers, color: 'blue' },
          { icon: DollarSign, label: 'Total Revenue', value: formatCurrency(totalRevenue), color: 'green' },
          { icon: Building2, label: 'Business', value: businessCustomers, color: 'purple' },
          { icon: ShoppingCart, label: 'Avg Order Value', value: formatCurrency(avgOrderValue), color: 'yellow' }
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

      {/* Search and Filters */}
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
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-10 bg-gray-900/50 border-gray-600"
            />
          </div>
          <Select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value)
              setPage(1)
            }}
            className="w-auto"
          >
            <option value="all">All Types</option>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-auto"
          >
            <option value="name">Name (A-Z)</option>
            <option value="total_spent">Total Spent</option>
            <option value="total_orders">Total Orders</option>
            <option value="recent">Recent Activity</option>
          </Select>
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

      {/* Customers Grid */}
      {customers.length === 0 ? (
        <motion.div 
          className="text-center py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {searchTerm ? 'No customers found' : 'No customers yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Add your first customer to get started'
            }
          </p>
          {!searchTerm && (
            <Link href="/customers/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Customer
              </Button>
            </Link>
          )}
        </motion.div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {customers.map((customer, index) => {
            const customerName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()

            return (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.02 }}
              >
                <Link href={`/customers/${customer.id}`} className="block">
                  <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              customer.customer_type === 'business'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {customer.customer_type === 'business' ? (
                              <Building2 className="w-5 h-5" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="text-sm sm:text-base font-semibold text-gray-100 truncate">
                                {customerName || 'Unnamed Customer'}
                              </h3>
                              <span className="text-xs text-gray-500 shrink-0">
                                {customer.customer_type === 'business' ? 'Business' : 'Individual'}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300 min-w-0">
                              {customer.email && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <Mail className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                  <span className="truncate">{customer.email}</span>
                                </div>
                              )}
                              {customer.phone && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <Phone className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                  <span className="truncate">{customer.phone}</span>
                                </div>
                              )}
                              {customer.city && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                  <span className="truncate">
                                    {customer.city}
                                    {customer.country ? `, ${customer.country}` : ''}
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
                              <div className="font-semibold">{customer.total_orders || 0}</div>
                            </div>
                            <div className="text-gray-300">
                              <div className="text-xs text-gray-500">Spent</div>
                              <div className="font-semibold text-green-400">
                                {formatCurrency(customer.total_spent || 0)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <motion.button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.location.href = `/customers/${customer.id}/edit`;
                              }}
                              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Edit"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Edit className="h-4 w-4" />
                            </motion.button>
                            <motion.button
                              onClick={(e) => handleDeleteCustomer(customer.id, customerName, e)}
                              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                              disabled={deletingId === customer.id}
                            >
                              {deletingId === customer.id ? (
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
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer, index) => {
            const customerName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            
            return (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <Link href={`/customers/${customer.id}`}>
                  <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all cursor-pointer h-full overflow-hidden">
                    <CardContent className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                            customer.customer_type === 'business' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {customer.customer_type === 'business' ? (
                              <Building2 className="w-6 h-6" />
                            ) : (
                              <User className="w-6 h-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-gray-100 truncate">
                              {customerName || 'Unnamed Customer'}
                            </h3>
                            {customer.company_name && customer.first_name && (
                              <p className="text-sm text-gray-400 truncate">
                                {customer.first_name} {customer.last_name}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <Link
                            href={`/customers/${customer.id}/edit`}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
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
                            onClick={(e) => handleDeleteCustomer(customer.id, customerName, e)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            disabled={deletingId === customer.id}
                          >
                            {deletingId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </motion.button>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-2 mb-4">
                        {customer.email && (
                          <div className="flex items-center space-x-2 text-sm text-gray-300 min-w-0">
                            <Mail className="h-4 w-4 text-gray-500 shrink-0" />
                            <span className="truncate min-w-0">{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center space-x-2 text-sm text-gray-300 min-w-0">
                            <Phone className="h-4 w-4 text-gray-500 shrink-0" />
                            <span className="truncate min-w-0">{customer.phone}</span>
                          </div>
                        )}
                        {customer.city && (
                          <div className="flex items-center space-x-2 text-sm text-gray-300 min-w-0">
                            <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
                            <span className="truncate min-w-0">{customer.city}{customer.country ? `, ${customer.country}` : ''}</span>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                        <div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                            <ShoppingCart className="h-3 w-3" />
                            <span>Orders</span>
                          </div>
                          <div className="text-lg font-semibold text-gray-200">
                            {customer.total_orders || 0}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                            <DollarSign className="h-3 w-3" />
                            <span>Total Spent</span>
                          </div>
                          <div className="text-lg font-semibold text-green-400">
                            {formatCurrency(customer.total_spent || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Last Order */}
                      {customer.last_order_date && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>Last order: {formatDate(customer.last_order_date)}</span>
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {customer.tags && customer.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1 min-w-0">
                          {customer.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/30 max-w-full truncate"
                            >
                              {tag}
                            </span>
                          ))}
                          {customer.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-400">
                              +{customer.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
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
            Page {page} of {pages} ({total} customers)
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      {customers.length > 0 && (
        <motion.div 
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="font-semibold text-gray-100 mb-4">Customer Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Customers', value: totalCustomers },
              { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
              { label: 'Total Orders', value: totalOrders },
              { label: 'Avg Order Value', value: formatCurrency(avgOrderValue) }
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
                  transition={{ delay: 0.8 + index * 0.1, type: "spring", stiffness: 300 }}
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
