'use client'

import {
  Building2,
  Users,
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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DepartmentSummary } from '@/lib/types'

/**
 * Map of icon names to Lucide icon components.
 * These match the AVAILABLE_ICONS in DepartmentForm and ICON_MAP in DepartmentList.
 */
const ICON_MAP: Record<string, LucideIcon> = {
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
 * Props for the DepartmentBadge component.
 */
export interface DepartmentBadgeProps {
  /** Department to display, or null/undefined for "No Department" */
  department?: DepartmentSummary | null
  /** Size variant for different contexts */
  size?: 'sm' | 'md'
  /** Additional CSS classes */
  className?: string
}

/**
 * Size-based styling configuration.
 */
const SIZE_STYLES = {
  sm: {
    container: 'px-2 py-0.5 text-xs gap-1.5',
    icon: 'h-3 w-3',
    dot: 'w-2 h-2',
  },
  md: {
    container: 'px-2.5 py-1 text-sm gap-2',
    icon: 'h-3.5 w-3.5',
    dot: 'w-2.5 h-2.5',
  },
} as const

/**
 * Renders the icon element for a department.
 * This is a helper component to avoid creating components during render.
 */
function DepartmentIcon({
  iconName,
  className,
  color,
}: {
  iconName: string | null
  className: string
  color?: string
}) {
  const IconComponent = iconName && ICON_MAP[iconName] ? ICON_MAP[iconName] : Building2
  return (
    <IconComponent
      className={cn(className, 'shrink-0')}
      style={{ color: color || '#9CA3AF' }}
    />
  )
}

/**
 * DepartmentBadge component for displaying a department with color and icon.
 * 
 * A compact, reusable badge component that displays department information
 * including name, color indicator, and icon. Designed for use in tables,
 * lists, and other compact UI contexts.
 * 
 * Features:
 * - Displays department name with optional color indicator and icon
 * - Handles "No Department" case with muted styling
 * - Supports two size variants (sm, md) for different contexts
 * - Uses consistent icon mapping from DepartmentList
 * 
 * Requirements: 4.2 - Display department name, color, and icon for each team member
 * 
 * @example
 * // With department
 * <DepartmentBadge department={{ id: '1', name: 'Sales', color: '#FF5733', icon: 'briefcase' }} />
 * 
 * @example
 * // No department
 * <DepartmentBadge department={null} />
 * 
 * @example
 * // Small size for compact tables
 * <DepartmentBadge department={department} size="sm" />
 */
export function DepartmentBadge({
  department,
  size = 'md',
  className,
}: DepartmentBadgeProps) {
  const styles = SIZE_STYLES[size]

  // Handle "No Department" case
  if (!department) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md font-medium',
          'bg-gray-700/50 text-gray-400 border border-gray-600/50',
          styles.container,
          className
        )}
      >
        <Building2 className={cn(styles.icon, 'text-gray-500 shrink-0')} />
        <span>No Department</span>
      </span>
    )
  }

  const hasColor = !!department.color

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium',
        'bg-gray-700/50 text-gray-200 border border-gray-600/50',
        styles.container,
        className
      )}
      style={
        hasColor
          ? {
              backgroundColor: `${department.color}15`,
              borderColor: `${department.color}40`,
            }
          : undefined
      }
    >
      {/* Color dot indicator */}
      {hasColor && (
        <span
          className={cn('rounded-full shrink-0', styles.dot)}
          style={{ backgroundColor: department.color! }}
        />
      )}
      
      {/* Icon */}
      <DepartmentIcon
        iconName={department.icon}
        className={styles.icon}
        color={hasColor ? department.color! : undefined}
      />
      
      {/* Department name */}
      <span className="truncate max-w-[150px]">{department.name}</span>
    </span>
  )
}

export default DepartmentBadge
