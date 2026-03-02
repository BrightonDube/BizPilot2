/**
 * Modifier Group list and management component.
 *
 * Provides a full CRUD interface for modifier groups with inline
 * creation/editing via a slide-over form panel.  Follows the same
 * patterns as ProductList.tsx (pagination, search, loading skeletons).
 *
 * Why inline forms instead of separate pages?
 * Modifier groups are lightweight objects (name + a few settings).
 * Navigating to a separate page would feel heavy.  Inline editing
 * keeps the workflow fast for restaurant managers configuring menus.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Settings2,
  ChevronRight,
  X,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import { modifierApi, ModifierGroup, CreateModifierGroupPayload, UpdateModifierGroupPayload } from '@/lib/modifier-api'
import { ModifierManagement } from './ModifierManagement'

// ---------------------------------------------------------------------------
// Skeleton loader for the group cards
// ---------------------------------------------------------------------------

function GroupCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-2/3 mb-3" />
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-2" />
      <div className="h-4 bg-gray-700 rounded w-1/2" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create / Edit form
// ---------------------------------------------------------------------------

interface GroupFormProps {
  initial?: ModifierGroup | null
  onSave: (data: CreateModifierGroupPayload | UpdateModifierGroupPayload) => Promise<void>
  onCancel: () => void
  isSaving: boolean
}

function GroupForm({ initial, onSave, onCancel, isSaving }: GroupFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [selectionType, setSelectionType] = useState(initial?.selection_type ?? 'single')
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false)
  const [minSelections, setMinSelections] = useState(initial?.min_selections ?? 0)
  const [maxSelections, setMaxSelections] = useState<number | ''>(initial?.max_selections ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      selection_type: selectionType,
      is_required: isRequired,
      min_selections: minSelections,
      max_selections: maxSelections === '' ? null : maxSelections,
      description: description || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Toppings, Sides, Sauces"
          required
          className="bg-gray-800 border-gray-700"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="bg-gray-800 border-gray-700"
        />
      </div>

      {/* Selection Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Selection Type</label>
        <select
          value={selectionType}
          onChange={(e) => setSelectionType(e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm"
        >
          <option value="single">Single (pick one)</option>
          <option value="multiple">Multiple (pick many)</option>
        </select>
      </div>

      {/* Required toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="is-required"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        <label htmlFor="is-required" className="text-sm text-gray-300">
          Required (customer must select)
        </label>
      </div>

      {/* Min / Max selections */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Min Selections</label>
          <Input
            type="number"
            min={0}
            value={minSelections}
            onChange={(e) => setMinSelections(parseInt(e.target.value) || 0)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Max Selections</label>
          <Input
            type="number"
            min={1}
            value={maxSelections}
            onChange={(e) => setMaxSelections(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="Unlimited"
            className="bg-gray-800 border-gray-700"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {initial ? 'Update Group' : 'Create Group'}
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

export function ModifierGroupList() {
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Drill-down: managing modifiers within a group
  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(null)

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await modifierApi.listGroups()
      setGroups(data)
    } catch {
      setError('Failed to load modifier groups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleSave = async (payload: CreateModifierGroupPayload | UpdateModifierGroupPayload) => {
    setIsSaving(true)
    try {
      if (editingGroup) {
        await modifierApi.updateGroup(editingGroup.id, payload)
      } else {
        await modifierApi.createGroup(payload as CreateModifierGroupPayload)
      }
      setShowForm(false)
      setEditingGroup(null)
      await fetchGroups()
    } catch {
      setError(editingGroup ? 'Failed to update group' : 'Failed to create group')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Delete modifier group "${groupName}"? This cannot be undone.`)) return
    try {
      setDeletingId(groupId)
      await modifierApi.deleteGroup(groupId)
      setGroups(groups.filter((g) => g.id !== groupId))
    } catch {
      setError('Failed to delete group')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  )

  // If a group is selected, show the modifier management view
  if (selectedGroup) {
    return (
      <ModifierManagement
        group={selectedGroup}
        onBack={() => {
          setSelectedGroup(null)
          fetchGroups()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Modifier Groups</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure add-on options for your products (toppings, sizes, extras)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingGroup(null)
            setShowForm(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search modifier groups..."
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

      {/* Create / Edit form panel */}
      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingGroup ? 'Edit Modifier Group' : 'Create Modifier Group'}
          </h2>
          <GroupForm
            initial={editingGroup}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false)
              setEditingGroup(null)
            }}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <Settings2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No modifier groups yet</h3>
          <p className="text-gray-500 text-sm mt-1">
            Create your first modifier group to start adding options to products.
          </p>
        </div>
      )}

      {/* Group cards */}
      {!loading && filteredGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{group.name}</h3>
                  {group.description && (
                    <p className="text-gray-400 text-sm mt-1 truncate">{group.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => {
                      setEditingGroup(group)
                      setShowForm(true)
                    }}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit group"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id, group.name)}
                    disabled={deletingId === group.id}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete group"
                  >
                    {deletingId === group.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant={group.is_required ? 'danger' : 'default'}>
                  {group.is_required ? 'Required' : 'Optional'}
                </Badge>
                <Badge variant="default">
                  {group.selection_type === 'single' ? 'Pick One' : 'Pick Many'}
                </Badge>
                <Badge variant="default">
                  {group.modifiers.length} option{group.modifiers.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Drill-down button */}
              <button
                onClick={() => setSelectedGroup(group)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <span>Manage Modifiers</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
