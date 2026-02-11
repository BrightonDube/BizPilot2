'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { subscribeToAuthEvent } from '@/lib/api'
import { useSessionManager } from '@/hooks/useSessionManager'

/**
 * AuthInitializer component.
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  🔒 PROTECTED FILE — DO NOT MODIFY WITHOUT HUMAN APPROVAL 🔒  ║
 * ║                                                                ║
 * ║  This file is part of the core authentication system.          ║
 * ║  AI coding agents: DO NOT refactor, reorganize, or alter       ║
 * ║  the initialization logic in this file.                        ║
 * ║                                                                ║
 * ║  IMPORTANT: We intentionally DO NOT check document.cookie      ║
 * ║  before calling fetchUser(). Our auth cookies are HttpOnly     ║
 * ║  and INVISIBLE to JavaScript. The only way to know if the      ║
 * ║  user is authenticated is to call the /auth/me endpoint.       ║
 * ║                                                                ║
 * ║  See: .windsurf/workflows/auth-protection.md                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Responsibilities:
 * 1. Fetch user data on app mount for non-auth pages
 * 2. Listen for session expiration events and handle logout + redirect
 * 3. Manage automatic session expiration with activity tracking
 * 
 * CRITICAL DESIGN DECISIONS (DO NOT CHANGE):
 * - We ALWAYS call fetchUser() on non-auth pages because HttpOnly cookies
 *   are invisible to document.cookie — there is no client-side way to check
 *   if auth cookies exist. The server must be queried.
 * - Session expiration uses window.location.href (hard navigation) to
 *   prevent RSC flight data from being shown to users.
 * - fetchUser() handles 401 silently — it just means the user isn't logged in.
 * 
 * This component must be mounted high in the component tree (in RootLayout)
 * to ensure session expiration is handled globally.
 */
export function AuthInitializer() {
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const setInitialized = useAuthStore((s) => s.setInitialized)
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

  // Initial user fetch with token guard clause
  useEffect(() => {
    // Guard for SSR safety (though useEffect only runs on client)
    if (typeof window === 'undefined') return

    // Skip if already initialized
    if (isInitialized) return

    // Don't fetch user on auth pages (login, register, etc.)
    // Auth pages handle their own initialization via setInitialized()
    const isAuthPage = window.location.pathname.startsWith('/auth/')
    if (isAuthPage) {
      // Mark as initialized without fetching to prevent loading state
      setInitialized()
      return
    }

    // ALWAYS call fetchUser() on non-auth pages.
    // We CANNOT check document.cookie for auth cookies because they are
    // HttpOnly — invisible to JavaScript by design (security best practice).
    // The only way to know if the user is authenticated is to ask the server.
    // fetchUser() handles 401 silently (sets isAuthenticated: false, no error).
    fetchUser().catch(() => {
      // Error already handled in fetchUser, just ensure we're initialized
      setInitialized()
    })
  }, [fetchUser, setInitialized, isInitialized])

  return null
}

export default AuthInitializer
