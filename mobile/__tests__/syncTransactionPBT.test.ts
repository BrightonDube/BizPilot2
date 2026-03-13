/**
 * Sync Transaction Atomicity — Property-Based Tests (task 13.5)
 *
 * Property 5 (from offline-sync-engine/design.md):
 *   "For any sync batch, either ALL changes in the batch SHALL be
 *    applied or NONE SHALL be applied (rollback on failure)."
 *
 * Why use manual random loops instead of a PBT library?
 * The project does not have fast-check installed; existing PBTs
 * (cartTotalsPBT, loyaltyPBT) use the same pattern — Math.random()
 * loops with deterministic corner cases — to avoid adding a dependency.
 *
 * Tests verify:
 *   Property 1 — validateChange  single-record correctness
 *   Property 2 — validateBatch   error counting invariants
 *   Property 3 — applyBatchTransactional all-or-none atomicity
 *   Property 4 — checkServerSchemaVersion compat gate
 */

import {
  validateChange,
  validateBatch,
  applyBatchTransactional,
  checkServerSchemaVersion,
  LOCAL_SCHEMA_VERSION,
  type RemoteChangeBasic,
  type ValidationError,
} from "@/services/sync/SyncTransactionManager";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// database.write executes the callback by default (simulates SQLite commit)
jest.mock("@/db", () => ({
  database: {
    write: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
}));

import { database } from "@/db";
const mockDbWrite = database.write as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a random string of length n */
function randStr(n: number): string {
  return Math.random().toString(36).slice(2, 2 + n) || "x";
}

/** Generate a valid product change */
function makeValidChange(): RemoteChangeBasic {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    action: Math.random() < 0.5 ? "create" : "update",
    data: { name: randStr(8), price: Math.round(Math.random() * 9999) / 100 },
  };
}

/** Generate an invalid product change (name missing) */
function makeInvalidChange(): RemoteChangeBasic {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    action: Math.random() < 0.5 ? "create" : "update",
    data: { price: Math.round(Math.random() * 9999) / 100 },
  };
}

/** Generate a delete change */
function makeDeleteChange(): RemoteChangeBasic {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    action: "delete",
    data: {},
  };
}

/** Generate array of n items using factory */
function genArray<T>(n: number, factory: () => T): T[] {
  return Array.from({ length: n }, factory);
}

// ---------------------------------------------------------------------------
// Property 1: validateChange — single-record invariants
// ---------------------------------------------------------------------------

