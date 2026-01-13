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
    const currentPath = window.location.pathname + window.location.search
    const loginUrl = `/auth/login?session_expired=true&next=${encodeURIComponent(currentPath)}`
    window.location.href = loginUrl
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
