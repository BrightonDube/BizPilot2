/**
 * BizPilot Mobile POS — Offline Tag Operations
 *
 * Provides CRUD for tag categories, tags, and product-tag assignments
 * using WatermelonDB. All writes are change-tracked for sync.
 *
 * Why offline tags?
 * During stock intake or menu prep, staff tag products (e.g. "Vegan",
 * "Halal", "On Special") directly on the POS tablet. This must work
 * without network connectivity and sync when online.
 */

import { database } from "@/db";
import { Q } from "@nozbe/watermelondb";
import { trackedCreate, trackedUpdate, trackedDelete } from "@/services/sync/ChangeTracker";
import type TagCategory from "@/db/models/TagCategory";
import type Tag from "@/db/models/Tag";
import type ProductTag from "@/db/models/ProductTag";

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const tagCategoriesCollection = () => database.get<TagCategory>("tag_categories");
const tagsCollection = () => database.get<Tag>("tags");
const productTagsCollection = () => database.get<ProductTag>("product_tags");

// ---------------------------------------------------------------------------
// Tag Category operations
// ---------------------------------------------------------------------------

/** List all active tag categories for a business, sorted by sort_order. */
export async function getTagCategories(
  businessId: string
): Promise<TagCategory[]> {
  return tagCategoriesCollection()
    .query(
      Q.where("business_id", businessId),
      Q.where("is_active", true),
      Q.sortBy("sort_order", Q.asc)
    )
    .fetch();
}

/** Create a new tag category offline. */
export async function createTagCategory(data: {
  businessId: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
}): Promise<TagCategory> {
  return trackedCreate("tag_categories", tagCategoriesCollection(), (record) => {
    record.businessId = data.businessId;
    record.name = data.name;
    record.slug = data.slug;
    record.description = data.description ?? null;
    record.color = data.color ?? null;
    record.icon = data.icon ?? null;
    record.sortOrder = data.sortOrder;
    record.isActive = true;
  });
}

/** Update a tag category. */
export async function updateTagCategory(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
): Promise<TagCategory> {
  const cat = await tagCategoriesCollection().find(id);
  return trackedUpdate("tag_categories", cat, () => {
    if (data.name !== undefined) cat.name = data.name;
    if (data.slug !== undefined) cat.slug = data.slug;
    if (data.description !== undefined) cat.description = data.description;
    if (data.color !== undefined) cat.color = data.color;
    if (data.icon !== undefined) cat.icon = data.icon;
    if (data.sortOrder !== undefined) cat.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) cat.isActive = data.isActive;
  });
}

// ---------------------------------------------------------------------------
// Tag operations
// ---------------------------------------------------------------------------

/** List tags within a category. */
export async function getTagsByCategory(
  categoryId: string
): Promise<Tag[]> {
  return tagsCollection()
    .query(
      Q.where("category_id", categoryId),
      Q.where("is_active", true),
      Q.sortBy("name", Q.asc)
    )
    .fetch();
}

/** List all active tags for a business (flat list). */
export async function getAllTags(businessId: string): Promise<Tag[]> {
  return tagsCollection()
    .query(
      Q.where("business_id", businessId),
      Q.where("is_active", true),
      Q.sortBy("name", Q.asc)
    )
    .fetch();
}

/** Search tags by name (case-insensitive prefix match). */
export async function searchTags(
  businessId: string,
  query: string
): Promise<Tag[]> {
  return tagsCollection()
    .query(
      Q.where("business_id", businessId),
      Q.where("is_active", true),
      Q.where("name", Q.like(`${Q.sanitizeLikeString(query)}%`))
    )
    .fetch();
}

/** Create a new tag. */
export async function createTag(data: {
  businessId: string;
  categoryId: string;
  parentTagId?: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  hierarchyLevel: number;
  hierarchyPath?: string;
}): Promise<Tag> {
  return trackedCreate("tags", tagsCollection(), (record) => {
    record.businessId = data.businessId;
    record.categoryId = data.categoryId;
    record.parentTagId = data.parentTagId ?? null;
    record.name = data.name;
    record.slug = data.slug;
    record.description = data.description ?? null;
    record.color = data.color ?? null;
    record.hierarchyLevel = data.hierarchyLevel;
    record.hierarchyPath = data.hierarchyPath ?? null;
    record.usageCount = 0;
    record.isSystemTag = false;
    record.isActive = true;
    record.autoApplyRules = null;
  });
}

/** Update a tag. */
export async function updateTag(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
  }>
): Promise<Tag> {
  const tag = await tagsCollection().find(id);
  return trackedUpdate("tags", tag, () => {
    if (data.name !== undefined) tag.name = data.name;
    if (data.slug !== undefined) tag.slug = data.slug;
    if (data.description !== undefined) tag.description = data.description;
    if (data.color !== undefined) tag.color = data.color;
    if (data.isActive !== undefined) tag.isActive = data.isActive;
  });
}

/** Soft-delete a tag (deactivate). */
export async function deactivateTag(id: string): Promise<Tag> {
  const tag = await tagsCollection().find(id);
  return trackedUpdate("tags", tag, () => {
    tag.isActive = false;
  });
}

// ---------------------------------------------------------------------------
// Product Tag operations (many-to-many)
// ---------------------------------------------------------------------------

