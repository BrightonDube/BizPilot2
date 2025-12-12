'use client';

/**
 * Dashboard layout with sidebar.
 */

import { ReactNode } from 'react';
import { AppLayout } from '@/components/layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
