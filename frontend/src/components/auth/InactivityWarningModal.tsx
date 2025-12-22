'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Clock, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'

interface InactivityWarningModalProps {
  isOpen: boolean
  timeRemaining: number
  onExtendSession: () => void
  onLogout: () => void
}

export function InactivityWarningModal({
  isOpen,
  timeRemaining,
  onExtendSession,
  onLogout,
}: InactivityWarningModalProps) {
  const [countdown, setCountdown] = useState(Math.ceil(timeRemaining / 1000))

  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      const remaining = Math.ceil(timeRemaining / 1000)
      setCountdown(remaining)

      if (remaining <= 0) {
        onLogout()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, timeRemaining, onLogout])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-md mx-4 bg-gray-900 rounded-xl shadow-2xl border border-yellow-800/50 p-6">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Session Expiring Soon</h3>
            <p className="text-gray-300">You&apos;ve been inactive for a while. Your session will expire in:</p>
          </div>

          <div className="flex items-center space-x-2 bg-yellow-900/30 px-4 py-2 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="font-mono text-xl font-bold text-yellow-200">{formatTime(countdown)}</span>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
            <p>
              For your security, we automatically log you out after 3 hours of inactivity. Click &quot;Stay Signed In&quot; to continue your session.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="outline"
              onClick={onLogout}
              className="flex items-center justify-center space-x-2 flex-1 border-gray-700"
              type="button"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Now</span>
            </Button>

            <Button
              onClick={onExtendSession}
              className="flex items-center justify-center space-x-2 flex-1 bg-green-600 hover:bg-green-700"
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Stay Signed In</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InactivityWarningModal
