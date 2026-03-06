/**
 * Unit tests for OfflinePettyCashService and OfflineTagService.
 *
 * These tests validate the service modules export the expected functions.
 * Full integration tests require a WatermelonDB instance with the v7 schema,
 * which is covered by the E2E test suite. Here we verify the API surface
 * so consumers know exactly what's available.
 */

// ---------------------------------------------------------------------------
// Petty Cash Service exports
// ---------------------------------------------------------------------------

describe("OfflinePettyCashService exports", () => {
  // Use require to avoid runtime errors from WatermelonDB native modules
  // that are not available in the Jest environment
  let mod: Record<string, unknown>;

  beforeAll(() => {
    jest.mock("@/db", () => ({
      database: { get: jest.fn(() => ({ query: jest.fn(), find: jest.fn() })) },
    }));
    jest.mock("@/services/sync/ChangeTracker", () => ({
      trackedCreate: jest.fn(),
      trackedUpdate: jest.fn(),
      trackedDelete: jest.fn(),
    }));
    jest.mock("@nozbe/watermelondb", () => ({
      Q: {
        where: jest.fn(),
        sortBy: jest.fn(),
        asc: "asc",
        desc: "desc",
        like: jest.fn(),
        sanitizeLikeString: jest.fn((s: string) => s),
      },
    }));
    mod = require("../services/petty-cash/OfflinePettyCashService");
  });

  const expectedFunctions = [
    "getFunds",
    "getFundById",
    "getFundByRemoteId",
    "createFund",
    "updateFund",
    "getExpensesByFund",
    "getExpensesByStatus",
    "createExpense",
    "attachReceipt",
    "updateExpenseStatus",
    "getCategories",
    "upsertCategory",
    "applyServerFund",
  ];

  expectedFunctions.forEach((fnName) => {
    it(`exports "${fnName}" as a function`, () => {
      expect(typeof mod[fnName]).toBe("function");
    });
  });
});

// ---------------------------------------------------------------------------
// Tag Service exports
// ---------------------------------------------------------------------------

describe("OfflineTagService exports", () => {
  let mod: Record<string, unknown>;

  beforeAll(() => {
    jest.mock("@/db", () => ({
      database: { get: jest.fn(() => ({ query: jest.fn(), find: jest.fn() })) },
    }));
    jest.mock("@/services/sync/ChangeTracker", () => ({
      trackedCreate: jest.fn(),
      trackedUpdate: jest.fn(),
      trackedDelete: jest.fn(),
    }));
    jest.mock("@nozbe/watermelondb", () => ({
      Q: {
        where: jest.fn(),
        sortBy: jest.fn(),
        asc: "asc",
        desc: "desc",
        like: jest.fn(),
        sanitizeLikeString: jest.fn((s: string) => s),
      },
    }));
    mod = require("../services/tags/OfflineTagService");
  });

  const expectedFunctions = [
    "getTagCategories",
    "createTagCategory",
    "updateTagCategory",
    "getTagsByCategory",
    "getAllTags",
    "searchTags",
    "createTag",
    "updateTag",
    "deactivateTag",
    "getProductTags",
    "getProductsByTag",
    "assignTagToProduct",
    "removeTagFromProduct",
    "bulkAssignTags",
    "setProductTags",
    "applyServerTag",
  ];

  expectedFunctions.forEach((fnName) => {
    it(`exports "${fnName}" as a function`, () => {
      expect(typeof mod[fnName]).toBe("function");
    });
  });
});
