'use client'

import { ModifierGroupList } from '@/components/modifiers/ModifierGroupList'

/**
 * Modifier Groups management page.
 *
 * Follows the same thin-page pattern as products/page.tsx — the page
 * is just a client wrapper that delegates to the list component.
 */
export default function ModifiersPage() {
  return <ModifierGroupList />
}
