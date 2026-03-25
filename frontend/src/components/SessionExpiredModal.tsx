/**
 * SessionExpiredModal.tsx
 * Shown when the user's session expires while they are on a dashboard page.
 * Prevents raw Next.js RSC payload from being shown to users.
 * Inspired by DigitalOcean's session expiry UX pattern.
 */
'use client'

import { useRouter } from 'next/navigation'

interface SessionExpiredModalProps {
  /** Whether the modal is visible */
  isOpen: boolean
}

/**
 * Full-screen overlay modal shown when session expires.
 * Blocks all interaction with the page beneath it.
 */
export function SessionExpiredModal({ isOpen }: SessionExpiredModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="mb-4 text-amber-500">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2
          id="session-expired-title"
          className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
        >
          Session Expired
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          Your session has timed out due to inactivity. Please sign in again to continue.
        </p>
        <button
          onClick={() => router.push('/auth/login')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          Sign In Again
        </button>
      </div>
    </div>
  )
}
