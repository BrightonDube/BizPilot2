'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'

import { Button, Card, CardContent } from '@/components/ui'
import { DepartmentForm } from './DepartmentForm'
import { DepartmentList } from './DepartmentList'
import { departmentApi, DepartmentError } from '@/lib/department-api'
import type { Department, DepartmentCreate, DepartmentUpdate } from '@/lib/types'

/**
 * Props for the DepartmentManagement component.
 */
interface DepartmentManagementProps {
  /** The business ID to manage departments for */
  businessId: string
}

/**
 * Toast notification type.
 */
interface Toast {
  id: string
  type: 'success' | 'error'
  message: string
}

/**
 * Toast notification component.
 */
function ToastNotification({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const isSuccess = toast.type === 'success'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg max-w-md ${
        isSuccess
          ? 'bg-green-900/90 border border-green-500/30 text-green-400'
          : 'bg-red-900/90 border border-red-500/30 text-red-400'
      }`}
    >
      {isSuccess ? (
        <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <p className="font-medium">{isSuccess ? 'Success' : 'Error'}</p>
        <p className={`text-sm mt-1 ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`${isSuccess ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}
      >
        ×
      </button>
    </motion.div>
  )
}

/**
 * DepartmentManagement component for managing departments within a business.
 * 
 * Features:
 * - Fetch and display departments on mount
 * - Create new departments via DepartmentForm
 * - Edit existing departments
 * - Delete departments (with confirmation)
 * - Display success/error toast notifications
 * - Refresh department list after mutations
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7
 * 
 * @example
 * <DepartmentManagement businessId="uuid-here" />
 */
export function DepartmentManagement({ businessId }: DepartmentManagementProps) {
  // Department state
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [isCreating, setIsCreating] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([])

  /**
   * Add a toast notification.
   */
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  /**
   * Remove a toast notification.
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /**
   * Fetch departments from the API.
   */
  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await departmentApi.getDepartments(businessId)
      setDepartments(data)
    } catch (err) {
      console.error('Failed to fetch departments:', err)
      const message =
        err instanceof DepartmentError
          ? err.message
          : 'Failed to load departments. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [businessId])

  // Fetch departments on mount
  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  /**
   * Handle creating a new department.
   */
  const handleCreate = async (data: DepartmentCreate | DepartmentUpdate) => {
    try {
      setIsSubmitting(true)
      const newDepartment = await departmentApi.createDepartment(
        businessId,
        data as DepartmentCreate
      )
      setDepartments((prev) => [...prev, newDepartment])
      setIsCreating(false)
      addToast('success', `Department "${newDepartment.name}" created successfully`)
    } catch (err) {
      console.error('Failed to create department:', err)
      const message =
        err instanceof DepartmentError
          ? err.message
          : 'Failed to create department. Please try again.'
      addToast('error', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle updating an existing department.
   */
  const handleUpdate = async (data: DepartmentCreate | DepartmentUpdate) => {
    if (!editingDepartment) return

    try {
      setIsSubmitting(true)
      const updatedDepartment = await departmentApi.updateDepartment(
        businessId,
        editingDepartment.id,
        data as DepartmentUpdate
      )
      setDepartments((prev) =>
        prev.map((d) => (d.id === editingDepartment.id ? updatedDepartment : d))
      )
      setEditingDepartment(null)
      addToast('success', `Department "${updatedDepartment.name}" updated successfully`)
    } catch (err) {
      console.error('Failed to update department:', err)
      const message =
        err instanceof DepartmentError
          ? err.message
          : 'Failed to update department. Please try again.'
      addToast('error', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle deleting a department.
   */
  const handleDelete = async (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId)
    if (!department) return

    try {
      setDeletingId(departmentId)
      await departmentApi.deleteDepartment(businessId, departmentId)
      setDepartments((prev) => prev.filter((d) => d.id !== departmentId))
      addToast('success', `Department "${department.name}" deleted successfully`)
    } catch (err) {
      console.error('Failed to delete department:', err)
      const message =
        err instanceof DepartmentError
          ? err.message
          : 'Failed to delete department. Please try again.'
      addToast('error', message)
      throw err // Re-throw so DepartmentList can handle it
    } finally {
      setDeletingId(null)
    }
  }

  /**
   * Handle edit button click.
   */
  const handleEdit = (department: Department) => {
    setIsCreating(false) // Close create form if open
    setEditingDepartment(department)
  }

  /**
   * Handle cancel for create form.
   */
  const handleCancelCreate = () => {
    setIsCreating(false)
  }

  /**
   * Handle cancel for edit form.
   */
  const handleCancelEdit = () => {
    setEditingDepartment(null)
  }

  /**
   * Handle opening create form.
   */
  const handleOpenCreate = () => {
    setEditingDepartment(null) // Close edit form if open
    setIsCreating(true)
  }

  // Loading state
  if (isLoading && departments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-100">Departments</h2>
            <p className="text-gray-400">Manage your business departments</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto" />
            <p className="mt-2 text-gray-400">Loading departments...</p>
          </div>
        </div>
      </motion.div>
    )
  }

  // Error state (only show if no departments loaded)
  if (error && departments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-100">Departments</h2>
            <p className="text-gray-400">Manage your business departments</p>
          </div>
        </div>
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2 text-white">
              Unable to load departments
            </h3>
            <p className="text-sm mb-4 text-gray-400">{error}</p>
            <Button
              onClick={fetchDepartments}
              variant="gradient"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
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
          <h2 className="text-xl font-bold text-gray-100">Departments</h2>
          <p className="text-gray-400">
            Manage your business departments ({departments.length} department
            {departments.length !== 1 ? 's' : ''})
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="gradient"
          disabled={isCreating}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Department
        </Button>
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DepartmentForm
              onSubmit={handleCreate}
              onCancel={handleCancelCreate}
              isSubmitting={isSubmitting}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Form */}
      <AnimatePresence>
        {editingDepartment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DepartmentForm
              department={editingDepartment}
              onSubmit={handleUpdate}
              onCancel={handleCancelEdit}
              isSubmitting={isSubmitting}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Department List */}
      <DepartmentList
        departments={departments}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        deletingId={deletingId}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastNotification
              key={toast.id}
              toast={toast}
              onDismiss={removeToast}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default DepartmentManagement
