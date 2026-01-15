'use client'

import { useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { subscribeToAuthEvent } from '@/lib/api'

/**
 * AuthInitializer component.
 * 
 * Responsibilities:
 * 1. Fetch user data on app mount to verify authentication
 * 2. Listen for session expiration events and handle logout + redirect
 * 
 * This component must be mounted high in the component tree (e.g., in AppLayout)
 * to ensure session expiration is handled globally.
 */
export function AuthInitializer() {
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const logout = useAuthStore((s) => s.logout)

  /**
   * Handle session expiration.
   * Clears auth state and redirects to login with a message.
   */
  const handleSessionExpired = useCallback(async () => {
    // Clear auth state
    await logout()
    
    // Redirect to login with session expired message
    // Use window.location for a hard navigation to ensure clean state
    // Check for window to ensure SSR safety (though this is a client component)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search
      const loginUrl = `/auth/login?session_expired=true&next=${encodeURIComponent(currentPath)}`
      window.location.href = loginUrl
    }
  }, [logout])

  // Subscribe to session expiration events
  useEffect(() => {
    const unsubscribe = subscribeToAuthEvent('auth:session-expired', () => {
      handleSessionExpired()
    })
    
    return unsubscribe
  }, [handleSessionExpired])

  // Initial user fetch
  useEffect(() => {
    // Guard for SSR safety (though useEffect only runs on client)
    if (typeof window === 'undefined') return

    if (!isInitialized) {
      fetchUser()
    }
  }, [fetchUser, isInitialized])

  return null
}

export default AuthInitializer
