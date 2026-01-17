'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { subscribeToAuthEvent } from '@/lib/api'
import { useSessionManager } from '@/hooks/useSessionManager'

/**
 * AuthInitializer component.
 * 
 * Responsibilities:
 * 1. Fetch user data on app mount to verify authentication
 * 2. Listen for session expiration events and handle logout + redirect
 * 3. Manage automatic session expiration with activity tracking
 * 
 * This component must be mounted high in the component tree (e.g., in AppLayout)
 * to ensure session expiration is handled globally.
 */
export function AuthInitializer() {
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const logout = useAuthStore((s) => s.logout)
  
  // Enable automatic session management with activity tracking
  useSessionManager({
    enabled: true,
    idleTimeout: 30 * 60 * 1000, // 30 minutes of inactivity
    refreshBeforeExpiry: 5 * 60 * 1000, // Refresh 5 minutes before expiry
  })
  
  // Track if we're already redirecting to prevent multiple redirects
  const isRedirecting = useRef(false)

  /**
   * Handle session expiration.
   * Uses hard navigation to prevent RSC/JSON response issues.
   */
  const handleSessionExpired = useCallback(() => {
    // Prevent multiple redirects
    if (isRedirecting.current) return
    isRedirecting.current = true
    
    // Check for window to ensure SSR safety (though this is a client component)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search
      const loginUrl = `/auth/login?session_expired=true&next=${encodeURIComponent(currentPath)}`
      
      // Use hard navigation to prevent RSC issues - this ensures proper HTML response
      window.location.href = loginUrl
      
      // Clear auth state in background (redirect will happen first)
      logout().catch((err) => {
        // Log for debugging but don't block - redirect is already in progress
        console.debug('Logout during session expiration failed:', err)
      })
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
