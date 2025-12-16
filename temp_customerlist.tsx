import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  Users,
  UserX,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingCart
} from 'lucide-react'
import { useCustomers } from '../../hooks/useCustomers'
import { useBusiness } from '../../hooks/useBusiness'
import { useCurrency } from '../../hooks/useCurrency'
import type { Customer } from '../../types/orders'
import { CustomerListSkeleton } from '../ui/skeleton'

export function CustomerList() {
  const navigate = useNavigate()
  const { business } = useBusiness()
  const { format: formatCurrency } = useCurrency()
  const { customers, loading, error, deleteCustomer, refreshCustomers } = useCustomers()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'business'>('all')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [timeoutError, setTimeoutError] = useState(false)

  const { userRole, hasPermission } = useBusiness()
  
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'total_spent' | 'total_orders' | 'recent'>('name')
  
  // Check permissions
  const canCreate = hasPermission('customers', 'create') || userRole === 'admin' || userRole === 'manager'
  const canEdit = hasPermission('customers', 'update') || userRole === 'admin' || userRole === 'manager'
  const canDelete = hasPermission('customers', 'delete') || userRole === 'admin'

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.phone?.toLowerCase().includes(term) ||
        customer.company?.toLowerCase().includes(term)
      )
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'total_spent':
          return b.total_spent - a.total_spent
        case 'total_orders':
          return b.total_orders - a.total_orders
        case 'recent':
          return new Date(b.last_order_date || 0).getTime() - new Date(a.last_order_date || 0).getTime()
        default:
          return 0
      }
    })

    return sorted
  }, [customers, searchTerm, sortBy])

  const handleCreateCustomer = () => {
    navigate('/customers/new')
  }

  const handleViewCustomer = (id: string) => {
    navigate(`/customers/${id}`)
  }

  const handleEditCustomer = (id: string) => {
    navigate(`/customers/edit/${id}`)
  }

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete customer "${name}"? This action cannot be undone.`)) {
      try {
        await deleteCustomer(id)
      } catch (err) {
        console.error('Failed to delete customer:', err)
        alert('Failed to delete customer. Please try again.')
      }
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatAddress = (address: any) => {
    if (!address) return null
    if (typeof address === 'string') return address
    
    const parts = [
      address.city,
      address.state,
      address.country
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join(', ') : null
  }

  // Show skeleton while loading
  if (loading && customers.length === 0) {
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
        <CustomerListSkeleton items={5} />
      </motion.div>
    )
  }

  if (error || timeoutError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card bg-red-900/20 border-red-500/30"
      >
        <div className="text-red-400 text-center py-8">
          <UserX className="h-12 w-12 mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-2">Unable to load customers</h3>
          <p className="text-sm mb-4">{error || 'Connection timeout. Please check your internet connection.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Customers</h1>
          <p className="text-gray-400 mt-1">Manage your customer database</p>
        </div>
        {canCreate && (
          <motion.button
            onClick={handleCreateCustomer}
            className="btn-primary flex items-center space-x-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-5 w-5" />
            <span>Add Customer</span>
          </motion.button>
        )}
      </div>

      {/* Search and Sort */}
      <div className="card">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Sort and Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm text-gray-400">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input-field py-2"
              >
                <option value="name">Name (A-Z)</option>
                <option value="total_spent">Total Spent</option>
                <option value="total_orders">Total Orders</option>
                <option value="recent">Recent Activity</option>
              </select>
            </div>

            <div className="text-sm text-gray-400">
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
            </div>
          </div>
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-12 card">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300">No customers found</h3>
            <p className="text-gray-400 mt-2">
              {searchTerm
                ? 'Try adjusting your search'
                : 'Add your first customer to get started'}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <motion.div
              key={customer.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewCustomer(customer.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
            >
              {/* Customer Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-100 mb-1">
                    {customer.name}
                  </h3>
                  {customer.company && (
                    <div className="flex items-center space-x-1 text-sm text-gray-400">
                      <Building2 className="h-3 w-3" />
                      <span>{customer.company}</span>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <button
                      onClick={() => handleEditCustomer(customer.id)}
                      className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                {customer.email && (
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {formatAddress(customer.address) && (
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="truncate">{formatAddress(customer.address)}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-700">
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
                <div className="mt-3 pt-3 border-t border-dark-700">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>Last order: {formatDate(customer.last_order_date)}</span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {customer.tags && customer.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {customer.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 text-xs rounded-full bg-primary-900/30 text-primary-400 border border-primary-500/30"
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
            </motion.div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {filteredCustomers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-sm text-gray-400">Total Customers</div>
            <div className="text-2xl font-bold text-gray-100 mt-1">
              {filteredCustomers.length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Total Revenue</div>
            <div className="text-2xl font-bold text-green-400 mt-1">
              {formatCurrency(filteredCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0))}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Total Orders</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {filteredCustomers.reduce((sum, c) => sum + (c.total_orders || 0), 0)}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Avg Order Value</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {formatCurrency(
                filteredCustomers.reduce((sum, c) => sum + (c.average_order_value || 0), 0) / 
                filteredCustomers.length || 0
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
