/**
 * Tests for FeatureGate component (permissions/FeatureGate.tsx).
 *
 * The component conditionally renders children based on the current
 * business subscription. These tests exercise feature checking, loading,
 * fallback rendering, and the upgrade prompt via mocked hooks.
 */

import React from "react";
import { render } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks — must be declared before component imports
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

/**
 * Mock usePermissions hook.
 *
 * Why mock instead of setting up WatermelonDB / Zustand?
 * The FeatureGate component only consumes `hasFeature` and `isLoading`
 * from the hook. Mocking the hook isolates the component logic from
 * the persistence layer, keeping tests fast and deterministic.
 */
const mockHasFeature = jest.fn<boolean, [string]>();
const mockUsePermissions = jest.fn(() => ({
  hasFeature: mockHasFeature,
  isLoading: false,
  error: null,
  record: null,
  tier: null,
  isActive: true,
  isDemo: false,
  isStale: false,
  deviceLimit: 1,
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: (...args: unknown[]) => mockUsePermissions(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FeatureGate } from "@/components/permissions/FeatureGate";
import { Text } from "react-native";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ChildContent() {
  return <Text testID="child-content">Protected content</Text>;
}

function FallbackContent() {
  return <Text testID="custom-fallback">Custom fallback</Text>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeatureGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: feature is available, not loading
    mockHasFeature.mockReturnValue(true);
    mockUsePermissions.mockReturnValue({
      hasFeature: mockHasFeature,
      isLoading: false,
      error: null,
      record: null,
      tier: null,
      isActive: true,
      isDemo: false,
      isStale: false,
      deviceLimit: 1,
    });
  });

  // 1. Renders children when user has required permission
  it("renders children when the feature is available", () => {
    mockHasFeature.mockReturnValue(true);

    const { getByTestId, queryByTestId } = render(
      <FeatureGate feature="payroll">
        <ChildContent />
      </FeatureGate>,
    );

    expect(getByTestId("child-content")).toBeTruthy();
    expect(queryByTestId("feature-locked-overlay")).toBeNull();
  });

  // 2. Hides children when user lacks permission
  it("hides children when the feature is not available", () => {
    mockHasFeature.mockReturnValue(false);

    const { queryByTestId, getByTestId } = render(
      <FeatureGate feature="payroll">
        <ChildContent />
      </FeatureGate>,
    );

    expect(queryByTestId("child-content")).toBeNull();
    expect(getByTestId("feature-locked-overlay")).toBeTruthy();
  });

  // 3. Shows fallback component when permission denied
  it("renders custom fallback when feature is locked and fallback provided", () => {
    mockHasFeature.mockReturnValue(false);

    const { getByTestId, queryByTestId } = render(
      <FeatureGate feature="ai_assistant" fallback={<FallbackContent />}>
        <ChildContent />
      </FeatureGate>,
    );

    expect(getByTestId("custom-fallback")).toBeTruthy();
    expect(queryByTestId("child-content")).toBeNull();
    // Default locked overlay should NOT appear when custom fallback is used
    expect(queryByTestId("feature-locked-overlay")).toBeNull();
  });

  // 4. Works with multiple required permissions (AND logic via feature key)
  it("checks the correct feature key for compound permissions", () => {
    // Simulate a compound feature key — FeatureGate passes the string
    // directly to hasFeature, so the service layer handles AND logic.
    mockHasFeature.mockImplementation(
      (feature: string) => feature === "inventory.advanced",
    );

    const { getByTestId } = render(
      <FeatureGate feature="inventory.advanced">
        <ChildContent />
      </FeatureGate>,
    );

    expect(getByTestId("child-content")).toBeTruthy();
    expect(mockHasFeature).toHaveBeenCalledWith("inventory.advanced");
  });

  // 5. Works with any-of permissions (different feature keys)
  it("denies access when hasFeature returns false for the given key", () => {
    // Only "basic_reports" is available, not "advanced_reports"
    mockHasFeature.mockImplementation(
      (feature: string) => feature === "basic_reports",
    );

    const { queryByTestId } = render(
      <FeatureGate feature="advanced_reports">
        <ChildContent />
      </FeatureGate>,
    );

    expect(queryByTestId("child-content")).toBeNull();
    expect(mockHasFeature).toHaveBeenCalledWith("advanced_reports");
  });

  // 6. Handles loading state
  it("shows loading placeholder while permissions are being fetched", () => {
    mockUsePermissions.mockReturnValue({
      hasFeature: mockHasFeature,
      isLoading: true,
      error: null,
      record: null,
      tier: null,
      isActive: false,
      isDemo: false,
      isStale: false,
      deviceLimit: 0,
    });

    const { getByTestId, queryByTestId } = render(
      <FeatureGate feature="payroll">
        <ChildContent />
      </FeatureGate>,
    );

    expect(getByTestId("feature-gate-loading")).toBeTruthy();
    expect(queryByTestId("child-content")).toBeNull();
    expect(queryByTestId("feature-locked-overlay")).toBeNull();
  });

  // 7. Works with subscription tier check (via feature key mapping)
  it("grants access when subscription tier permits the feature", () => {
    // The tier check is handled inside hasFeature on the service layer.
    // Here we verify that FeatureGate correctly delegates.
    mockHasFeature.mockReturnValue(true);
    mockUsePermissions.mockReturnValue({
      hasFeature: mockHasFeature,
      isLoading: false,
      error: null,
      record: null,
      tier: "premium",
      isActive: true,
      isDemo: false,
      isStale: false,
      deviceLimit: 5,
    });

    const { getByTestId } = render(
      <FeatureGate feature="ai_assistant">
        <ChildContent />
      </FeatureGate>,
    );

    expect(getByTestId("child-content")).toBeTruthy();
  });

  // 8. Shows upgrade prompt when subscription is insufficient
  it("shows upgrade button when onUpgradePress is provided and feature is locked", () => {
    mockHasFeature.mockReturnValue(false);
    const onUpgrade = jest.fn();

    const { getByTestId, getByText } = render(
      <FeatureGate
        feature="payroll"
        onUpgradePress={onUpgrade}
        featureDisplayName="Payroll"
      >
        <ChildContent />
      </FeatureGate>,
    );

    const overlay = getByTestId("feature-locked-overlay");
    expect(overlay).toBeTruthy();

    // Verify the locked overlay contains the feature name and upgrade CTA
    expect(getByText(/Payroll/)).toBeTruthy();
    expect(getByTestId("upgrade-button")).toBeTruthy();
    expect(getByText("Upgrade Plan")).toBeTruthy();
  });
});
