'use client';

/**
 * FeatureGate component for subscription-based feature access control.
 * Wraps content that requires specific subscription features.
 */

import { useSubscription, FeatureFlag } from '@/hooks/useSubscription';
import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface FeatureGateProps {
  feature: FeatureFlag;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasFeature, tierName } = useSubscription();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Feature Locked</h2>
        <p className="text-gray-400 mb-6">
          This feature requires a higher subscription tier. 
          You&apos;re currently on the <span className="text-purple-400 font-medium capitalize">{tierName}</span> plan.
        </p>
        <Link
          href="/settings?tab=billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade Now
        </Link>
      </div>
    </div>
  );
}

interface RequireAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireAdmin({ children, fallback }: RequireAdminProps) {
  const { isSuperadmin } = useSubscription();

  if (isSuperadmin) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400 mb-6">
          This area is restricted to platform administrators only.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default FeatureGate;
