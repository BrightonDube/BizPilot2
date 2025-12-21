'use client'

import * as React from 'react'
import { Navigation } from './Navigation'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Navigation
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1">
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default Layout
