import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-gray-800/50', className)} />
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
      <div className="flex items-center mb-4">
        <Skeleton className="h-5 w-5 mr-2" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="h-80 relative">
        <div className="flex items-end justify-around h-full px-4 pb-4">
          <Skeleton className="w-12 h-32" />
          <Skeleton className="w-12 h-48" />
          <Skeleton className="w-12 h-40" />
          <Skeleton className="w-12 h-56" />
          <Skeleton className="w-12 h-36" />
          <Skeleton className="w-12 h-44" />
        </div>
      </div>
    </div>
  )
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-t border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[200px]" />
        </td>
      ))}
    </tr>
  )
}

export function InvoiceCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-32 mb-2" />
          <div className="flex gap-2 mb-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  )
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function OrderListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-6">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CustomerListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SupplierListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-5 w-36 mb-2" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full max-w-md" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full max-w-md" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function UserListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-4 w-40 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 text-gray-100 shadow-sm p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-700">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
