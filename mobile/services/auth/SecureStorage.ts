/**
 * BizPilot Mobile POS — Secure Storage Wrapper
 *
 * Wraps expo-secure-store to provide encrypted key-value storage
 * for sensitive data like JWT tokens and PIN hashes.
 *
 * Why expo-secure-store?
 * It uses the platform's secure enclave (iOS Keychain, Android
 * Keystore) to encrypt data at rest. AsyncStorage is plaintext.
 * PCI-DSS and POS security standards require encrypted token storage.
 */

import * as ExpoSecureStore from "expo-secure-store";

/**
 * Store a value securely.
 * @param key - Storage key
 * @param value - Value to encrypt and store
 */
export async function setSecureItem(
  key: string,
  value: string
): Promise<void> {
  await ExpoSecureStore.setItemAsync(key, value);
}

/**
 * Retrieve a securely stored value.
 * @param key - Storage key
 * @returns The decrypted value, or null if not found
 */
export async function getSecureItem(key: string): Promise<string | null> {
  return ExpoSecureStore.getItemAsync(key);
}

/**
 * Delete a securely stored value.
 * @param key - Storage key
 */
export async function deleteSecureItem(key: string): Promise<void> {
  await ExpoSecureStore.deleteItemAsync(key);
}
