/**
 * useSessionExpiry.ts
 * Detects session expiry by watching for auth:session-expired events from the API client.
 * The API client dispatches this event on 401 after a failed token refresh.
 */
'use client'

import { useState, useEffect } from 'react'
import { subscribeToAuthEvent } from '@/lib/api'

/**
 * Fires the session expired event manually.
 * Normally this is triggered automatically by the API client on 401 + refresh failure.
 */
export function triggerSessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-expired'))
  }
}

/**
 * Returns true when the session has expired.
 * Mount this once in the dashboard root layout.
 */
export function useSessionExpiry(): boolean {
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToAuthEvent('auth:session-expired', () => {
      setIsExpired(true)
    })
    return unsubscribe
  }, [])

  return isExpired
}
