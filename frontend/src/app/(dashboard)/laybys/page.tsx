/**
 * Laybys page displays a list of all layby orders with filtering and pagination.
 * This is a read-only list page that shows layby status, customer info, and balances.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  ShoppingCart,
  Clock,
  DollarSign,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { useLaybys } from './hooks/useLaybys';
import { LaybyRow } from './components/LaybyRow';
import { LaybyStatus } from './types';

/**
 * Formats a number as currency using South African Rand.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Main laybys list page component.
 */
export default function LaybysPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<LaybyStatus | 'all'>('all');

  const { data, isLoading, error, refetch } = useLaybys({
    page,
    search: searchTerm,
    status: selectedStatus,
  });

  const laybys = data?.items || [];
  const total = data?.total || 0;
  const pages = data?.pages || 0;

  // Calculate statistics
  const activeLaybys = laybys.filter(l => l.status === 'ACTIVE').length;
  const overdueLaybys = laybys.filter(l => l.status === 'OVERDUE').length;
  const totalBalance = laybys.reduce((sum, l) => sum + l.balance_due, 0);

  // Handle search with debounce
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  // Handle status filter
  const handleStatusChange = (status: LaybyStatus | 'all') => {
    setSelectedStatus(status);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laybys"
        description={`Manage layby orders (${total} laybys)`}
        actions={
          <Link href="/laybys/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Layby
            </Button>
          </Link>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Laybys"
          value={total}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Active"
          value={activeLaybys}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Overdue"
          value={overdueLaybys}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard
          title="Outstanding Balance"
          value={formatCurrency(totalBalance)}
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search laybys..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => handleStatusChange(e.target.value as LaybyStatus | 'all')}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="OVERDUE">Overdue</option>
          <option value="READY_FOR_COLLECTION">Ready for Collection</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Content Area */}
      {isLoading && laybys.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-gray-400">Loading laybys...</p>
          </div>
        </div>
      ) : error && laybys.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Unable to load laybys</h2>
            <p className="text-gray-400 max-w-md">{error.message}</p>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600" 
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : laybys.length === 0 ? (
        <EmptyState
          title="No laybys found"
          description="Try adjusting your search or filters, or create a new layby"
          action={
            <Link href="/laybys/new">
              <Button>Create Your First Layby</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {laybys.map((layby) => (
            <LaybyRow key={layby.id} layby={layby} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} laybys)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
