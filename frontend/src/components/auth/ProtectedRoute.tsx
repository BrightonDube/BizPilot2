'use client'

import type { ReactNode } from 'react'
import { useRequireAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui'

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
}

export function ProtectedRoute({ children, redirectTo }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useRequireAuth(redirectTo)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute
