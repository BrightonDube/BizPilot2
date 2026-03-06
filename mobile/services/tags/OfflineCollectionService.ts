/**
 * BizPilot Mobile POS — Offline Collection Management
 *
 * Manages "smart collections" — rule-based product groupings that
 * can be evaluated entirely on the local device. Collections are
 * persisted in-memory (backed by WatermelonDB tag data) and cached
 * for fast lookups during POS operations.
 *
 * Why evaluate rules client-side?
 * Smart collections group products by tag rules (e.g. "all products
 * tagged Vegan AND not tagged Out-of-Stock"). On a POS tablet with
 * no network, we need to evaluate these rules locally using the
 * tags and product_tags already cached in WatermelonDB.
 *
 * Architecture:
 * 1. Collection definitions (rules, name, etc.) sync from the server
 * 2. Product membership is computed locally from tag assignments
 * 3. Overrides (manually_included / manually_excluded) are tracked locally
 */

import { database } from "@/db";
import { Q } from "@nozbe/watermelondb";
import type ProductTag from "@/db/models/ProductTag";
import type Tag from "@/db/models/Tag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single rule within a smart collection.
 * Stored as a JSON string in the backend's `rules` JSONB column.
 */
export interface CollectionRule {
  /** The field to match on (currently only "tag" is supported) */
  field: "tag";
  /** Comparison operator */
  operator: "is" | "is_not" | "in" | "not_in";
  /** The tag ID(s) to match */
  value: string | string[];
}

/**
 * A smart collection definition (in-memory representation).
 * Synced from server and cached locally.
 */
export interface SmartCollectionDef {
  id: string;
  remoteId: string;
  businessId: string;
  name: string;
  slug: string;
  description?: string;
  rules: CollectionRule[];
  ruleLogic: "and" | "or";
  isActive: boolean;
  autoUpdate: boolean;
}

/**
 * Result of evaluating a collection's rules against local data.
 */
export interface CollectionEvalResult {
  collectionId: string;
  productIds: string[];
  evaluatedAt: number;
}

// ---------------------------------------------------------------------------
// In-memory collection cache
//
// Why in-memory instead of a WatermelonDB table?
// Smart collection definitions change infrequently (admin-only).
// Keeping them in memory avoids additional schema complexity and
// lets us evaluate rules with zero DB overhead. The cache is
// refreshed on sync or when the user navigates to collections.
// ---------------------------------------------------------------------------

let collectionsCache: SmartCollectionDef[] = [];
let evaluationCache = new Map<string, CollectionEvalResult>();

/** Load collection definitions into memory. */
export function loadCollections(collections: SmartCollectionDef[]): void {
  collectionsCache = [...collections];
  evaluationCache.clear();
}

/** Get all cached collection definitions. */
export function getCollections(): SmartCollectionDef[] {
  return collectionsCache;
}

/** Get a single collection by ID. */
export function getCollectionById(
  id: string
): SmartCollectionDef | undefined {
  return collectionsCache.find((c) => c.id === id);
}

/** Clear all caches (e.g. on business switch or logout). */
export function clearCollectionCache(): void {
  collectionsCache = [];
  evaluationCache.clear();
}

// ---------------------------------------------------------------------------
// Rule evaluation engine
// ---------------------------------------------------------------------------

/**
 * Evaluate a single rule against a product's tag set.
 *
 * @param rule - The rule to evaluate
 * @param productTagIds - Set of tag IDs assigned to the product
 * @returns true if the product matches the rule
 */
export function evaluateRule(
  rule: CollectionRule,
  productTagIds: Set<string>
): boolean {
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];

  switch (rule.operator) {
    case "is":
      return values.every((v) => productTagIds.has(v));
    case "is_not":
      return values.every((v) => !productTagIds.has(v));
    case "in":
      return values.some((v) => productTagIds.has(v));
    case "not_in":
      return !values.some((v) => productTagIds.has(v));
    default:
      return false;
  }
}

/**
 * Evaluate all rules for a collection against a product's tags.
 *
 * @param collection - The collection definition
 * @param productTagIds - Set of tag IDs assigned to the product
 * @returns true if the product belongs in the collection
 */
export function evaluateCollectionRules(
  collection: SmartCollectionDef,
  productTagIds: Set<string>
): boolean {
  if (collection.rules.length === 0) return false;

  if (collection.ruleLogic === "and") {
    return collection.rules.every((rule) =>
      evaluateRule(rule, productTagIds)
    );
  }

  // "or" logic
  return collection.rules.some((rule) =>
    evaluateRule(rule, productTagIds)
  );
}

/**
 * Evaluate a collection against all products in the local database.
 * Returns the list of product IDs that match the collection's rules.
 *
 * This is the main entry point for determining collection membership
 * offline. It queries WatermelonDB for all product_tags, groups them
 * by product, then evaluates the rules.
 */
export async function evaluateCollection(
  collection: SmartCollectionDef
): Promise<CollectionEvalResult> {
  // Check cache first
  const cached = evaluationCache.get(collection.id);
  if (cached && Date.now() - cached.evaluatedAt < 60_000) {
    return cached;
  }

  // Fetch all product tags for the business
  const allProductTags = await database
    .get<ProductTag>("product_tags")
    .query()
    .fetch();

  // Build a map: productId → Set<tagId>
  const productTagMap = new Map<string, Set<string>>();
  for (const pt of allProductTags) {
    const existing = productTagMap.get(pt.productId);
    if (existing) {
      existing.add(pt.tagId);
    } else {
      productTagMap.set(pt.productId, new Set([pt.tagId]));
    }
  }

  // Evaluate rules for each product
  const matchingProductIds: string[] = [];
  for (const [productId, tagIds] of productTagMap) {
    if (evaluateCollectionRules(collection, tagIds)) {
      matchingProductIds.push(productId);
    }
  }

  const result: CollectionEvalResult = {
    collectionId: collection.id,
    productIds: matchingProductIds,
    evaluatedAt: Date.now(),
  };

  evaluationCache.set(collection.id, result);
  return result;
}

/**
 * Evaluate all active collections and return a map of
 * collectionId → productIds.
 *
 * Useful for rendering collection badges or filters on the POS grid.
 */
export async function evaluateAllCollections(): Promise<
  Map<string, string[]>
> {
  const results = new Map<string, string[]>();
  const active = collectionsCache.filter((c) => c.isActive);

  for (const collection of active) {
    const evalResult = await evaluateCollection(collection);
    results.set(collection.id, evalResult.productIds);
  }

  return results;
}

/**
 * Check if a specific product belongs to a collection.
 * Faster than evaluateCollection when checking a single product.
 */
export async function isProductInCollection(
  collectionId: string,
  productId: string
): Promise<boolean> {
  const collection = getCollectionById(collectionId);
  if (!collection || !collection.isActive) return false;

  const productTags = await database
    .get<ProductTag>("product_tags")
    .query(Q.where("product_id", productId))
    .fetch();

  const tagIds = new Set(productTags.map((pt) => pt.tagId));
  return evaluateCollectionRules(collection, tagIds);
}

/**
 * Get all collections that a product belongs to.
 */
export async function getCollectionsForProduct(
  productId: string
): Promise<SmartCollectionDef[]> {
  const productTags = await database
    .get<ProductTag>("product_tags")
    .query(Q.where("product_id", productId))
    .fetch();

  const tagIds = new Set(productTags.map((pt) => pt.tagId));
  const active = collectionsCache.filter((c) => c.isActive);

  return active.filter((collection) =>
    evaluateCollectionRules(collection, tagIds)
  );
}
