'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { InactivityWarningModal } from '@/components/auth/InactivityWarningModal'

interface SessionInactivityManagerProps {
  inactivityLimitMs?: number
  warningWindowMs?: number
}

export function SessionInactivityManager({
  inactivityLimitMs = 3 * 60 * 60 * 1000,
  warningWindowMs = 5 * 60 * 1000,
}: SessionInactivityManagerProps) {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [isOpen, setIsOpen] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(inactivityLimitMs)

  const lastActivityRef = useRef<number>(Date.now())
  const warningShownRef = useRef(false)

  const thresholdToShowWarning = useMemo(
    () => Math.max(0, inactivityLimitMs - warningWindowMs),
    [inactivityLimitMs, warningWindowMs]
  )

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    warningShownRef.current = false
    if (isOpen) setIsOpen(false)
  }, [isOpen])

  const handleLogout = useCallback(async () => {
    setIsOpen(false)
    warningShownRef.current = false

    await logout()
    router.push('/auth/login')
  }, [logout, router])

  const handleExtendSession = useCallback(async () => {
    try {
      await apiClient.post('/auth/refresh')
    } catch {
      await handleLogout()
      return
    }

    recordActivity()
  }, [handleLogout, recordActivity])

  useEffect(() => {
    if (!isAuthenticated) return

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    for (const event of events) {
      window.addEventListener(event, recordActivity, { passive: true })
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, recordActivity)
      }
    }
  }, [isAuthenticated, recordActivity])

  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = Math.max(0, inactivityLimitMs - elapsed)
      setTimeRemaining(remaining)

      if (remaining <= 0) {
        handleLogout()
        return
      }

      if (elapsed >= thresholdToShowWarning && !warningShownRef.current) {
        warningShownRef.current = true
        setIsOpen(true)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [handleLogout, inactivityLimitMs, isAuthenticated, thresholdToShowWarning])

  return (
    <InactivityWarningModal
      isOpen={isOpen}
      timeRemaining={timeRemaining}
      onExtendSession={handleExtendSession}
      onLogout={handleLogout}
    />
  )
}

export default SessionInactivityManager
