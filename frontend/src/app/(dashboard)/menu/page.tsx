'use client'

/**
 * More menu page for mobile navigation.
 * Shows navigation items not visible in the bottom mobile nav bar.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  Warehouse,
  Users,
  Truck,
  CreditCard,
  BarChart3,
  Sparkles,
  Settings,
  LogOut,
  User,
  ChevronRight,
  Building2,
} from 'lucide-react'

const menuItems = [
  { name: 'Inventory', href: '/inventory', icon: Warehouse, description: 'Manage stock levels' },
  { name: 'Customers', href: '/customers', icon: Users, description: 'Customer management' },
  { name: 'Suppliers', href: '/suppliers', icon: Truck, description: 'Supplier management' },
  { name: 'Payments', href: '/payments', icon: CreditCard, description: 'Track payments' },
  { name: 'Reports', href: '/reports', icon: BarChart3, description: 'Business analytics' },
  { name: 'AI Assistant', href: '/ai', icon: Sparkles, description: 'Get AI-powered help' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'App preferences' },
]

export default function MenuPage() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  // Use hard navigation for logout to avoid RSC hydration issues
  const handleLogout = async () => {
    await logout()
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-4">
        <h1 className="text-xl font-bold text-white">More</h1>
      </div>

      {/* User Profile Section */}
      <motion.div
        className="px-4 py-4 border-b border-gray-800"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Link href="/settings?tab=profile">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 hover:bg-gray-800 transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-white truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </div>
        </Link>
      </motion.div>

      {/* Business Info */}
      <motion.div
        className="px-4 py-3 border-b border-gray-800"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <Link href="/settings?tab=business">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 hover:bg-gray-800 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Current Business</p>
              <p className="text-xs text-gray-400 truncate">Switch or manage businesses</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </div>
        </Link>
      </motion.div>

      {/* Menu Items */}
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Features
        </p>
        <div className="space-y-2">
          {menuItems.map((item, index) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.1 + index * 0.03 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all",
                    isActive
                      ? "bg-blue-600/10 border border-blue-500/30"
                      : "bg-gray-900 hover:bg-gray-800"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isActive ? "bg-blue-600/20" : "bg-gray-800"
                  )}>
                    <item.icon className={cn(
                      "h-5 w-5",
                      isActive ? "text-blue-400" : "text-gray-400"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      isActive ? "text-blue-400" : "text-white"
                    )}>
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                  </div>
                  <ChevronRight className={cn(
                    "h-5 w-5",
                    isActive ? "text-blue-400" : "text-gray-500"
                  )} />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Sign Out */}
      <div className="px-4 py-4 border-t border-gray-800 mt-4">
        <motion.button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-3 rounded-xl bg-gray-900 hover:bg-red-900/20 transition-colors group"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.4 }}
        >
          <div className="w-10 h-10 rounded-lg bg-gray-800 group-hover:bg-red-900/30 flex items-center justify-center transition-colors">
            <LogOut className="h-5 w-5 text-gray-400 group-hover:text-red-400 transition-colors" />
          </div>
          <span className="text-sm font-medium text-gray-300 group-hover:text-red-400 transition-colors">
            Sign Out
          </span>
        </motion.button>
      </div>
    </div>
  )
}
