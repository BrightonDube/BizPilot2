'use client';

/**
 * Mobile bottom navigation bar.
 * Shows primary navigation items with a "More" option for additional features.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  MoreHorizontal,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'More', href: '/menu', icon: MoreHorizontal },
];

// Routes that should highlight the "More" tab
const moreRoutes = ['/menu', '/inventory', '/customers', '/payments', '/reports', '/ai', '/settings'];

export function MobileNav() {
  const pathname = usePathname();

  const isMoreActive = moreRoutes.some(route => pathname.startsWith(route));

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 lg:hidden z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navigation.map((item) => {
          const isActive = item.name === 'More' 
            ? isMoreActive 
            : pathname.startsWith(item.href);
          
          return (
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
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
