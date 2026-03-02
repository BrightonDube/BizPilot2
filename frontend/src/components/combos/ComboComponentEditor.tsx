/**
 * Combo component editor.
 *
 * Manages the components within a combo deal — each component is
 * either a fixed product or a customer-choice slot.  Provides
 * inline CRUD for adding/editing/removing components.
 *
 * Why inline editing instead of a modal?
 * Components are visual building blocks of a combo.  Seeing them
 * in a list while editing gives the manager spatial context about
 * how the combo will look to customers.
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
  Box,
  List,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import {
  comboApi,
  ComboDeal,
  ComboComponent,
  CreateComboComponentPayload,
  UpdateComboComponentPayload,
} from '@/lib/modifier-api'

// ---------------------------------------------------------------------------
// Component form
// ---------------------------------------------------------------------------

interface ComponentFormProps {
  initial?: ComboComponent | null
  onSave: (data: CreateComboComponentPayload | UpdateComboComponentPayload) => Promise<void>
  onCancel: () => void
  isSaving: boolean
}

function ComponentForm({ initial, onSave, onCancel, isSaving }: ComponentFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [componentType, setComponentType] = useState<'fixed' | 'choice'>(
    initial?.component_type ?? 'fixed',
  )
  const [fixedProductId, setFixedProductId] = useState(initial?.fixed_product_id ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0)
  const [allowModifiers, setAllowModifiers] = useState(initial?.allow_modifiers ?? true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      component_type: componentType,
      fixed_product_id: componentType === 'fixed' && fixedProductId ? fixedProductId : null,
      quantity,
      sort_order: sortOrder,
      allow_modifiers: allowModifiers,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Component Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Burger, Side, Drink"
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
          <select
            value={componentType}
            onChange={(e) => setComponentType(e.target.value as 'fixed' | 'choice')}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm"
          >
            <option value="fixed">Fixed product</option>
            <option value="choice">Customer choice</option>
          </select>
        </div>

        {/* Fixed product ID (shown only for fixed type) */}
        {componentType === 'fixed' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Product ID *</label>
            <Input
              value={fixedProductId}
              onChange={(e) => setFixedProductId(e.target.value)}
              placeholder="UUID of the product"
              required
              className="bg-gray-800 border-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              Paste the product UUID from the Products page.
            </p>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Quantity</label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Sort order */}
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

      {/* Allow modifiers */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="allow-modifiers"
          checked={allowModifiers}
          onChange={(e) => setAllowModifiers(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        <label htmlFor="allow-modifiers" className="text-sm text-gray-300">
          Allow modifiers on this component
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {initial ? 'Update Component' : 'Add Component'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ComboComponentEditorProps {
  comboDeal: ComboDeal
  onBack: () => void
}

export function ComboComponentEditor({ comboDeal, onBack }: ComboComponentEditorProps) {
  const [components, setComponents] = useState<ComboComponent[]>(comboDeal.components)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingComponent, setEditingComponent] = useState<ComboComponent | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const refreshComponents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await comboApi.listComponents(comboDeal.id)
      setComponents(data)
    } catch {
      setError('Failed to refresh components')
    } finally {
      setLoading(false)
    }
  }, [comboDeal.id])

  const handleSave = async (
    payload: CreateComboComponentPayload | UpdateComboComponentPayload,
  ) => {
    setIsSaving(true)
    try {
      if (editingComponent) {
        await comboApi.updateComponent(editingComponent.id, payload)
      } else {
        await comboApi.addComponent(comboDeal.id, payload as CreateComboComponentPayload)
      }
      setShowForm(false)
      setEditingComponent(null)
      await refreshComponents()
    } catch {
      setError(editingComponent ? 'Failed to update component' : 'Failed to add component')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (componentId: string, componentName: string) => {
    if (!window.confirm(`Remove component "${componentName}" from this combo?`)) return
    try {
      setDeletingId(componentId)
      await comboApi.deleteComponent(componentId)
      setComponents(components.filter((c) => c.id !== componentId))
    } catch {
      setError('Failed to delete component')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{comboDeal.display_name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure the components that make up this combo deal
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingComponent(null)
            setShowForm(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Component
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
            {editingComponent ? 'Edit Component' : 'Add Component'}
          </h2>
          <ComponentForm
            initial={editingComponent}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false)
              setEditingComponent(null)
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
      {!loading && components.length === 0 && (
        <div className="text-center py-12">
          <List className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No components yet</h3>
          <p className="text-gray-500 text-sm mt-1">
            Add components like &quot;Main&quot;, &quot;Side&quot;, &quot;Drink&quot; to build the combo.
          </p>
        </div>
      )}

      {/* Component list */}
      {!loading && components.length > 0 && (
        <div className="space-y-3">
          {components.map((comp, index) => (
            <div
              key={comp.id}
              className="flex items-center gap-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
            >
              {/* Order number */}
              <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg text-sm font-mono text-gray-400">
                {index + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-medium">{comp.name}</h4>
                  <Badge variant={comp.component_type === 'fixed' ? 'default' : 'success'}>
                    {comp.component_type === 'fixed' ? (
                      <>
                        <Box className="h-3 w-3 mr-1" />
                        Fixed
                      </>
                    ) : (
                      <>
                        <List className="h-3 w-3 mr-1" />
                        Choice
                      </>
                    )}
                  </Badge>
                  {comp.quantity > 1 && (
                    <Badge variant="default">×{comp.quantity}</Badge>
                  )}
                  {comp.allow_modifiers && (
                    <Badge variant="default">Modifiers OK</Badge>
                  )}
                </div>
                {comp.fixed_product_id && (
                  <p className="text-gray-500 text-xs mt-1 font-mono truncate">
                    Product: {comp.fixed_product_id}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditingComponent(comp)
                    setShowForm(true)
                  }}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit component"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(comp.id, comp.name)}
                  disabled={deletingId === comp.id}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Remove component"
                >
                  {deletingId === comp.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
