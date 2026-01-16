'use client'

import { FormEvent, useState } from 'react'
import { Save, X } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import type { Department, DepartmentCreate, DepartmentUpdate } from '@/lib/types'

/**
 * Available icons for department selection.
 * These match common Lucide icon names used throughout the app.
 */
const AVAILABLE_ICONS = [
  { value: 'users', label: 'Users' },
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'chart-bar', label: 'Chart' },
  { value: 'cog', label: 'Settings' },
  { value: 'dollar-sign', label: 'Finance' },
  { value: 'headphones', label: 'Support' },
  { value: 'megaphone', label: 'Marketing' },
  { value: 'code', label: 'Development' },
  { value: 'truck', label: 'Logistics' },
  { value: 'shopping-cart', label: 'Sales' },
  { value: 'heart', label: 'HR' },
  { value: 'shield', label: 'Security' },
] as const

/**
 * Predefined colors for department selection.
 * These are common brand-friendly colors.
 */
const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
] as const

/**
 * Validation errors for the department form.
 */
interface FormErrors {
  name?: string
  color?: string
}

/**
 * Props for the DepartmentForm component.
 */
interface DepartmentFormProps {
  /** Existing department for edit mode. If provided, form is in edit mode. */
  department?: Department
  /** Callback when form is submitted with valid data */
  onSubmit: (data: DepartmentCreate | DepartmentUpdate) => void | Promise<void>
  /** Callback when form is cancelled */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
}

/**
 * Validates a hex color string.
 * @param color - The color string to validate
 * @returns true if valid hex color format (#RRGGBB), false otherwise
 */
function isValidHexColor(color: string): boolean {
  if (!color) return true // Empty is valid (optional field)
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

/**
 * DepartmentForm component for creating and editing departments.
 * 
 * Features:
 * - Name input (required, 1-100 characters)
 * - Description textarea (optional)
 * - Color picker with preset colors and custom hex input
 * - Icon selector dropdown
 * - Form validation with inline error display
 * 
 * Requirements: 1.2, 7.3
 * 
 * @example
 * // Create mode
 * <DepartmentForm
 *   onSubmit={(data) => createDepartment(data)}
 *   onCancel={() => setShowForm(false)}
 * />
 * 
 * @example
 * // Edit mode
 * <DepartmentForm
 *   department={existingDepartment}
 *   onSubmit={(data) => updateDepartment(department.id, data)}
 *   onCancel={() => setEditingDepartment(null)}
 * />
 */
export function DepartmentForm({
  department,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DepartmentFormProps) {
  const isEditMode = !!department

  // Form state - initialize from department prop
  const [name, setName] = useState(department?.name || '')
  const [description, setDescription] = useState(department?.description || '')
  const [color, setColor] = useState(department?.color || '')
  const [icon, setIcon] = useState(department?.icon || '')
  
  // Validation state
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Track the department ID to detect when we switch to a different department
  const [lastDepartmentId, setLastDepartmentId] = useState(department?.id)

  // Reset form when switching to a different department (for edit mode)
  // This uses a pattern that avoids the setState-in-effect warning
  if (department?.id !== lastDepartmentId) {
    setLastDepartmentId(department?.id)
    setName(department?.name || '')
    setDescription(department?.description || '')
    setColor(department?.color || '')
    setIcon(department?.icon || '')
    setErrors({})
    setTouched({})
  }

  /**
   * Validates the form and returns validation errors.
   */
  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {}

    // Name validation: required, 1-100 characters
    const trimmedName = name.trim()
    if (!trimmedName) {
      newErrors.name = 'Department name is required'
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Department name must be 100 characters or less'
    }

    // Color validation: must be valid hex format if provided
    if (color && !isValidHexColor(color)) {
      newErrors.color = 'Color must be a valid hex format (e.g., #FF5733)'
    }

    return newErrors
  }

  /**
   * Handles field blur to mark field as touched.
   */
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    // Validate on blur
    const validationErrors = validateForm()
    setErrors(validationErrors)
  }

  /**
   * Handles form submission.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouched({ name: true, color: true })

    // Validate form
    const validationErrors = validateForm()
    setErrors(validationErrors)

    // If there are errors, don't submit
    if (Object.keys(validationErrors).length > 0) {
      return
    }

    // Build submission data
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()
    const trimmedColor = color.trim()
    const trimmedIcon = icon.trim()

    if (isEditMode) {
      // For update, only include changed fields
      const updateData: DepartmentUpdate = {}
      
      if (trimmedName !== department.name) {
        updateData.name = trimmedName
      }
      if (trimmedDescription !== (department.description || '')) {
        updateData.description = trimmedDescription || null
      }
      if (trimmedColor !== (department.color || '')) {
        updateData.color = trimmedColor || null
      }
      if (trimmedIcon !== (department.icon || '')) {
        updateData.icon = trimmedIcon || null
      }

      await onSubmit(updateData)
    } else {
      // For create, include all fields
      const createData: DepartmentCreate = {
        name: trimmedName,
        description: trimmedDescription || null,
        color: trimmedColor || null,
        icon: trimmedIcon || null,
      }

      await onSubmit(createData)
    }
  }

  /**
   * Handles color preset selection.
   */
  const handleColorPresetClick = (presetColor: string) => {
    setColor(presetColor)
    // Clear color error if valid
    if (isValidHexColor(presetColor)) {
      setErrors((prev) => ({ ...prev, color: undefined }))
    }
  }

  const title = isEditMode ? 'Edit Department' : 'Create Department'

  return (
    <Card className="hover:translate-y-0 hover:scale-100">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Department Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="e.g., Sales, Marketing, Operations"
              maxLength={100}
              disabled={isSubmitting}
              className={touched.name && errors.name ? 'border-red-500' : ''}
            />
            {touched.name && errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {name.length}/100 characters
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this department's responsibilities"
              rows={3}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Color
            </label>
            <div className="space-y-2">
              {/* Preset Colors */}
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    onClick={() => handleColorPresetClick(presetColor)}
                    disabled={isSubmitting}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      color === presetColor
                        ? 'border-white scale-110'
                        : 'border-transparent hover:border-gray-400'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    style={{ backgroundColor: presetColor }}
                    title={presetColor}
                  />
                ))}
              </div>
              {/* Custom Color Input */}
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg border border-slate-600"
                  style={{ backgroundColor: isValidHexColor(color) ? color : '#374151' }}
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  onBlur={() => handleBlur('color')}
                  placeholder="#FF5733"
                  maxLength={7}
                  disabled={isSubmitting}
                  className={`flex-1 ${touched.color && errors.color ? 'border-red-500' : ''}`}
                />
              </div>
              {touched.color && errors.color && (
                <p className="text-sm text-red-400">{errors.color}</p>
              )}
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Icon
            </label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              disabled={isSubmitting}
              className="flex h-10 w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">No icon</option>
              {AVAILABLE_ICONS.map((iconOption) => (
                <option key={iconOption.value} value={iconOption.value}>
                  {iconOption.label}
                </option>
              ))}
            </select>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={isSubmitting}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting
                ? 'Saving...'
                : isEditMode
                ? 'Update Department'
                : 'Create Department'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default DepartmentForm