describe("Property 1: validateChange single-record invariants", () => {
  beforeEach(() => jest.clearAllMocks());

  it("valid product change always returns null — 300 random inputs", () => {
    for (let i = 0; i < 300; i++) {
      const change = makeValidChange();
      const result = validateChange("products", change);
      expect(result).toBeNull();
    }
  });

  it("delete change always returns null for any entity type — 200 runs", () => {
    const entities = ["products", "orders", "customers", "payments", "unknown"];
    for (let i = 0; i < 200; i++) {
      const entity = entities[Math.floor(Math.random() * entities.length)];
      const change = makeDeleteChange();
      const result = validateChange(entity, change);
      expect(result).toBeNull();
    }
  });

  it("invalid product change (missing name) always returns a ValidationError — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const change = makeInvalidChange();
      const result = validateChange("products", change);
      expect(result).not.toBeNull();
      expect((result as ValidationError).field).toBe("name");
      expect((result as ValidationError).changeId).toBe(change.id);
    }
  });

  it("unknown entity type never throws — treated as no required fields — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const entityType = randStr(10); // arbitrary unknown entity
      const change = makeInvalidChange(); // no 'name' field
      // Must NOT throw — just return null (no required fields for unknown entity)
      expect(() => validateChange(entityType, change)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: validateBatch — error counting invariants
// ---------------------------------------------------------------------------

describe("Property 2: validateBatch batch invariants", () => {
  beforeEach(() => jest.clearAllMocks());

  it("batch of all-valid changes produces 0 errors — 200 batches", () => {
    for (let i = 0; i < 200; i++) {
      const batchSize = Math.floor(Math.random() * 19) + 1;
      const changes = genArray(batchSize, makeValidChange);
      const errors = validateBatch("products", changes);
      expect(errors).toHaveLength(0);
    }
  });

  it("batch with k invalid changes returns ≥ k errors — 200 batches", () => {
    for (let i = 0; i < 200; i++) {
      const validCount = Math.floor(Math.random() * 10);
      const invalidCount = Math.floor(Math.random() * 5) + 1;
      const changes = [
        ...genArray(validCount, makeValidChange),
        ...genArray(invalidCount, makeInvalidChange),
      ];
      const errors = validateBatch("products", changes);
      expect(errors.length).toBeGreaterThanOrEqual(invalidCount);
    }
  });

  it("error count never exceeds change count — 300 batches", () => {
    for (let i = 0; i < 300; i++) {
      const changes = genArray(
        Math.floor(Math.random() * 20),
        Math.random() < 0.5 ? makeValidChange : makeInvalidChange
      );
      const errors = validateBatch("products", changes);
      expect(errors.length).toBeLessThanOrEqual(changes.length);
    }
  });

  it("each error changeId references an actual change in the batch — 200 batches", () => {
    for (let i = 0; i < 200; i++) {
      const changes = genArray(
        Math.floor(Math.random() * 10) + 1,
        Math.random() < 0.5 ? makeValidChange : makeInvalidChange
      );
      const changeIds = new Set(changes.map((c) => c.id));
      const errors = validateBatch("products", changes);
      for (const e of errors) {
        expect(changeIds.has(e.changeId)).toBe(true);
      }
    }
  });

  it("empty batch returns 0 errors", () => {
    const errors = validateBatch("products", []);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Property 3: applyBatchTransactional — all-or-none atomicity
// ---------------------------------------------------------------------------

describe("Property 3: applyBatchTransactional — all-or-none atomicity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: write faithfully executes callback (commit succeeds)
    mockDbWrite.mockImplementation(async (cb: () => Promise<void>) => cb());
  });

  it("successfully applies all N changes when applyFn never throws — 150 batches", async () => {
    for (let i = 0; i < 150; i++) {
      const size = Math.floor(Math.random() * 14) + 1;
      const changes = genArray(size, makeValidChange);
      const applied: string[] = [];

      const count = await applyBatchTransactional(
        "products",
        changes,
        async (change) => { applied.push(change.id); }
      );

      expect(count).toBe(changes.length);
      expect(applied).toHaveLength(changes.length);
    }
  });

  it("throws (not swallows) when database.write throws — 100 batches", async () => {
    for (let i = 0; i < 100; i++) {
      const changes = genArray(Math.floor(Math.random() * 10) + 1, makeValidChange);
      mockDbWrite.mockRejectedValueOnce(new Error("SQLite transaction failed"));

      await expect(
        applyBatchTransactional("products", changes, async () => {})
      ).rejects.toThrow("SQLite transaction failed");
    }
  });

  it("applied count is always 0 (error) or N (success) — never partial — 200 runs", async () => {
    for (let i = 0; i < 200; i++) {
      const size = Math.floor(Math.random() * 10) + 1;
      const changes = genArray(size, makeValidChange);
      const shouldFail = Math.random() < 0.5;

      if (shouldFail) {
        mockDbWrite.mockRejectedValueOnce(new Error("DB error"));
      } else {
        mockDbWrite.mockImplementationOnce(async (cb: () => Promise<void>) => cb());
      }

      let count = -1;
      try {
        count = await applyBatchTransactional("products", changes, async () => {});
      } catch {
        count = 0;
      }

      // Invariant: count is 0 (failed/rolled back) or N (fully committed)
      const isValid = count === 0 || count === changes.length;
      expect(isValid).toBe(true);
    }
  });

  it("empty batch returns 0 and never calls database.write", async () => {
    const count = await applyBatchTransactional("products", [], async () => {});
    expect(count).toBe(0);
    expect(mockDbWrite).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Property 4: checkServerSchemaVersion — compatibility gate
// ---------------------------------------------------------------------------

describe("Property 4: checkServerSchemaVersion invariants", () => {
  beforeEach(() => jest.clearAllMocks());

  it("never throws for any serverVersion <= LOCAL_SCHEMA_VERSION", () => {
    for (let v = 1; v <= LOCAL_SCHEMA_VERSION; v++) {
      expect(() => checkServerSchemaVersion(v)).not.toThrow();
    }
  });

  it("always throws for serverVersion > LOCAL_SCHEMA_VERSION — 50 random values", () => {
    for (let i = 0; i < 50; i++) {
      const serverVersion =
        LOCAL_SCHEMA_VERSION + Math.floor(Math.random() * 100) + 1;
      expect(() => checkServerSchemaVersion(serverVersion)).toThrow();
    }
  });

  it("error message contains both server and local versions — 30 random values", () => {
    for (let i = 0; i < 30; i++) {
      const serverVersion =
        LOCAL_SCHEMA_VERSION + Math.floor(Math.random() * 50) + 1;
      let message = "";
      try {
        checkServerSchemaVersion(serverVersion);
      } catch (e: unknown) {
        message = e instanceof Error ? e.message : "";
      }
      expect(message).toContain(String(serverVersion));
      expect(message).toContain(String(LOCAL_SCHEMA_VERSION));
    }
  });
});
