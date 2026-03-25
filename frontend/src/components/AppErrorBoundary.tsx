/**
 * AppErrorBoundary.tsx
 * Catches render errors including RSC payload rendering failures.
 * Shows a friendly session expired message instead of raw error text.
 */
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** React error boundary wrapping the dashboard to catch RSC failures. */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Session Expired
            </h2>
            <p className="text-gray-500 mb-6">Please sign in again to continue.</p>
            <a
              href="/auth/login"
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700"
            >
              Sign In Again
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
