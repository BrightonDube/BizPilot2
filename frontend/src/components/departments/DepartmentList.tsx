'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Edit,
  Trash2,
  Loader2,
  Building2,
  Users,
  AlertTriangle,
  Briefcase,
  BarChart3,
  Cog,
  DollarSign,
  Headphones,
  Megaphone,
  Code,
  Truck,
  ShoppingCart,
  Heart,
  Shield,
} from 'lucide-react'

import { Button, Card, CardContent, Badge } from '@/components/ui'
import type { Department } from '@/lib/types'

/**
 * Props for the DepartmentList component.
 */
interface DepartmentListProps {
  /** Array of departments to display */
  departments: Department[]
  /** Callback when edit button is clicked */
  onEdit: (department: Department) => void
  /** Callback when delete is confirmed, receives department ID */
  onDelete: (departmentId: string) => Promise<void>
  /** Whether the list is in a loading state */
  isLoading?: boolean
  /** ID of department currently being deleted */
  deletingId?: string | null
}

/**
 * Confirmation dialog for delete action.
 */
interface DeleteConfirmDialogProps {
  department: Department
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

function DeleteConfirmDialog({
  department,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const hasTeamMembers = department.team_member_count > 0

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Delete Department</h3>
        </div>

        {hasTeamMembers ? (
          <div className="mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-yellow-400 font-medium">Cannot delete department</p>
                  <p className="text-sm text-gray-300 mt-1">
                    This department has{' '}
                    <span className="font-semibold text-yellow-400">
                      {department.team_member_count} team member
                      {department.team_member_count !== 1 ? 's' : ''}
                    </span>{' '}
                    assigned. Please reassign or remove all team members before deleting.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Department: <span className="text-white font-medium">{department.name}</span>
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-gray-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">&quot;{department.name}&quot;</span>?
            </p>
            <p className="text-sm text-gray-400 mt-2">
              This action cannot be undone.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {hasTeamMembers ? 'Close' : 'Cancel'}
          </Button>
          {!hasTeamMembers && (
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Map of icon names to Lucide icon components.
 * These match the AVAILABLE_ICONS in DepartmentForm.
 */
const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  briefcase: Briefcase,
  'chart-bar': BarChart3,
  cog: Cog,
  'dollar-sign': DollarSign,
  headphones: Headphones,
  megaphone: Megaphone,
  code: Code,
  truck: Truck,
  'shopping-cart': ShoppingCart,
  heart: Heart,
  shield: Shield,
}

/**
 * Gets a Lucide icon component by name.
 * Falls back to Building2 if icon not found.
 */
function getDepartmentIcon(iconName: string | null): React.ElementType {
  if (!iconName) return Building2
  return ICON_MAP[iconName] || Building2
}

/**
 * Skeleton loader for department cards.
 */
function DepartmentCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="h-6 bg-gray-700 rounded w-24" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-700 rounded" />
          <div className="h-8 w-8 bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * DepartmentList component for displaying a list of departments.
 * 
 * Features:
 * - Display department cards with name, description, color, icon
 * - Show team member count for each department
 * - Edit and delete action buttons
 * - Confirmation dialog for delete with warning for departments in use
 * - Loading and empty states
 * 
 * Requirements: 1.1, 1.6, 7.2
 * 
 * @example
 * <DepartmentList
 *   departments={departments}
 *   onEdit={(dept) => setEditingDepartment(dept)}
 *   onDelete={(id) => deleteDepartment(id)}
 * />
 */
export function DepartmentList({
  departments,
  onEdit,
  onDelete,
  isLoading = false,
  deletingId = null,
}: DepartmentListProps) {
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  /**
   * Handles the delete confirmation.
   */
  const handleDeleteConfirm = async () => {
    if (!departmentToDelete) return

    try {
      setDeleteError(null)
      await onDelete(departmentToDelete.id)
      setDepartmentToDelete(null)
    } catch (error) {
      // Handle error - the error message should come from the API
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to delete department. Please try again.'
      setDeleteError(errorMessage)
    }
  }

  /**
   * Handles canceling the delete dialog.
   */
  const handleDeleteCancel = () => {
    setDepartmentToDelete(null)
    setDeleteError(null)
  }

  // Loading state
  if (isLoading && departments.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <DepartmentCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Empty state
  if (departments.length === 0) {
    return (
      <motion.div
        className="text-center py-12"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Building2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">No departments yet</h3>
        <p className="text-gray-400">
          Create your first department to organize your team.
        </p>
      </motion.div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((department, index) => {
          const IconComponent = getDepartmentIcon(department.icon)
          const isDeleting = deletingId === department.id

          return (
            <motion.div
              key={department.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all h-full">
                <CardContent className="p-6">
                  {/* Header with icon and name */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: department.color
                          ? `${department.color}20`
                          : 'rgba(139, 92, 246, 0.2)',
                        borderColor: department.color
                          ? `${department.color}40`
                          : 'rgba(139, 92, 246, 0.4)',
                        borderWidth: '1px',
                      }}
                    >
                      <IconComponent
                        className="h-6 w-6"
                        style={{
                          color: department.color || '#8B5CF6',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {department.color && (
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: department.color }}
                            title={department.color}
                          />
                        )}
                        <h3 className="text-lg font-semibold text-gray-100 truncate">
                          {department.name}
                        </h3>
                      </div>
                      {department.description && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                          {department.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Team member count and actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <Badge
                      variant={department.team_member_count > 0 ? 'info' : 'secondary'}
                      className="flex items-center gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {department.team_member_count} member
                      {department.team_member_count !== 1 ? 's' : ''}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => onEdit(department)}
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-700/50"
                        title="Edit department"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        disabled={isDeleting}
                      >
                        <Edit className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => setDepartmentToDelete(department)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-700/50"
                        title="Delete department"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Delete confirmation dialog */}
      {departmentToDelete && (
        <DeleteConfirmDialog
          department={departmentToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={deletingId === departmentToDelete.id}
        />
      )}

      {/* Error toast for delete errors */}
      {deleteError && (
        <motion.div
          className="fixed bottom-4 right-4 bg-red-900/90 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg shadow-lg max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Delete failed</p>
              <p className="text-sm text-red-300 mt-1">{deleteError}</p>
            </div>
            <button
              onClick={() => setDeleteError(null)}
              className="text-red-400 hover:text-red-300 ml-2"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </>
  )
}

export default DepartmentList
