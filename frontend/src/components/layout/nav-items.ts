'use client';

import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  ShoppingBag,
  Users,
  Truck,
  FileText,
  BarChart3,
  Sparkles,
  Settings,
  Factory,
  Shield,
  Clock,
  UsersRound,
} from 'lucide-react';

export type NavItem = {
  name: string;
  href: string;
  icon: any;
  requiresSuperadmin?: boolean;
};

export const sidebarNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Production', href: '/production', icon: Factory },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Purchases', href: '/purchases', icon: ShoppingBag },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Time Tracking', href: '/time-tracking', icon: Clock },
  { name: 'Team', href: '/team', icon: UsersRound },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'AI Assistant', href: '/ai', icon: Sparkles },
];

export const sidebarBottomNavigation: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Admin Panel', href: '/admin', icon: Shield, requiresSuperadmin: true },
];
