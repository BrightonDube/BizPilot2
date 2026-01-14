'use client';

/**
 * Mobile bottom navigation bar.
 * Shows primary navigation items with a "More" option for additional features.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Sparkles,
  MoreHorizontal,
  Warehouse,
  Users,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'AI', href: '/ai', icon: Sparkles },
  { name: 'More', href: '/menu', icon: MoreHorizontal, isMore: true },
];

const moreMenuItems = [
  { name: 'Inventory', href: '/inventory', icon: Warehouse, description: 'Manage stock levels' },
  { name: 'Customers', href: '/customers', icon: Users, description: 'Customer management' },
  { name: 'Suppliers', href: '/suppliers', icon: Truck, description: 'Manage suppliers' },
  { name: 'Purchases', href: '/purchases', icon: ShoppingBag, description: 'Orders to suppliers' },
  { name: 'Reports', href: '/reports', icon: BarChart3, description: 'Business analytics' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'App preferences' },
];

// Routes that should highlight the "More" tab
const moreRoutes = ['/menu', '/inventory', '/customers', '/suppliers', '/purchases', '/reports', '/settings'];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { logout } = useAuth();

  const isMoreActive = moreRoutes.some(route => pathname.startsWith(route)) || moreOpen;

  const handleLogout = async () => {
    setMoreOpen(false);
    await logout();
    window.location.href = '/auth/login';
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 lg:hidden z-50 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navigation.map((item) => {
            const isActive = item.name === 'More' 
              ? isMoreActive 
              : pathname.startsWith(item.href);
            
            return (
              item.isMore ? (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-3 min-w-[64px] transition-colors",
                    isActive 
                      ? "text-blue-400" 
                      : "text-gray-400 active:text-gray-300"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110"
                  )} />
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    isActive && "font-semibold"
                  )}>
                    {item.name}
                  </span>
                </button>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-3 min-w-[64px] transition-colors",
                    isActive 
                      ? "text-blue-400" 
                      : "text-gray-400 active:text-gray-300"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110"
                  )} />
                  <span className={cn(
                    "text-xs mt-1 font-medium",
                    isActive && "font-semibold"
                  )}>
                    {item.name}
                  </span>
                </Link>
              )
            );
          })}
        </div>
      </nav>
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex items-end">
          <div className="w-full rounded-t-3xl bg-gray-950 border-t border-gray-800 shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-8 rounded-full bg-gray-700" />
                <p className="text-sm font-semibold text-gray-300">More</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close more menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {moreMenuItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-all border",
                      active
                        ? "border-blue-500/40 bg-blue-600/10 text-blue-200"
                        : "border-gray-800 bg-gray-900 hover:bg-gray-850 hover:border-gray-700 text-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      active ? "bg-blue-600/20" : "bg-gray-800"
                    )}>
                      <item.icon className={cn(
                        "h-5 w-5",
                        active ? "text-blue-400" : "text-gray-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 truncate">{item.description}</p>
                    </div>
                    <MoreHorizontal className="h-4 w-4 text-gray-500" />
                  </Link>
                );
              })}

              <div className="pt-2 mt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full p-3 rounded-xl border border-gray-800 bg-gray-900 hover:bg-red-900/20 hover:border-red-800/40 text-gray-200 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                    <LogOut className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium">Logout</p>
                    <p className="text-xs text-gray-500 truncate">Sign out of your account</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileNav;
