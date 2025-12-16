import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Download, Upload, Grid, List, Loader2, Search, AlertTriangle, Edit, Trash2 } from 'lucide-react'
import { useInventory } from '../../hooks/useInventory'
import { useBusiness } from '../../hooks/useBusiness'
import { InventoryTable } from './InventoryTable'
import { BulkInventoryImport } from './BulkInventoryImport'
import { BulkInventoryExport } from './BulkInventoryExport'
import { ManualNumberInput } from '../ui/manual-number-input'
import { formatCurrency } from '../../utils/calculations'




export function InventoryList() {
  const { deleteInventoryItem } = useInventory()
  const { hasPermission, userRole } = useBusiness()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [formError, setFormError] = useState('')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showBulkExport, setShowBulkExport] = useState(false)

  // const canEdit = hasPermission('inventory', 'update') || userRole === 'admin' || userRole === 'manager'
  const canImportExport = userRole === 'admin' || userRole === 'manager' || hasPermission('inventory', 'read')

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the inventory item "${name}"? This cannot be undone.`)) {
      setFormError('')
      const { error } = await deleteInventoryItem(id)
      if (error) {
        setFormError(error)
      }
    }
  }



  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <h1 className="text-2xl font-bold text-gray-100">Inventory</h1>
          <p className="text-gray-400">Track and manage your stock levels.</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="flex items-center gap-3"
        >
          {/* View Mode Toggle */}
          <div className="flex items-center bg-dark-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              title="Card view"
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canImportExport && (
              <>
                <motion.button
                  onClick={() => setShowBulkImport(true)}
                  className="btn-secondary flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Import inventory from spreadsheet"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </motion.button>
                <motion.button
                  onClick={() => setShowBulkExport(true)}
                  className="btn-secondary flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Export inventory to spreadsheet"
                >
                  <Download className="h-4 w-4" />
                  Export
                </motion.button>
              </>
            )}
            
            <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Link to="/inventory/new" className="btn-primary group flex items-center">
            <motion.div
              whileHover={{ rotate: 90 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Plus className="h-4 w-4 mr-2" />
            </motion.div>
          Add Item
          </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Error Display */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >

        {formError && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
            {formError}
          </div>
        )}
                </motion.div>

      {/* Content */}
      {viewMode === 'table' ? (
        <InventoryTable
          onDelete={handleDeleteItem}
        />
      ) : (
        <InventoryCards
          onEdit={(item) => {
            window.location.href = `/inventory/edit/${item.id}`
          }}
          onDelete={handleDeleteItem}
        />
      )}

      {/* Bulk Import/Export Modals */}
      <AnimatePresence>
        {showBulkImport && (
          <BulkInventoryImport onClose={() => setShowBulkImport(false)} />
        )}
        {showBulkExport && (
          <BulkInventoryExport onClose={() => setShowBulkExport(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Legacy card view component
function InventoryCards({ onEdit, onDelete }: { 
  onEdit: (item: any) => void
  onDelete: (id: string, name: string) => void 
}) {
  const { inventory, adjustStock } = useInventory()
  const [searchTerm, setSearchTerm] = useState('')
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0)
  const [adjustNotes, setAdjustNotes] = useState<string>('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.batch_lot_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.unit.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdjustClick = (item: any) => {
    setAdjustingItemId(item.id)
    setAdjustQuantity(0)
    setAdjustNotes('')
    setFormError('')
  }

  const handleAdjustSubmit = async (e: React.FormEvent, itemId: string) => {
    e.preventDefault()
    setFormError('')
    if (adjustQuantity === 0) {
      setFormError('Quantity change cannot be zero.')
      return
    }
    setSubmitLoading(true)
    const { error } = await adjustStock(itemId, adjustQuantity, adjustNotes)
    if (error) {
      setFormError(error)
    } else {
      setAdjustingItemId(null)
    }
    setSubmitLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500" />
        <input
          type="text"
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Error Display */}
      {formError && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInventory.map((item) => (
            <motion.div 
              key={item.id} 
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-100 mb-1">
                    {item.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Current Stock: {item.current_quantity} {item.unit}
                  </p>
                  {item.low_stock_alert !== null && item.current_quantity <= item.low_stock_alert && (
                    <p className="text-xs text-red-400 flex items-center mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Low Stock Alert! ({item.low_stock_alert} {item.unit})
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAdjustClick(item)}
                    className="text-primary-400 hover:text-primary-300"
                    title="Adjust stock"
                    >
                      <Plus className="h-4 w-4" />
                  </button>
                <button
                  onClick={() => onEdit(item)}
                      className="text-primary-400 hover:text-primary-300"
                      title="Edit item"
                    >
                      <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(item.id, item.name)}
                    className="text-red-400 hover:text-red-300"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                </button>
              </div>
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                {item.cost_per_unit !== null && (
                  <p>Cost per unit: {formatCurrency(item.cost_per_unit)}</p>
                )}
                {item.batch_lot_number && <p>Batch/Lot: {item.batch_lot_number}</p>}
                {item.expiration_date && <p>Expires: {new Date(item.expiration_date).toLocaleDateString()}</p>}
              </div>

              {adjustingItemId === item.id && (
                <motion.form 
                  onSubmit={(e) => handleAdjustSubmit(e, item.id)} 
                  className="mt-4 space-y-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex gap-2">
                  <ManualNumberInput
                    step={0.01}
                    value={adjustQuantity === 0 ? '' : adjustQuantity.toString()}
                    onChange={(value) => setAdjustQuantity(parseFloat(value) || 0)}
                      placeholder="Quantity Change (+/-)"
                      className="input-field flex-grow text-sm"
                      disabled={submitLoading}
                    />
                  <button
                      type="submit"
                      className="btn-primary group flex items-center text-sm px-3 py-1.5"
                      disabled={submitLoading}
                    >
                      {submitLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Apply
                  </button>
                  <button
                      type="button"
                      onClick={() => setAdjustingItemId(null)}
                      className="btn-secondary text-sm px-3 py-1.5"
                      disabled={submitLoading}
                    >
                      Cancel
                  </button>
                  </div>
                <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="input-field text-sm"
                    disabled={submitLoading}
                  />
                </motion.form>
              )}
            </motion.div>
          ))}
        </div>
    </div>
  )
}