'use client';

/**
 * Main application layout with sidebar.
 * Checks if user has a business and redirects to setup if not.
 */

import { useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useRequireAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';
import apiClient from '@/lib/api';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [checkingBusiness, setCheckingBusiness] = useState(true);
  const { isLoading } = useRequireAuth();

  useEffect(() => {
    const checkBusinessStatus = async () => {
      try {
        const response = await apiClient.get('/business/status');
        if (!response.data.has_business) {
          router.push('/business/setup');
          return;
        }
      } catch (error) {
        console.error('Error checking business status:', error);
        // If the check fails, redirect to setup to be safe
        router.push('/business/setup');
        return;
      }
      setCheckingBusiness(false);
    };

    if (!isLoading) {
      checkBusinessStatus();
    }
  }, [isLoading, router]);

  if (isLoading || checkingBusiness) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}

export default AppLayout;
