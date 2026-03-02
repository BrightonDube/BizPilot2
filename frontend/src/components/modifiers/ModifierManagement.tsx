/**
 * Modifier management within a single group.
 *
 * Shows the list of modifier options (e.g. "Extra Cheese", "Bacon")
 * within a group, with inline create/edit forms and availability
 * management via the ModifierAvailabilityEditor.
 *
 * Why a separate component instead of expanding ModifierGroupList?
 * Modifier management is a "drill-down" view with different state
 * (individual modifier items, pricing, availability).  Keeping it
 * separate prevents the group list from becoming a 500+ line monster.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Clock,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import {
  modifierApi,
  ModifierGroup,
  Modifier,
  CreateModifierPayload,
  UpdateModifierPayload,
} from '@/lib/modifier-api'
import { ModifierAvailabilityEditor } from './ModifierAvailabilityEditor'

// ---------------------------------------------------------------------------
// Modifier form
// ---------------------------------------------------------------------------

interface ModifierFormProps {
  initial?: Modifier | null
  onSave: (data: CreateModifierPayload | UpdateModifierPayload) => Promise<void>
  onCancel: () => void
  isSaving: boolean
}

function ModifierForm({ initial, onSave, onCancel, isSaving }: ModifierFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [pricingType, setPricingType] = useState('fixed')
  const [priceAdjustment, setPriceAdjustment] = useState(initial?.price_adjustment ?? 0)
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false)
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      pricing_type: pricingType,
      price_adjustment: priceAdjustment,
      is_default: isDefault,
      sort_order: sortOrder,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Extra Cheese"
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Pricing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Pricing Type</label>
          <select
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm"
          >
            <option value="free">Free (no charge)</option>
            <option value="fixed">Fixed price</option>
            <option value="percentage">Percentage of item</option>
          </select>
        </div>

        {/* Price */}
        {pricingType !== 'free' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {pricingType === 'percentage' ? 'Percentage (%)' : 'Price (R)'}
            </label>
            <Input
              type="number"
              min={0}
              step={pricingType === 'percentage' ? 1 : 0.01}
              value={priceAdjustment}
              onChange={(e) => setPriceAdjustment(parseFloat(e.target.value) || 0)}
              className="bg-gray-800 border-gray-700"
            />
          </div>
        )}

        {/* Sort Order */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Sort Order</label>
          <Input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
      </div>

      {/* Default toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="is-default"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        <label htmlFor="is-default" className="text-sm text-gray-300">
          Pre-selected by default
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {initial ? 'Update' : 'Add Modifier'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Currency formatter (South African Rand)
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ModifierManagementProps {
  group: ModifierGroup
  onBack: () => void
}

export function ModifierManagement({ group, onBack }: ModifierManagementProps) {
  const [modifiers, setModifiers] = useState<Modifier[]>(group.modifiers)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Availability editor
  const [availabilityModifierId, setAvailabilityModifierId] = useState<string | null>(null)

  const refreshGroup = useCallback(async () => {
    try {
      setLoading(true)
      const refreshed = await modifierApi.getGroup(group.id)
      setModifiers(refreshed.modifiers)
    } catch {
      setError('Failed to refresh modifiers')
    } finally {
      setLoading(false)
    }
  }, [group.id])

  const handleSave = async (payload: CreateModifierPayload | UpdateModifierPayload) => {
    setIsSaving(true)
    try {
      if (editingModifier) {
        await modifierApi.updateModifier(editingModifier.id, payload)
      } else {
        await modifierApi.addModifier(group.id, payload as CreateModifierPayload)
      }
      setShowForm(false)
      setEditingModifier(null)
      await refreshGroup()
    } catch {
      setError(editingModifier ? 'Failed to update modifier' : 'Failed to add modifier')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (modifierId: string, modifierName: string) => {
    if (!window.confirm(`Delete modifier "${modifierName}"?`)) return
    try {
      setDeletingId(modifierId)
      await modifierApi.deleteModifier(modifierId)
      setModifiers(modifiers.filter((m) => m.id !== modifierId))
    } catch {
      setError('Failed to delete modifier')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleAvailability = async (modifier: Modifier) => {
    try {
      await modifierApi.updateModifier(modifier.id, {
        is_available: !modifier.is_available,
      })
      await refreshGroup()
    } catch {
      setError('Failed to toggle availability')
    }
  }

  // Show availability editor if selected
  if (availabilityModifierId) {
    const mod = modifiers.find((m) => m.id === availabilityModifierId)
    return (
      <ModifierAvailabilityEditor
        modifierId={availabilityModifierId}
        modifierName={mod?.name ?? 'Modifier'}
        onBack={() => setAvailabilityModifierId(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{group.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant={group.is_required ? 'danger' : 'default'}>
              {group.is_required ? 'Required' : 'Optional'}
            </Badge>
            <Badge variant="default">
              {group.selection_type === 'single' ? 'Pick One' : 'Pick Many'}
            </Badge>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingModifier(null)
            setShowForm(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Modifier
        </Button>
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
            {editingModifier ? 'Edit Modifier' : 'Add Modifier'}
          </h2>
          <ModifierForm
            initial={editingModifier}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false)
              setEditingModifier(null)
            }}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && modifiers.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No modifiers yet</h3>
          <p className="text-gray-500 text-sm mt-1">
            Add options like &quot;Extra Cheese&quot; or &quot;Large Size&quot;.
          </p>
        </div>
      )}

      {/* Modifier table */}
      {!loading && modifiers.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-left text-sm font-medium text-gray-400">Name</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Price</th>
                <th className="p-4 text-center text-sm font-medium text-gray-400">Default</th>
                <th className="p-4 text-center text-sm font-medium text-gray-400">Available</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modifiers.map((mod) => (
                <tr
                  key={mod.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4 text-white font-medium">{mod.name}</td>
                  <td className="p-4 text-gray-300">
                    {mod.price_adjustment > 0
                      ? `+ ${formatPrice(mod.price_adjustment)}`
                      : 'Free'}
                  </td>
                  <td className="p-4 text-center">
                    {mod.is_default && <Badge variant="success">Default</Badge>}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleAvailability(mod)}
                      className="text-gray-400 hover:text-white transition-colors"
                      title={mod.is_available ? 'Click to disable' : 'Click to enable'}
                    >
                      {mod.is_available ? (
                        <ToggleRight className="h-5 w-5 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setAvailabilityModifierId(mod.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Availability schedule"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingModifier(mod)
                          setShowForm(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mod.id, mod.name)}
                        disabled={deletingId === mod.id}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === mod.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
