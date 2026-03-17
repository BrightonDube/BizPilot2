/**
 * LaybyRow component renders a single row in the layby list table.
 * It displays key information about a layby in a structured format.
 */

import Link from 'next/link';
import { Layby } from '../types';
import { LaybyStatusBadge } from './LaybyStatusBadge';

interface LaybyRowProps {
  /** The layby data to display */
  layby: Layby;
}

/**
 * Formats a number as currency using South African Rand.
 * 
 * @param amount - The numeric amount to format
 * @returns Formatted currency string
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string in a readable format.
 * 
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Renders a single layby as a table row with all relevant information.
 * 
 * @param props - Component props
 * @returns JSX element with layby row content
 */
export function LaybyRow({ layby }: LaybyRowProps) {
  return (
    <Link href={`/laybys/${layby.id}`}>
      <div className="bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all cursor-pointer rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left side: Reference, Customer, and Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm sm:text-base font-semibold text-gray-100 truncate">
                {layby.reference_number}
              </h3>
              <LaybyStatusBadge status={layby.status} />
            </div>
            <p className="text-sm text-gray-400 truncate">
              {layby.customer_name || 'Walk-in Customer'}
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(layby.created_at)}
            </p>
          </div>

          {/* Right side: Amounts and View Link */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm sm:text-base font-semibold text-gray-100">
                {formatCurrency(layby.total_amount)}
              </div>
              <div className="text-xs sm:text-sm text-gray-400">
                Paid: {formatCurrency(layby.amount_paid)}
              </div>
              <div className="text-xs sm:text-sm font-medium text-blue-400">
                Balance: {formatCurrency(layby.balance_due)}
              </div>
            </div>
            
            <div className="text-blue-400 hover:text-blue-300 transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
