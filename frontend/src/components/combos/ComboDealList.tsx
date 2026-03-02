/**
 * Combo Deal list and management component.
 *
 * Full CRUD for combo deals with inline creation and savings display.
 * Follows the same card-grid pattern as ModifierGroupList.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  X,
  Package,
  ChevronRight,
  Tag,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import {
  comboApi,
  ComboDeal,
  CreateComboDealPayload,
  UpdateComboDealPayload,
} from '@/lib/modifier-api'
import { ComboComponentEditor } from './ComboComponentEditor'

// ---------------------------------------------------------------------------
// Currency formatter (South African Rand)
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function ComboCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-2/3 mb-3" />
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-2" />
      <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
      <div className="h-8 bg-gray-700 rounded w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Combo deal form
// ---------------------------------------------------------------------------

interface ComboFormProps {
  initial?: ComboDeal | null
  onSave: (data: CreateComboDealPayload | UpdateComboDealPayload) => Promise<void>
  onCancel: () => void
  isSaving: boolean
}

function ComboForm({ initial, onSave, onCancel, isSaving }: ComboFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [comboPrice, setComboPrice] = useState(initial?.combo_price ?? 0)
  const [originalPrice, setOriginalPrice] = useState(initial?.original_price ?? 0)
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')

  const savings = originalPrice - comboPrice

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      display_name: displayName,
      description: description || null,
      image_url: imageUrl || null,
      combo_price: comboPrice,
      original_price: originalPrice,
      is_active: isActive,
      start_date: startDate || null,
      end_date: endDate || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Internal name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Internal Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. burger-combo-01"
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Display name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Display Name *</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Classic Burger Combo"
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Image URL */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Image URL</label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Combo price */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Combo Price (R) *</label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={comboPrice}
            onChange={(e) => setComboPrice(parseFloat(e.target.value) || 0)}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Original price */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Original Price (R) *
          </label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={originalPrice}
            onChange={(e) => setOriginalPrice(parseFloat(e.target.value) || 0)}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Savings preview */}
        {savings > 0 && (
          <div className="md:col-span-2 bg-green-900/20 border border-green-800 rounded-lg p-3 text-green-300 text-sm">
            Customer saves {formatCurrency(savings)} ({((savings / originalPrice) * 100).toFixed(0)}
            % off)
          </div>
        )}

        {/* Dates */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="combo-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        <label htmlFor="combo-active" className="text-sm text-gray-300">
          Active (visible to customers)
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSaving || !name.trim() || !displayName.trim()}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {initial ? 'Update Deal' : 'Create Deal'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main list component
// ---------------------------------------------------------------------------

export function ComboDealList() {
  const [deals, setDeals] = useState<ComboDeal[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<ComboDeal | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Drill-down to component editor
  const [selectedDeal, setSelectedDeal] = useState<ComboDeal | null>(null)

  const perPage = 20

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await comboApi.listDeals({ page, per_page: perPage })
      setDeals(result.items)
      setTotal(result.total)
    } catch {
      setError('Failed to load combo deals')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const handleSave = async (payload: CreateComboDealPayload | UpdateComboDealPayload) => {
    setIsSaving(true)
    try {
      if (editingDeal) {
        await comboApi.updateDeal(editingDeal.id, payload as UpdateComboDealPayload)
      } else {
        await comboApi.createDeal(payload as CreateComboDealPayload)
      }
      setShowForm(false)
      setEditingDeal(null)
      await fetchDeals()
    } catch {
      setError(editingDeal ? 'Failed to update deal' : 'Failed to create deal')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (dealId: string, dealName: string) => {
    if (!window.confirm(`Delete combo deal "${dealName}"? This cannot be undone.`)) return
    try {
      setDeletingId(dealId)
      await comboApi.deleteDeal(dealId)
      setDeals(deals.filter((d) => d.id !== dealId))
    } catch {
      setError('Failed to delete deal')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredDeals = deals.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.display_name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalPages = Math.ceil(total / perPage)

  // If a deal is selected, show the component editor
  if (selectedDeal) {
    return (
      <ComboComponentEditor
        comboDeal={selectedDeal}
        onBack={() => {
          setSelectedDeal(null)
          fetchDeals()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Combo Deals</h1>
          <p className="text-gray-400 text-sm mt-1">
            Bundle products together at a discounted price
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingDeal(null)
            setShowForm(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Combo
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search combo deals..."
          className="pl-10 bg-gray-800 border-gray-700"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingDeal ? 'Edit Combo Deal' : 'Create Combo Deal'}
          </h2>
          <ComboForm
            initial={editingDeal}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false)
              setEditingDeal(null)
            }}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ComboCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredDeals.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No combo deals yet</h3>
          <p className="text-gray-500 text-sm mt-1">
            Create your first combo deal to bundle products at a discount.
          </p>
        </div>
      )}

      {/* Deal cards */}
      {!loading && filteredDeals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeals.map((deal) => {
            const savings = deal.original_price - deal.combo_price
            return (
              <div
                key={deal.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{deal.display_name}</h3>
                    {deal.description && (
                      <p className="text-gray-400 text-sm mt-1 truncate">{deal.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => {
                        setEditingDeal(deal)
                        setShowForm(true)
                      }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit deal"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(deal.id, deal.display_name)}
                      disabled={deletingId === deal.id}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete deal"
                    >
                      {deletingId === deal.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Pricing */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xl font-bold text-white">
                    {formatCurrency(deal.combo_price)}
                  </span>
                  {savings > 0 && (
                    <>
                      <span className="text-sm text-gray-500 line-through">
                        {formatCurrency(deal.original_price)}
                      </span>
                      <Badge variant="success">Save {formatCurrency(savings)}</Badge>
                    </>
                  )}
                </div>

                {/* Meta badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant={deal.is_active ? 'success' : 'warning'}>
                    {deal.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="default">
                    {deal.components.length} component{deal.components.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Drill-down */}
                <button
                  onClick={() => setSelectedDeal(deal)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <span>Manage Components</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
