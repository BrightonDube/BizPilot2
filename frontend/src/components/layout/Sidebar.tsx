'use client';

/**
 * Main application sidebar navigation.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/common/Logo';
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { sidebarBottomNavigation, sidebarNavigation } from './nav-items';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Use hard navigation for logout to avoid RSC hydration issues
  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/login';
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 bg-slate-900 text-sidebar-foreground border-r border-slate-700 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo width={32} height={32} />
            <span className="text-xl font-bold text-foreground">BizPilot</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto hover:opacity-80 transition-opacity">
            <Logo width={32} height={32} />
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-lg text-muted-foreground hover:bg-slate-800 hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Business Switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-slate-700">
          <button className="flex items-center gap-2 w-full p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground truncate">Demo Business</p>
              <p className="text-xs text-muted-foreground">Demo Organization</p>
            </div>
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {sidebarNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-purple-600/20 text-purple-400"
                  : "text-muted-foreground hover:bg-slate-800 hover:text-foreground",
                collapsed && "justify-center"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="px-2 py-4 border-t border-slate-700 space-y-1">
        {sidebarBottomNavigation
          .filter((item) => !item.requiresSuperadmin || user?.is_superadmin)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            const isAdmin = item.href === '/admin';
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isAdmin
                    ? (
                      isActive
                        ? "bg-red-600/20 text-red-400"
                        : "text-red-400/70 hover:bg-red-900/20 hover:text-red-400"
                    )
                    : (
                      isActive
                        ? "bg-purple-600/20 text-purple-400"
                        : "text-muted-foreground hover:bg-slate-800 hover:text-foreground"
                    ),
                  collapsed && "justify-center"
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
              </Link>
            );
          })}
      </div>

      {/* User Menu */}
      <div className="px-2 py-4 border-t border-slate-700">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg",
          collapsed && "justify-center"
        )}>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-1 rounded-lg text-muted-foreground hover:bg-slate-800 hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
