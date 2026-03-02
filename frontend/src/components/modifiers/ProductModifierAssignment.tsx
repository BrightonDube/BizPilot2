/**
 * Product ↔ Modifier Group assignment component.
 *
 * Allows assigning existing modifier groups to a product and
 * removing assignments.  Used on product detail/edit pages.
 *
 * Why a standalone component instead of inline in the product page?
 * The assignment logic (list groups, assign, reorder) is reusable
 * across products and will be needed in the combo component editor
 * too.  Keeping it separate avoids duplication.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  X,
  Link2,
  Settings2,
} from 'lucide-react'

import { Badge, Button } from '@/components/ui'
import {
  modifierApi,
  ModifierGroup,
} from '@/lib/modifier-api'

interface ProductModifierAssignmentProps {
  productId: string
}

export function ProductModifierAssignment({ productId }: ProductModifierAssignmentProps) {
  const [assignedGroups, setAssignedGroups] = useState<ModifierGroup[]>([])
  const [allGroups, setAllGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [assigned, all] = await Promise.all([
        modifierApi.getProductModifiers(productId),
        modifierApi.listGroups(),
      ])
      setAssignedGroups(assigned)
      setAllGroups(all)
    } catch {
      setError('Failed to load modifier assignments')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const assignedIds = new Set(assignedGroups.map((g) => g.id))
  const unassignedGroups = allGroups.filter((g) => !assignedIds.has(g.id))

  const handleAssign = async (groupId: string) => {
    try {
      setAssigningId(groupId)
      await modifierApi.assignGroupToProduct(productId, groupId, assignedGroups.length)
      await fetchData()
      // Close picker if all groups are now assigned
      if (unassignedGroups.length <= 1) {
        setShowAssignPicker(false)
      }
    } catch {
      setError('Failed to assign modifier group')
    } finally {
      setAssigningId(null)
    }
  }

  const handleRemove = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Remove "${groupName}" from this product?`)) return
    try {
      setRemovingId(groupId)
      await modifierApi.removeGroupFromProduct(productId, groupId)
      setAssignedGroups(assignedGroups.filter((g) => g.id !== groupId))
    } catch {
      setError('Failed to remove modifier group')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Modifier Groups</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAssignPicker(!showAssignPicker)}
          disabled={unassignedGroups.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Assign Group
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Assign picker */}
      {showAssignPicker && unassignedGroups.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-3">Select a modifier group to assign:</p>
          <div className="space-y-2">
            {unassignedGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleAssign(group.id)}
                disabled={assigningId === group.id}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <span>{group.name}</span>
                  <Badge variant="default">
                    {group.modifiers.length} option{group.modifiers.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {assigningId === group.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assigned groups list */}
      {!loading && assignedGroups.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">
          <Settings2 className="h-8 w-8 mx-auto mb-2 text-gray-600" />
          <p>No modifier groups assigned to this product.</p>
        </div>
      )}

      {!loading && assignedGroups.length > 0 && (
        <div className="space-y-2">
          {assignedGroups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <div>
                <p className="text-white font-medium text-sm">{group.name}</p>
                <div className="flex gap-2 mt-1">
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
              </div>
              <button
                onClick={() => handleRemove(group.id, group.name)}
                disabled={removingId === group.id}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                title="Remove assignment"
              >
                {removingId === group.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
