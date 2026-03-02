/**
 * Frontend API client for modifier and combo deal operations.
 *
 * Centralises all HTTP calls so that pages/components never call
 * apiClient directly.  This makes it easy to:
 * - Add caching or optimistic updates later
 * - Swap the transport layer (e.g., for React Native)
 * - Keep type definitions co-located with the API calls
 *
 * Pattern matches admin-api.ts and other existing API modules.
 */

import { apiClient } from './api';

// ---------------------------------------------------------------------------
// Type definitions (mirror backend Pydantic schemas)
// ---------------------------------------------------------------------------

/** Modifier group as returned by the API. */
export interface ModifierGroup {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  selection_type: string | null;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
  modifiers: Modifier[];
}

/** A single modifier option within a group. */
export interface Modifier {
  id: string;
  group_id: string;
  business_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

/** Availability rule for a modifier. */
export interface ModifierAvailability {
  id: string;
  modifier_id: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  location_id: string | null;
  is_available: boolean;
}

/** Product ↔ modifier group link. */
export interface ProductModifierGroupLink {
  id: string;
  product_id: string;
  modifier_group_id: string;
  sort_order: number;
}

/** Combo deal component. */
export interface ComboComponent {
  id: string;
  combo_deal_id: string;
  name: string;
  component_type: 'fixed' | 'choice';
  fixed_product_id: string | null;
  allowed_category_ids: string[] | null;
  allowed_product_ids: string[] | null;
  quantity: number;
  sort_order: number;
  allow_modifiers: boolean;
}

/** Combo deal as returned by the API. */
export interface ComboDeal {
  id: string;
  business_id: string;
  name: string;
  display_name: string;
  description: string | null;
  image_url: string | null;
  combo_price: number;
  original_price: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  location_ids: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  components: ComboComponent[];
}

/** Paginated list response (shared shape). */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Create / Update payloads
// ---------------------------------------------------------------------------

export interface CreateModifierGroupPayload {
  name: string;
  selection_type?: string;
  is_required?: boolean;
  min_selections?: number;
  max_selections?: number | null;
  description?: string | null;
}

export interface UpdateModifierGroupPayload {
  name?: string;
  selection_type?: string;
  is_required?: boolean;
  min_selections?: number;
  max_selections?: number | null;
  description?: string | null;
  sort_order?: number;
}

export interface CreateModifierPayload {
  name: string;
  pricing_type?: string;
  price_adjustment?: number;
  is_default?: boolean;
  sort_order?: number;
}

export interface UpdateModifierPayload {
  name?: string;
  pricing_type?: string;
  price_adjustment?: number;
  is_default?: boolean;
  is_available?: boolean;
  sort_order?: number;
}

export interface CreateAvailabilityRulePayload {
  modifier_id: string;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location_id?: string | null;
  is_available?: boolean;
}

export interface UpdateAvailabilityRulePayload {
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location_id?: string | null;
  is_available?: boolean;
}

export interface CreateComboDealPayload {
  name: string;
  display_name: string;
  description?: string | null;
  image_url?: string | null;
  combo_price: number;
  original_price: number;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  location_ids?: string[] | null;
  sort_order?: number;
  components?: CreateComboComponentPayload[];
}

export interface UpdateComboDealPayload {
  name?: string;
  display_name?: string;
  description?: string | null;
  image_url?: string | null;
  combo_price?: number;
  original_price?: number;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  location_ids?: string[] | null;
  sort_order?: number;
}

export interface CreateComboComponentPayload {
  name: string;
  component_type: 'fixed' | 'choice';
  fixed_product_id?: string | null;
  allowed_category_ids?: string[] | null;
  allowed_product_ids?: string[] | null;
  quantity?: number;
  sort_order?: number;
  allow_modifiers?: boolean;
}

export interface UpdateComboComponentPayload {
  name?: string;
  component_type?: 'fixed' | 'choice';
  fixed_product_id?: string | null;
  allowed_category_ids?: string[] | null;
  allowed_product_ids?: string[] | null;
  quantity?: number;
  sort_order?: number;
  allow_modifiers?: boolean;
}

// ---------------------------------------------------------------------------
// Modifier Group API
// ---------------------------------------------------------------------------

export const modifierApi = {
  // ── Groups ──────────────────────────────────────────────────

  async listGroups(): Promise<ModifierGroup[]> {
    const { data } = await apiClient.get<ModifierGroup[]>('/addons/groups');
    return data;
  },

  async getGroup(groupId: string): Promise<ModifierGroup> {
    const { data } = await apiClient.get<ModifierGroup>(`/addons/groups/${groupId}`);
    return data;
  },

  async createGroup(payload: CreateModifierGroupPayload): Promise<ModifierGroup> {
    const { data } = await apiClient.post<ModifierGroup>('/addons/groups', payload);
    return data;
  },

  async updateGroup(groupId: string, payload: UpdateModifierGroupPayload): Promise<ModifierGroup> {
    const { data } = await apiClient.put<ModifierGroup>(`/addons/groups/${groupId}`, payload);
    return data;
  },

  async deleteGroup(groupId: string): Promise<void> {
    await apiClient.delete(`/addons/groups/${groupId}`);
  },

  // ── Modifiers within a group ────────────────────────────────

  async addModifier(groupId: string, payload: CreateModifierPayload): Promise<Modifier> {
    const { data } = await apiClient.post<Modifier>(`/addons/groups/${groupId}/modifiers`, payload);
    return data;
  },

  async updateModifier(modifierId: string, payload: UpdateModifierPayload): Promise<Modifier> {
    const { data } = await apiClient.put<Modifier>(`/addons/modifiers/${modifierId}`, payload);
    return data;
  },

  async deleteModifier(modifierId: string): Promise<void> {
    await apiClient.delete(`/addons/modifiers/${modifierId}`);
  },

  // ── Product ↔ Group assignments ────────────────────────────

  async getProductModifiers(productId: string): Promise<ModifierGroup[]> {
    const { data } = await apiClient.get<ModifierGroup[]>(`/addons/products/${productId}/modifiers`);
    return data;
  },

  async assignGroupToProduct(
    productId: string,
    modifierGroupId: string,
    sortOrder: number = 0,
  ): Promise<ProductModifierGroupLink> {
    const { data } = await apiClient.post<ProductModifierGroupLink>(
      `/addons/products/${productId}/modifier-groups`,
      { modifier_group_id: modifierGroupId, sort_order: sortOrder },
    );
    return data;
  },

  async removeGroupFromProduct(productId: string, groupId: string): Promise<void> {
    await apiClient.delete(`/addons/products/${productId}/modifier-groups/${groupId}`);
  },

  // ── Availability rules ─────────────────────────────────────

  async listAvailabilityRules(modifierId: string): Promise<ModifierAvailability[]> {
    const { data } = await apiClient.get<ModifierAvailability[]>(
      `/modifiers/${modifierId}/availability`,
    );
    return data;
  },

  async createAvailabilityRule(payload: CreateAvailabilityRulePayload): Promise<ModifierAvailability> {
    const modifierId = payload.modifier_id;
    const { data } = await apiClient.post<ModifierAvailability>(
      `/modifiers/${modifierId}/availability`,
      payload,
    );
    return data;
  },

  async updateAvailabilityRule(
    ruleId: string,
    payload: UpdateAvailabilityRulePayload,
  ): Promise<ModifierAvailability> {
    const { data } = await apiClient.put<ModifierAvailability>(
      `/modifiers/availability/${ruleId}`,
      payload,
    );
    return data;
  },

  async deleteAvailabilityRule(ruleId: string): Promise<void> {
    await apiClient.delete(`/modifiers/availability/${ruleId}`);
  },

  async checkAvailability(
    modifierId: string,
    locationId?: string,
  ): Promise<{ modifier_id: string; is_available: boolean }> {
    const params = locationId ? { location_id: locationId } : {};
    const { data } = await apiClient.get(`/modifiers/${modifierId}/check-availability`, { params });
    return data;
  },

  async eightySixModifier(modifierId: string, locationId?: string): Promise<void> {
    const params = locationId ? { location_id: locationId } : {};
    await apiClient.post(`/modifiers/${modifierId}/eighty-six`, null, { params });
  },

  async unEightySixModifier(modifierId: string, locationId?: string): Promise<void> {
    const params = locationId ? { location_id: locationId } : {};
    await apiClient.delete(`/modifiers/${modifierId}/eighty-six`, { params });
  },
};

// ---------------------------------------------------------------------------
// Combo Deal API
// ---------------------------------------------------------------------------

export const comboApi = {
  // ── Deals ──────────────────────────────────────────────────

  async listDeals(params?: {
    page?: number;
    per_page?: number;
    is_active?: boolean;
  }): Promise<PaginatedResponse<ComboDeal>> {
    const { data } = await apiClient.get<PaginatedResponse<ComboDeal>>('/combos', { params });
    return data;
  },

  async listActiveDeals(locationId?: string): Promise<ComboDeal[]> {
    const params = locationId ? { location_id: locationId } : {};
    const { data } = await apiClient.get<ComboDeal[]>('/combos/active', { params });
    return data;
  },

  async getDeal(comboId: string): Promise<ComboDeal> {
    const { data } = await apiClient.get<ComboDeal>(`/combos/${comboId}`);
    return data;
  },

  async createDeal(payload: CreateComboDealPayload): Promise<ComboDeal> {
    const { data } = await apiClient.post<ComboDeal>('/combos', payload);
    return data;
  },

  async updateDeal(comboId: string, payload: UpdateComboDealPayload): Promise<ComboDeal> {
    const { data } = await apiClient.put<ComboDeal>(`/combos/${comboId}`, payload);
    return data;
  },

  async deleteDeal(comboId: string): Promise<void> {
    await apiClient.delete(`/combos/${comboId}`);
  },

  // ── Components ─────────────────────────────────────────────

  async listComponents(comboId: string): Promise<ComboComponent[]> {
    const { data } = await apiClient.get<ComboComponent[]>(`/combos/${comboId}/components`);
    return data;
  },

  async addComponent(comboId: string, payload: CreateComboComponentPayload): Promise<ComboComponent> {
    const { data } = await apiClient.post<ComboComponent>(`/combos/${comboId}/components`, payload);
    return data;
  },

  async updateComponent(
    componentId: string,
    payload: UpdateComboComponentPayload,
  ): Promise<ComboComponent> {
    const { data } = await apiClient.put<ComboComponent>(
      `/combos/components/${componentId}`,
      payload,
    );
    return data;
  },

  async deleteComponent(componentId: string): Promise<void> {
    await apiClient.delete(`/combos/components/${componentId}`);
  },

  async validateSelection(
    comboId: string,
    selections: { component_id: string; selected_product_id: string }[],
  ): Promise<{ combo_id: string; is_valid: boolean; errors: string[] }> {
    const { data } = await apiClient.post(`/combos/${comboId}/validate`, selections);
    return data;
  },
};
