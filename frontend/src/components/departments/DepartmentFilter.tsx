'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/types'

/**
 * Special value for filtering team members with no department assigned.
 */
export const NO_DEPARTMENT_VALUE = '__none__'

/**
 * Filter state emitted by the DepartmentFilter component.
 */
export interface DepartmentFilterState {
  /** 
   * Department ID to filter by:
   * - null: Show all departments (no filter)
   * - NO_DEPARTMENT_VALUE: Show only team members without a department
   * - UUID string: Show only team members in that specific department
   */
  departmentId: string | null
  /** Search term for filtering by name, email, or department name */
  search: string
}

/**
 * Props for the DepartmentFilter component.
 */
export interface DepartmentFilterProps {
  /** List of departments to show in the dropdown */
  departments: Department[]
  /** Callback fired when filter state changes */
  onFilterChange: (filter: DepartmentFilterState) => void
  /** Initial department filter value */
  initialDepartmentId?: string | null
  /** Initial search value */
  initialSearch?: string
  /** Additional CSS classes for the container */
  className?: string
  /** Placeholder text for search input */
  searchPlaceholder?: string
  /** Debounce delay in milliseconds for search input (default: 300) */
  debounceMs?: number
}

/**
 * Custom hook for debouncing a value.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * DepartmentFilter component for filtering and searching team members.
 * 
 * Provides a compact filter interface with:
 * - Department dropdown filter (All Departments, No Department, specific departments)
 * - Search input with debounce for filtering by name, email, or department name
 * 
 * The component emits filter changes to the parent via the onFilterChange callback.
 * Search input is debounced (default 300ms) to avoid excessive callbacks.
 * 
 * Requirements:
 * - 4.4: Provide a filter to show team members from specific departments
 * - 4.5: Provide a search function that includes department names in the search criteria
 * 
 * @example
 * ```tsx
 * <DepartmentFilter
 *   departments={departments}
 *   onFilterChange={({ departmentId, search }) => {
 *     // Update team member list based on filters
 *   }}
 * />
 * ```
 */
export function DepartmentFilter({
  departments,
  onFilterChange,
  initialDepartmentId = null,
  initialSearch = '',
  className,
  searchPlaceholder = 'Search by name, email, or department...',
  debounceMs = 300,
}: DepartmentFilterProps) {
  // Local state for immediate UI updates
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(
    initialDepartmentId
  )
  const [searchTerm, setSearchTerm] = useState(initialSearch)

  // Debounced search value to avoid excessive API calls
  const debouncedSearch = useDebounce(searchTerm, debounceMs)

  // Memoize the filter state to avoid unnecessary re-renders
  const filterState = useMemo<DepartmentFilterState>(
    () => ({
      departmentId: selectedDepartmentId,
      search: debouncedSearch,
    }),
    [selectedDepartmentId, debouncedSearch]
  )

  // Emit filter changes when debounced values change
  useEffect(() => {
    onFilterChange(filterState)
  }, [filterState, onFilterChange])

  // Handle department selection change
  const handleDepartmentChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value
      // Convert empty string to null for "All Departments"
      setSelectedDepartmentId(value === '' ? null : value)
    },
    []
  )

  // Handle search input change
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value)
    },
    []
  )

  return (
    <div className={cn('flex flex-col sm:flex-row gap-3', className)}>
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="h-4 w-4 absolute left-3 top-3 text-gray-500 pointer-events-none" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10 bg-gray-900/50 border-gray-600"
          aria-label="Search team members"
        />
      </div>

      {/* Department Dropdown */}
      <div className="sm:w-48">
        <Select
          value={selectedDepartmentId ?? ''}
          onChange={handleDepartmentChange}
          className="bg-gray-900/50 border-gray-600"
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          <option value={NO_DEPARTMENT_VALUE}>No Department</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

export default DepartmentFilter
