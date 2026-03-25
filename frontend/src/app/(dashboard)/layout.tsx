'use client';

/**
 * Dashboard layout with sidebar.
 */

import { ReactNode } from 'react';
import { AppLayout } from '@/components/layout';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <AppLayout>{children}</AppLayout>
    </AppErrorBoundary>
  );
}
