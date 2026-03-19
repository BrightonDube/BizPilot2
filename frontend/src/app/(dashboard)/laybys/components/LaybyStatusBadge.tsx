/**
 * LaybyStatusBadge component displays a colored badge for layby statuses.
 * It maps each status to a specific color scheme for visual consistency.
 */

import { LaybyStatus } from '../types';

interface LaybyStatusBadgeProps {
  /** The layby status to display */
  status: LaybyStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps layby statuses to their corresponding badge styles.
 * Uses semantic colors that align with common UX patterns.
 */
const statusConfig = {
  ACTIVE: {
    variant: 'info' as const,
    label: 'Active',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  OVERDUE: {
    variant: 'danger' as const,
    label: 'Overdue',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  READY_FOR_COLLECTION: {
    variant: 'success' as const,
    label: 'Ready for Collection',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  COMPLETED: {
    variant: 'secondary' as const,
    label: 'Completed',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
  CANCELLED: {
    variant: 'secondary' as const,
    label: 'Cancelled',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
};

/**
 * Displays a styled badge for the given layby status.
 * 
 * @param props - Component props
 * @returns JSX element with styled status badge
 */
export function LaybyStatusBadge({ status, className = '' }: LaybyStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.ACTIVE;

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
        ${config.className}
        ${className}
      `}
    >
      {config.label}
    </span>
  );
}
