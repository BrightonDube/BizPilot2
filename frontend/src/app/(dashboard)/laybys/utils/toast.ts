/**
 * toast.ts
 * Simple toast notification utility for the layby feature.
 * Provides a consistent way to show success and error messages.
 */

export interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

/**
 * Creates a toast notification object with a unique ID.
 * 
 * @param type - The type of toast (success or error)
 * @param message - The message to display
 * @returns A toast object with unique ID
 */
export function showToast(type: 'success' | 'error', message: string): Toast {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return { id, type, message };
}
