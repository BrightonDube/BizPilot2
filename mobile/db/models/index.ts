/**
 * WatermelonDB Model Registry
 *
 * Central export of all model classes.
 * Used by the database initialization to register models.
 */

export { default as Product } from "./Product";
export { default as Category } from "./Category";
export { default as Order } from "./Order";
export { default as OrderItem } from "./OrderItem";
export { default as Customer } from "./Customer";
export { default as User } from "./User";
export { default as SyncQueueItem } from "./SyncQueueItem";
export { default as Setting } from "./Setting";
export { default as AssociationRule } from "./AssociationRule";
export { default as SuggestionMetric } from "./SuggestionMetric";
