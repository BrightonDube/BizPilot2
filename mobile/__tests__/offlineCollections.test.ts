/**
 * Unit tests for OfflineCollectionService.
 *
 * Tests the pure rule evaluation functions which don't need
 * a WatermelonDB instance. These are the core logic of the
 * smart collection system.
 */

// Mock WatermelonDB dependencies before any imports
jest.mock("@/db", () => ({
  database: {
    get: jest.fn(() => ({ query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }) })),
  },
}));
jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    where: jest.fn(),
    sortBy: jest.fn(),
    asc: "asc",
    desc: "desc",
  },
}));

import {
  evaluateRule,
  evaluateCollectionRules,
  loadCollections,
  getCollections,
  getCollectionById,
  clearCollectionCache,
  type CollectionRule,
  type SmartCollectionDef,
} from "../services/tags/OfflineCollectionService";

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

describe("evaluateRule", () => {
  const productTags = new Set(["tag-vegan", "tag-organic", "tag-local"]);

  it('"is" returns true when product has the tag', () => {
    const rule: CollectionRule = { field: "tag", operator: "is", value: "tag-vegan" };
    expect(evaluateRule(rule, productTags)).toBe(true);
  });

  it('"is" returns false when product lacks the tag', () => {
    const rule: CollectionRule = { field: "tag", operator: "is", value: "tag-halal" };
    expect(evaluateRule(rule, productTags)).toBe(false);
  });

  it('"is_not" returns true when product lacks the tag', () => {
    const rule: CollectionRule = { field: "tag", operator: "is_not", value: "tag-halal" };
    expect(evaluateRule(rule, productTags)).toBe(true);
  });

  it('"is_not" returns false when product has the tag', () => {
    const rule: CollectionRule = { field: "tag", operator: "is_not", value: "tag-vegan" };
    expect(evaluateRule(rule, productTags)).toBe(false);
  });

  it('"in" returns true when product has any of the tags', () => {
    const rule: CollectionRule = { field: "tag", operator: "in", value: ["tag-halal", "tag-vegan"] };
    expect(evaluateRule(rule, productTags)).toBe(true);
  });

  it('"in" returns false when product has none of the tags', () => {
    const rule: CollectionRule = { field: "tag", operator: "in", value: ["tag-halal", "tag-kosher"] };
    expect(evaluateRule(rule, productTags)).toBe(false);
  });

  it('"not_in" returns true when product has none of the tags', () => {
    const rule: CollectionRule = { field: "tag", operator: "not_in", value: ["tag-halal", "tag-kosher"] };
    expect(evaluateRule(rule, productTags)).toBe(true);
  });

  it('"not_in" returns false when product has any of the tags', () => {
    const rule: CollectionRule = { field: "tag", operator: "not_in", value: ["tag-vegan", "tag-kosher"] };
    expect(evaluateRule(rule, productTags)).toBe(false);
  });

  it("unknown operator returns false", () => {
    const rule = { field: "tag", operator: "unknown", value: "tag-vegan" } as any;
    expect(evaluateRule(rule, productTags)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Collection rule evaluation (AND / OR logic)
// ---------------------------------------------------------------------------

describe("evaluateCollectionRules", () => {
  const makeCollection = (
    rules: CollectionRule[],
    logic: "and" | "or" = "and"
  ): SmartCollectionDef => ({
    id: "col-1",
    remoteId: "remote-1",
    businessId: "biz-1",
    name: "Test Collection",
    slug: "test-collection",
    rules,
    ruleLogic: logic,
    isActive: true,
    autoUpdate: true,
  });

  const productTags = new Set(["tag-vegan", "tag-organic"]);

  it("AND: all rules must match", () => {
    const col = makeCollection([
      { field: "tag", operator: "is", value: "tag-vegan" },
      { field: "tag", operator: "is", value: "tag-organic" },
    ]);
    expect(evaluateCollectionRules(col, productTags)).toBe(true);
  });

  it("AND: fails if any rule doesn't match", () => {
    const col = makeCollection([
      { field: "tag", operator: "is", value: "tag-vegan" },
      { field: "tag", operator: "is", value: "tag-halal" },
    ]);
    expect(evaluateCollectionRules(col, productTags)).toBe(false);
  });

  it("OR: passes if any rule matches", () => {
    const col = makeCollection(
      [
        { field: "tag", operator: "is", value: "tag-halal" },
        { field: "tag", operator: "is", value: "tag-vegan" },
      ],
      "or"
    );
    expect(evaluateCollectionRules(col, productTags)).toBe(true);
  });

  it("OR: fails if no rules match", () => {
    const col = makeCollection(
      [
        { field: "tag", operator: "is", value: "tag-halal" },
        { field: "tag", operator: "is", value: "tag-kosher" },
      ],
      "or"
    );
    expect(evaluateCollectionRules(col, productTags)).toBe(false);
  });

  it("returns false for empty rules", () => {
    const col = makeCollection([]);
    expect(evaluateCollectionRules(col, productTags)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

describe("Collection cache", () => {
  const sampleCollections: SmartCollectionDef[] = [
    {
      id: "col-1",
      remoteId: "r-1",
      businessId: "biz-1",
      name: "Vegan Menu",
      slug: "vegan-menu",
      rules: [{ field: "tag", operator: "is", value: "tag-vegan" }],
      ruleLogic: "and",
      isActive: true,
      autoUpdate: true,
    },
    {
      id: "col-2",
      remoteId: "r-2",
      businessId: "biz-1",
      name: "Specials",
      slug: "specials",
      rules: [{ field: "tag", operator: "is", value: "tag-special" }],
      ruleLogic: "and",
      isActive: false,
      autoUpdate: false,
    },
  ];

  beforeEach(() => {
    clearCollectionCache();
  });

  it("loadCollections populates the cache", () => {
    loadCollections(sampleCollections);
    expect(getCollections()).toHaveLength(2);
  });

  it("getCollectionById finds the right collection", () => {
    loadCollections(sampleCollections);
    expect(getCollectionById("col-1")?.name).toBe("Vegan Menu");
  });

  it("getCollectionById returns undefined for missing ID", () => {
    loadCollections(sampleCollections);
    expect(getCollectionById("col-999")).toBeUndefined();
  });

  it("clearCollectionCache empties the cache", () => {
    loadCollections(sampleCollections);
    clearCollectionCache();
    expect(getCollections()).toHaveLength(0);
  });
});
