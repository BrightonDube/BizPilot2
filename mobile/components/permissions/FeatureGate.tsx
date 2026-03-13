/**
 * BizPilot Mobile POS — FeatureGate Component (Task 15.4)
 *
 * Conditionally renders children based on whether a feature is
 * available in the current business subscription. Shows a locked
 * overlay when the feature is not available.
 *
 * Why a wrapper component instead of an `if` check?
 * 1. Declarative — `<FeatureGate feature="payroll">` reads better
 *    than `if (hasFeature("payroll"))` scattered across screens
 * 2. Consistent locked UI — every gated feature shows the same
 *    upgrade prompt, avoiding inconsistent "access denied" patterns
 * 3. Loading state — the gate handles the brief period before
 *    permissions are loaded, showing a placeholder instead of a flash
 *
 * Why React.memo?
 * FeatureGate may wrap entire screen sections. Without memo,
 * any parent re-render would re-evaluate the gate and all its
 * children even when permissions haven't changed. The memo ensures
 * re-renders only occur when the feature prop or permission state changes.
 */

import React, { type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { usePermissions } from "@/hooks/usePermissions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeatureGateProps {
  /** The feature key to check (e.g., "payroll", "ai_assistant") */
  feature: string;
  /** Content to render when the feature is available */
  children: ReactNode;
  /**
   * Optional fallback to render when the feature is locked.
   * If not provided, the default LockedOverlay is shown.
   */
  fallback?: ReactNode;
  /**
   * Optional callback when the "Upgrade" button is pressed.
   * If not provided, the button is still shown but does nothing
   * (navigation should be handled by the parent screen).
   */
  onUpgradePress?: () => void;
  /**
   * Human-readable feature name for the locked overlay.
   * Defaults to the feature key with formatting applied.
   */
  featureDisplayName?: string;
}

// ---------------------------------------------------------------------------
// LockedOverlay — shown when a feature is not available
// ---------------------------------------------------------------------------

interface LockedOverlayProps {
  featureName: string;
  onUpgradePress?: () => void;
}

/**
 * Locked feature overlay with upgrade prompt.
 *
 * Why a separate component instead of inline JSX?
 * The overlay has its own styles and may be reused independently
 * (e.g., in a settings screen showing all locked features).
 */
const LockedOverlay = React.memo(function LockedOverlay({
  featureName,
  onUpgradePress,
}: LockedOverlayProps) {
  return (
    <View style={styles.lockedContainer} testID="feature-locked-overlay">
      <View style={styles.lockIconContainer}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>
      <Text style={styles.lockedTitle}>Feature Locked</Text>
      <Text style={styles.lockedMessage}>
        {featureName} is not available on your current plan.
      </Text>
      <Text style={styles.lockedSubtext}>
        Upgrade your subscription to unlock this feature.
      </Text>
      {onUpgradePress && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgradePress}
          testID="upgrade-button"
          accessibilityRole="button"
          accessibilityLabel={`Upgrade to access ${featureName}`}
        >
          <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Loading placeholder
// ---------------------------------------------------------------------------

const LoadingPlaceholder = React.memo(function LoadingPlaceholder() {
  return (
    <View style={styles.loadingContainer} testID="feature-gate-loading">
      <ActivityIndicator size="small" color="#3b82f6" />
      <Text style={styles.loadingText}>Checking access...</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// FeatureGate component
// ---------------------------------------------------------------------------

/**
 * Format a feature key into a human-readable name.
 * e.g., "ai_assistant" → "AI Assistant", "payroll" → "Payroll"
 */
function formatFeatureName(feature: string): string {
  return feature
    .split("_")
    .map((word) => {
      // Special cases for common abbreviations
      if (word.toLowerCase() === "ai") return "AI";
      if (word.toLowerCase() === "api") return "API";
      if (word.toLowerCase() === "pos") return "POS";
      if (word.toLowerCase() === "crm") return "CRM";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function FeatureGateInner({
  feature,
  children,
  fallback,
  onUpgradePress,
  featureDisplayName,
}: FeatureGateProps): React.JSX.Element {
  const { hasFeature, isLoading } = usePermissions();

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return <LoadingPlaceholder />;
  }

  // Feature is available — render children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Feature is locked — show fallback or default overlay
  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  const displayName = featureDisplayName ?? formatFeatureName(feature);

  return (
    <LockedOverlay featureName={displayName} onUpgradePress={onUpgradePress} />
  );
}

/**
 * Memoized FeatureGate component.
 *
 * Why memo at this level?
 * The inner component already uses usePermissions which returns
 * memoized values. The outer memo prevents re-renders when the
 * parent re-renders but the gate's props haven't changed.
 */
export const FeatureGate = React.memo(FeatureGateInner);

// ---------------------------------------------------------------------------
// Styles
//
// Why StyleSheet.create instead of inline styles?
// StyleSheet.create validates styles at creation time and uses
// numeric IDs internally, which is faster than passing new object
// references on every render. For a POS app, every millisecond counts.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    minHeight: 200,
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  lockIcon: {
    fontSize: 28,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 8,
  },
  lockedMessage: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 4,
  },
  lockedSubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 160,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 100,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },
});
