'use client';

/**
 * Main application layout with sidebar.
 * Checks if user has a business and redirects to setup if not.
 */

import { useState, ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useRequireAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { GlobalAIChat } from '@/components/ai/GlobalAIChat';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { SessionInactivityManager } from '@/components/auth/SessionInactivityManager';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [checkingBusiness, setCheckingBusiness] = useState(true);

  return (
    <>
      <AuthInitializer />
      <AppLayoutInner
        router={router}
        pathname={pathname}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        checkingBusiness={checkingBusiness}
        setCheckingBusiness={setCheckingBusiness}
      >
        {children}
      </AppLayoutInner>
    </>
  );
}

function AppLayoutInner({
  children,
  router,
  pathname,
  sidebarCollapsed,
  setSidebarCollapsed,
  checkingBusiness,
  setCheckingBusiness,
}: {
  children: ReactNode;
  router: ReturnType<typeof useRouter>;
  pathname: string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  checkingBusiness: boolean;
  setCheckingBusiness: (v: boolean) => void;
}) {
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
        // Allow dashboard to render even if status check fails
      }
      setCheckingBusiness(false);
    };

    if (!isLoading) {
      checkBusinessStatus();
    }
  }, [isLoading, router]);

  if (isLoading || checkingBusiness) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <SessionInactivityManager />
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
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="min-h-[calc(100vh-6rem)]"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNav />

      <GlobalAIChat />
    </div>
  );
}

export default AppLayout;
