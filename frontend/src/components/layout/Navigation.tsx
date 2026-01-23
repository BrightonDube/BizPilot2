'use client'

import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

interface NavigationProps {
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export function Navigation({ sidebarCollapsed = false, onToggleSidebar }: NavigationProps) {
  return (
    <>
      <div className="hidden lg:flex">
        <Sidebar collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />
      </div>
      <MobileNav />
    </>
  )
}

export default Navigation
