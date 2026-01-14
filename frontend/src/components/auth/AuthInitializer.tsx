'use client'

import { useEffect, useCallback, useRef } from 'react'
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
  
  // Track if we're already redirecting to prevent multiple redirects
  const isRedirecting = useRef(false)

  /**
   * Handle session expiration.
   * Redirects immediately to login, then clears auth state.
   * The immediate redirect prevents any error states from being rendered.
   */
  const handleSessionExpired = useCallback(() => {
    // Prevent multiple redirects
    if (isRedirecting.current) return
    isRedirecting.current = true
    
    // Check for window to ensure SSR safety (though this is a client component)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search
      const loginUrl = `/auth/login?session_expired=true&next=${encodeURIComponent(currentPath)}`
      
      // Redirect immediately - don't wait for logout
      window.location.href = loginUrl
      
      // Clear auth state in background (redirect will happen first)
      logout().catch(() => {
        // Ignore errors during logout - we're redirecting anyway
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
    
    const oauthLoadingTime = window.localStorage.getItem('oauth_loading_time')
    if (oauthLoadingTime) {
      const timeDiff = Date.now() - Number(oauthLoadingTime)
      if (Number.isFinite(timeDiff) && timeDiff > 30000) {
        window.localStorage.removeItem('oauth_loading_time')
      }
    }

    if (!isInitialized) {
      fetchUser()
    }
  }, [fetchUser, isInitialized])

  return null
}

export default AuthInitializer