/** Get all tags assigned to a product. */
export async function getProductTags(
  productId: string
): Promise<ProductTag[]> {
  return productTagsCollection()
    .query(Q.where("product_id", productId))
    .fetch();
}

/** Get all products with a specific tag. */
export async function getProductsByTag(
  tagId: string
): Promise<ProductTag[]> {
  return productTagsCollection()
    .query(Q.where("tag_id", tagId))
    .fetch();
}

/**
 * Assign a tag to a product.
 * Prevents duplicates by checking existing assignments first.
 */
export async function assignTagToProduct(data: {
  productId: string;
  tagId: string;
  assignedBy: string;
  assignmentSource: "manual" | "import" | "auto_rule" | "ai_suggestion";
}): Promise<ProductTag | null> {
  // Check for existing assignment to prevent duplicates
  const existing = await productTagsCollection()
    .query(
      Q.where("product_id", data.productId),
      Q.where("tag_id", data.tagId)
    )
    .fetch();

  if (existing.length > 0) {
    return existing[0];
  }

  const productTag = await trackedCreate(
    "product_tags",
    productTagsCollection(),
    (record) => {
      record.productId = data.productId;
      record.tagId = data.tagId;
      record.assignedBy = data.assignedBy;
      record.assignedAt = Date.now();
      record.assignmentSource = data.assignmentSource;
    }
  );

  // Increment usage count on the tag
  try {
    const tag = await tagsCollection().find(data.tagId);
    await trackedUpdate("tags", tag, () => {
      tag.usageCount = (tag.usageCount || 0) + 1;
    });
  } catch {
    // Tag not found locally — will sync later
  }

  return productTag;
}

/** Remove a tag from a product. */
export async function removeTagFromProduct(
  productId: string,
  tagId: string
): Promise<void> {
  const existing = await productTagsCollection()
    .query(
      Q.where("product_id", productId),
      Q.where("tag_id", tagId)
    )
    .fetch();

  for (const pt of existing) {
    await trackedDelete("product_tags", pt);
  }

  // Decrement usage count
  try {
    const tag = await tagsCollection().find(tagId);
    await trackedUpdate("tags", tag, () => {
      tag.usageCount = Math.max(0, (tag.usageCount || 1) - 1);
    });
  } catch {
    // Tag not found locally
  }
}

/**
 * Bulk-assign multiple tags to a product.
 * Useful during stock intake when staff select several tags at once.
 */
export async function bulkAssignTags(
  productId: string,
  tagIds: string[],
  assignedBy: string,
  source: "manual" | "import" | "auto_rule" | "ai_suggestion" = "manual"
): Promise<ProductTag[]> {
  const results: ProductTag[] = [];
  for (const tagId of tagIds) {
    const pt = await assignTagToProduct({
      productId,
      tagId,
      assignedBy,
      assignmentSource: source,
    });
    if (pt) results.push(pt);
  }
  return results;
}

/**
 * Replace all tags on a product with a new set.
 * Removes tags not in the new list and adds missing ones.
 */
export async function setProductTags(
  productId: string,
  tagIds: string[],
  assignedBy: string
): Promise<void> {
  const current = await getProductTags(productId);
  const currentTagIds = new Set(current.map((pt) => pt.tagId));
  const desiredTagIds = new Set(tagIds);

  for (const pt of current) {
    if (!desiredTagIds.has(pt.tagId)) {
      await removeTagFromProduct(productId, pt.tagId);
    }
  }

  for (const tagId of tagIds) {
    if (!currentTagIds.has(tagId)) {
      await assignTagToProduct({
        productId,
        tagId,
        assignedBy,
        assignmentSource: "manual",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Sync / conflict resolution helpers
//
// Why last-write-wins for tags?
// Tags are low-risk metadata. If two users rename the same tag offline,
// the most recent edit is kept. This avoids the complexity of merging
// tag names and keeps the sync path simple.
// ---------------------------------------------------------------------------

/** Apply server data to a local tag (last-write-wins). */
export async function applyServerTag(
  remoteId: string,
  data: {
    businessId: string;
    categoryId: string;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    hierarchyLevel: number;
    usageCount: number;
    isActive: boolean;
    syncedAt: number;
  }
): Promise<Tag> {
  const existing = await tagsCollection()
    .query(Q.where("remote_id", remoteId))
    .fetch();

  if (existing.length > 0) {
    const tag = existing[0];
    return trackedUpdate("tags", tag, () => {
      tag.categoryId = data.categoryId;
      tag.name = data.name;
      tag.slug = data.slug;
      tag.description = data.description ?? null;
      tag.color = data.color ?? null;
      tag.hierarchyLevel = data.hierarchyLevel;
      tag.usageCount = data.usageCount;
      tag.isActive = data.isActive;
      tag.syncedAt = data.syncedAt;
      (tag as any).isDirty = false;
    });
  }

  return trackedCreate("tags", tagsCollection(), (record) => {
    record.remoteId = remoteId;
    record.businessId = data.businessId;
    record.categoryId = data.categoryId;
    record.name = data.name;
    record.slug = data.slug;
    record.description = data.description ?? null;
    record.color = data.color ?? null;
    record.hierarchyLevel = data.hierarchyLevel;
    record.usageCount = data.usageCount;
    record.isSystemTag = false;
    record.isActive = data.isActive;
    record.syncedAt = data.syncedAt;
    (record as any).isDirty = false;
  });
}
