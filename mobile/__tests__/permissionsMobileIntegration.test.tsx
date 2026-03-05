/**
 * Integration tests for Mobile Permissions (Tasks 15.1-15.5)
 *
 * Tests cover:
 * 1. PermissionsModel — type helpers, feature checking, staleness
 * 2. syncPermissions — create/update/unchanged flows, error handling
 * 3. usePermissions hook — via store manipulation (unit-style)
 * 4. FeatureGate — render granted/locked/loading states
 *
 * Why integration-style tests?
 * These tests exercise the full chain from sync payload → local record
 * → hook → component, verifying that changes propagate correctly.
 * Pure unit tests for each module would miss integration bugs like
 * serialisation mismatches between sync and model.
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

// --- Model imports ---
import {
  hasFeature,
  isDemo,
  isActive,
  isPermissionsStale,
  parseGrantedFeatures,
  type PermissionsRecord,
  type PermissionsSyncPayload,
} from "../services/permissions/PermissionsModel";

// --- Sync imports ---
import {
  syncPermissions,
  InMemoryPermissionsStorage,
} from "../services/permissions/syncPermissions";

// --- Store import (for hook testing) ---
import { usePermissionsStore } from "../hooks/usePermissions";

// --- Component import ---
import { FeatureGate } from "../components/permissions/FeatureGate";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

// Mock usePermissions hook for FeatureGate tests
// We control the store directly via usePermissionsStore
jest.mock("@/hooks/usePermissions", () => {
  const actual = jest.requireActual("../hooks/usePermissions");
  return actual;
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const NOW = "2024-06-15T12:00:00Z";
const HOUR_MS = 60 * 60 * 1000;

function makeRecord(
  overrides: Partial<PermissionsRecord> = {}
): PermissionsRecord {
  return {
    id: "perm-1",
    businessId: "biz-001",
    grantedFeatures: JSON.stringify(["payroll", "ai_assistant", "crm"]),
    tier: "professional",
    status: "active",
    demoExpiresAt: "",
    deviceLimit: 5,
    syncedAt: NOW,
    ...overrides,
  };
}

function makePayload(
  overrides: Partial<PermissionsSyncPayload> = {}
): PermissionsSyncPayload {
  return {
    businessId: "biz-001",
    grantedFeatures: ["payroll", "ai_assistant", "crm"],
    tier: "professional",
    status: "active",
    demoExpiresAt: null,
    deviceLimit: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. PermissionsModel tests
// ---------------------------------------------------------------------------

describe("PermissionsModel", () => {
  describe("parseGrantedFeatures", () => {
    it("parses valid JSON array", () => {
      expect(parseGrantedFeatures('["a","b","c"]')).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for invalid JSON", () => {
      expect(parseGrantedFeatures("not-json")).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      expect(parseGrantedFeatures('{"key":"value"}')).toEqual([]);
    });

    it("filters out non-string items", () => {
      expect(parseGrantedFeatures('[1,"valid",null,"also"]')).toEqual([
        "valid",
        "also",
      ]);
    });

    it("returns empty array for empty string", () => {
      expect(parseGrantedFeatures("")).toEqual([]);
    });
  });

  describe("hasFeature", () => {
    it("returns true for granted feature on active subscription", () => {
      const record = makeRecord();
      expect(hasFeature(record, "payroll", NOW)).toBe(true);
    });

    it("returns false for non-granted feature", () => {
      const record = makeRecord();
      expect(hasFeature(record, "advanced_reporting", NOW)).toBe(false);
    });

    it("returns false for null record", () => {
      expect(hasFeature(null, "payroll", NOW)).toBe(false);
    });

    it("returns false for suspended subscription", () => {
      const record = makeRecord({ status: "suspended" });
      expect(hasFeature(record, "payroll", NOW)).toBe(false);
    });

    it("returns false for cancelled subscription", () => {
      const record = makeRecord({ status: "cancelled" });
      expect(hasFeature(record, "payroll", NOW)).toBe(false);
    });

    it("returns false for expired subscription", () => {
      const record = makeRecord({ status: "expired" });
      expect(hasFeature(record, "payroll", NOW)).toBe(false);
    });

    it("returns true for trial subscription", () => {
      const record = makeRecord({ status: "trial" });
      expect(hasFeature(record, "payroll", NOW)).toBe(true);
    });

    it("returns true for demo before expiry", () => {
      const record = makeRecord({
        status: "demo",
        demoExpiresAt: "2024-06-16T12:00:00Z",
      });
      expect(hasFeature(record, "payroll", NOW)).toBe(true);
    });

    it("returns false for demo after expiry", () => {
      const record = makeRecord({
        status: "demo",
        demoExpiresAt: "2024-06-14T12:00:00Z",
      });
      expect(hasFeature(record, "payroll", NOW)).toBe(false);
    });

    it("returns false for demo at exact expiry time", () => {
      const record = makeRecord({
        status: "demo",
        demoExpiresAt: NOW,
      });
      expect(hasFeature(record, "payroll", NOW)).toBe(false);
    });
  });

  describe("isDemo", () => {
    it("returns true for demo status", () => {
      expect(isDemo(makeRecord({ status: "demo" }))).toBe(true);
    });

    it("returns false for active status", () => {
      expect(isDemo(makeRecord({ status: "active" }))).toBe(false);
    });

    it("returns false for null record", () => {
      expect(isDemo(null)).toBe(false);
    });
  });

  describe("isActive", () => {
    it("returns true for active, trial, and demo", () => {
      expect(isActive(makeRecord({ status: "active" }))).toBe(true);
      expect(isActive(makeRecord({ status: "trial" }))).toBe(true);
      expect(isActive(makeRecord({ status: "demo" }))).toBe(true);
    });

    it("returns false for suspended, cancelled, expired", () => {
      expect(isActive(makeRecord({ status: "suspended" }))).toBe(false);
      expect(isActive(makeRecord({ status: "cancelled" }))).toBe(false);
      expect(isActive(makeRecord({ status: "expired" }))).toBe(false);
    });

    it("returns false for null", () => {
      expect(isActive(null)).toBe(false);
    });
  });

  describe("isPermissionsStale", () => {
    it("returns true for null record", () => {
      expect(isPermissionsStale(null)).toBe(true);
    });

    it("returns true for empty syncedAt", () => {
      expect(isPermissionsStale(makeRecord({ syncedAt: "" }))).toBe(true);
    });

    it("returns false for recently synced record", () => {
      const nowMs = new Date(NOW).getTime();
      expect(isPermissionsStale(makeRecord(), HOUR_MS * 24, nowMs)).toBe(
        false
      );
    });

    it("returns true for record synced over 24h ago", () => {
      const nowMs = new Date(NOW).getTime() + HOUR_MS * 25;
      expect(isPermissionsStale(makeRecord(), HOUR_MS * 24, nowMs)).toBe(
        true
      );
    });

    it("respects custom maxAge", () => {
      const nowMs = new Date(NOW).getTime() + HOUR_MS * 2;
      expect(isPermissionsStale(makeRecord(), HOUR_MS, nowMs)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. syncPermissions tests
// ---------------------------------------------------------------------------

describe("syncPermissions", () => {
  let storage: InMemoryPermissionsStorage;

  beforeEach(() => {
    storage = new InMemoryPermissionsStorage();
  });

  it("creates a new record on first sync", async () => {
    const payload = makePayload();
    const result = await syncPermissions(storage, payload, NOW);

    expect(result.success).toBe(true);
    expect(result.action).toBe("created");
    expect(result.record.businessId).toBe("biz-001");
    expect(result.record.tier).toBe("professional");
    expect(JSON.parse(result.record.grantedFeatures)).toEqual([
      "payroll",
      "ai_assistant",
      "crm",
    ]);
    expect(result.record.syncedAt).toBe(NOW);
  });

  it("returns unchanged when data has not changed", async () => {
    const payload = makePayload();
    await syncPermissions(storage, payload, NOW);

    const result2 = await syncPermissions(storage, payload, NOW);
    expect(result2.success).toBe(true);
    expect(result2.action).toBe("unchanged");
  });

  it("updates record when tier changes", async () => {
    const payload1 = makePayload({ tier: "basic" });
    await syncPermissions(storage, payload1, NOW);

    const payload2 = makePayload({ tier: "enterprise" });
    const result = await syncPermissions(storage, payload2, NOW);

    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");
    expect(result.record.tier).toBe("enterprise");
  });

  it("updates record when features change", async () => {
    const payload1 = makePayload({ grantedFeatures: ["payroll"] });
    await syncPermissions(storage, payload1, NOW);

    const payload2 = makePayload({
      grantedFeatures: ["payroll", "advanced_reporting"],
    });
    const result = await syncPermissions(storage, payload2, NOW);

    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");
    expect(JSON.parse(result.record.grantedFeatures)).toEqual([
      "payroll",
      "advanced_reporting",
    ]);
  });

  it("updates record when status changes", async () => {
    const payload1 = makePayload({ status: "active" });
    await syncPermissions(storage, payload1, NOW);

    const payload2 = makePayload({ status: "suspended" });
    const result = await syncPermissions(storage, payload2, NOW);

    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");
    expect(result.record.status).toBe("suspended");
  });

  it("updates record when device limit changes", async () => {
    const payload1 = makePayload({ deviceLimit: 5 });
    await syncPermissions(storage, payload1, NOW);

    const payload2 = makePayload({ deviceLimit: 10 });
    const result = await syncPermissions(storage, payload2, NOW);

    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");
    expect(result.record.deviceLimit).toBe(10);
  });

  it("handles demo expiry correctly", async () => {
    const payload = makePayload({
      status: "demo",
      demoExpiresAt: "2024-07-01T00:00:00Z",
    });
    const result = await syncPermissions(storage, payload, NOW);

    expect(result.record.status).toBe("demo");
    expect(result.record.demoExpiresAt).toBe("2024-07-01T00:00:00Z");
  });

  it("handles null demoExpiresAt as empty string", async () => {
    const payload = makePayload({ demoExpiresAt: null });
    const result = await syncPermissions(storage, payload, NOW);
    expect(result.record.demoExpiresAt).toBe("");
  });

  it("returns error result on storage failure", async () => {
    const brokenStorage = {
      findByBusinessId: async () => {
        throw new Error("DB write failed");
      },
      create: async () => {
        throw new Error("DB write failed");
      },
      update: async () => {
        throw new Error("DB write failed");
      },
    };

    const result = await syncPermissions(
      brokenStorage as any,
      makePayload(),
      NOW
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB write failed");
    expect(result.record.businessId).toBe("biz-001");
  });

  it("is idempotent — same payload produces same result", async () => {
    const payload = makePayload();

    const r1 = await syncPermissions(storage, payload, NOW);
    const r2 = await syncPermissions(storage, payload, NOW);
    const r3 = await syncPermissions(storage, payload, NOW);

    expect(r1.action).toBe("created");
    expect(r2.action).toBe("unchanged");
    expect(r3.action).toBe("unchanged");

    // All should have same record data
    expect(r1.record.tier).toBe(r2.record.tier);
    expect(r2.record.tier).toBe(r3.record.tier);
  });
});

// ---------------------------------------------------------------------------
// 3. usePermissionsStore tests (exercises the hook's backing store)
// ---------------------------------------------------------------------------

describe("usePermissionsStore", () => {
  beforeEach(() => {
    usePermissionsStore.getState().clear();
  });

  it("starts with null record", () => {
    expect(usePermissionsStore.getState().record).toBeNull();
  });

  it("setRecord updates the record and clears loading/error", () => {
    usePermissionsStore.getState().setLoading(true);
    usePermissionsStore.getState().setError("some error");

    const record = makeRecord();
    usePermissionsStore.getState().setRecord(record);

    const state = usePermissionsStore.getState();
    expect(state.record).toEqual(record);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("clear resets all state", () => {
    usePermissionsStore.getState().setRecord(makeRecord());
    usePermissionsStore.getState().clear();

    const state = usePermissionsStore.getState();
    expect(state.record).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. FeatureGate component tests
// ---------------------------------------------------------------------------

describe("FeatureGate", () => {
  beforeEach(() => {
    usePermissionsStore.getState().clear();
  });

  it("renders children when feature is granted", () => {
    usePermissionsStore.getState().setRecord(makeRecord());

    const { getByText } = render(
      <FeatureGate feature="payroll">
        <Text>Payroll Content</Text>
      </FeatureGate>
    );

    expect(getByText("Payroll Content")).toBeTruthy();
  });

  it("renders locked overlay when feature is not granted", () => {
    usePermissionsStore.getState().setRecord(makeRecord());

    const { getByText, getByTestId } = render(
      <FeatureGate feature="advanced_reporting">
        <Text>Should Not Appear</Text>
      </FeatureGate>
    );

    expect(getByTestId("feature-locked-overlay")).toBeTruthy();
    expect(getByText("Feature Locked")).toBeTruthy();
    expect(
      getByText(
        "Advanced Reporting is not available on your current plan."
      )
    ).toBeTruthy();
  });

  it("renders loading state when permissions are loading", () => {
    usePermissionsStore.getState().setLoading(true);

    const { getByTestId, getByText } = render(
      <FeatureGate feature="payroll">
        <Text>Payroll Content</Text>
      </FeatureGate>
    );

    expect(getByTestId("feature-gate-loading")).toBeTruthy();
    expect(getByText("Checking access...")).toBeTruthy();
  });

  it("renders custom fallback when provided", () => {
    usePermissionsStore.getState().setRecord(makeRecord());

    const { getByText, queryByTestId } = render(
      <FeatureGate
        feature="advanced_reporting"
        fallback={<Text>Custom Locked Message</Text>}
      >
        <Text>Should Not Appear</Text>
      </FeatureGate>
    );

    expect(getByText("Custom Locked Message")).toBeTruthy();
    expect(queryByTestId("feature-locked-overlay")).toBeNull();
  });

  it("renders locked overlay when record is null (not loaded)", () => {
    // Record is null (default after clear)
    const { getByTestId } = render(
      <FeatureGate feature="payroll">
        <Text>Payroll Content</Text>
      </FeatureGate>
    );

    expect(getByTestId("feature-locked-overlay")).toBeTruthy();
  });

  it("renders locked overlay for suspended subscription", () => {
    usePermissionsStore
      .getState()
      .setRecord(makeRecord({ status: "suspended" }));

    const { getByTestId } = render(
      <FeatureGate feature="payroll">
        <Text>Payroll Content</Text>
      </FeatureGate>
    );

    expect(getByTestId("feature-locked-overlay")).toBeTruthy();
  });

  it("uses featureDisplayName when provided", () => {
    usePermissionsStore.getState().setRecord(makeRecord());

    const { getByText } = render(
      <FeatureGate
        feature="advanced_reporting"
        featureDisplayName="Premium Reports"
      >
        <Text>Should Not Appear</Text>
      </FeatureGate>
    );

    expect(
      getByText("Premium Reports is not available on your current plan.")
    ).toBeTruthy();
  });

  it("shows upgrade button when onUpgradePress is provided", () => {
    usePermissionsStore.getState().setRecord(makeRecord());

    const mockUpgrade = jest.fn();
    const { getByTestId } = render(
      <FeatureGate
        feature="advanced_reporting"
        onUpgradePress={mockUpgrade}
      >
        <Text>Should Not Appear</Text>
      </FeatureGate>
    );

    expect(getByTestId("upgrade-button")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Full integration: sync → store → component
// ---------------------------------------------------------------------------

describe("Full integration: sync to component", () => {
  let storage: InMemoryPermissionsStorage;

  beforeEach(() => {
    storage = new InMemoryPermissionsStorage();
    usePermissionsStore.getState().clear();
  });

  it("synced permissions unlock FeatureGate", async () => {
    // Step 1: Sync permissions from server payload
    const payload = makePayload({
      grantedFeatures: ["payroll", "ai_assistant"],
    });
    const syncResult = await syncPermissions(storage, payload, NOW);
    expect(syncResult.success).toBe(true);

    // Step 2: Load into store (simulates what the app does after sync)
    usePermissionsStore.getState().setRecord(syncResult.record);

    // Step 3: FeatureGate renders children for granted feature
    const { getByText } = render(
      <FeatureGate feature="payroll">
        <Text>Payroll Active</Text>
      </FeatureGate>
    );

    expect(getByText("Payroll Active")).toBeTruthy();
  });

  it("status change to suspended locks features", async () => {
    // Initial sync — active
    const payload1 = makePayload({ status: "active" });
    const r1 = await syncPermissions(storage, payload1, NOW);
    usePermissionsStore.getState().setRecord(r1.record);

    // Feature should be available
    expect(hasFeature(r1.record, "payroll", NOW)).toBe(true);

    // Sync again with suspended status
    const payload2 = makePayload({ status: "suspended" });
    const r2 = await syncPermissions(storage, payload2, NOW);
    usePermissionsStore.getState().setRecord(r2.record);

    // Feature should now be locked
    expect(hasFeature(r2.record, "payroll", NOW)).toBe(false);

    const { getByTestId } = render(
      <FeatureGate feature="payroll">
        <Text>Should Not Appear</Text>
      </FeatureGate>
    );

    expect(getByTestId("feature-locked-overlay")).toBeTruthy();
  });

  it("permission update on next sync adds new features", async () => {
    // First sync: only payroll
    const payload1 = makePayload({ grantedFeatures: ["payroll"] });
    const r1 = await syncPermissions(storage, payload1, NOW);
    usePermissionsStore.getState().setRecord(r1.record);

    expect(hasFeature(r1.record, "payroll", NOW)).toBe(true);
    expect(hasFeature(r1.record, "ai_assistant", NOW)).toBe(false);

    // Second sync: payroll + ai_assistant
    const payload2 = makePayload({
      grantedFeatures: ["payroll", "ai_assistant"],
    });
    const r2 = await syncPermissions(storage, payload2, NOW);
    usePermissionsStore.getState().setRecord(r2.record);

    expect(hasFeature(r2.record, "payroll", NOW)).toBe(true);
    expect(hasFeature(r2.record, "ai_assistant", NOW)).toBe(true);
  });

  it("offline access works with locally stored permissions", async () => {
    // Sync once (online)
    const payload = makePayload();
    const r1 = await syncPermissions(storage, payload, NOW);
    usePermissionsStore.getState().setRecord(r1.record);

    // Simulate being offline — record is still in store
    const storedRecord = usePermissionsStore.getState().record;
    expect(storedRecord).not.toBeNull();
    expect(hasFeature(storedRecord, "payroll", NOW)).toBe(true);
    expect(hasFeature(storedRecord, "crm", NOW)).toBe(true);
  });
});
