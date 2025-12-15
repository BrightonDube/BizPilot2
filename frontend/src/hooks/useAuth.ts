/**
 * useAuth hook for authentication.
 * 
 * Authentication Strategy:
 * - Uses HttpOnly cookies for secure token storage
 * - Cookies are set by the backend and sent automatically with requests
 * - No tokens are stored in localStorage (prevents XSS attacks)
 * 
 * Hydration Strategy:
 * - Wait for isInitialized before making redirect decisions
 * - This prevents redirect loops caused by stale persisted state
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    fetchUser,
    clearError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    fetchUser,
    clearError,
  };
}

/**
 * Hook to require authentication for a page.
 * Redirects to login if not authenticated.
 * 
 * With cookie-based auth, we check authentication by calling /auth/me
 * which will fail if the cookie is invalid or expired.
 * 
 * IMPORTANT: Only redirects after isInitialized is true to prevent loops.
 */
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const { isAuthenticated, isLoading, isInitialized, fetchUser } = useAuthStore();
  const router = useRouter();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // Only fetch user once on mount
    if (!hasCheckedAuth.current && !isInitialized) {
      hasCheckedAuth.current = true;
      fetchUser();
    }
  }, [fetchUser, isInitialized]);

  useEffect(() => {
    // Only redirect after initialization completes and we know auth state
    if (isInitialized && !isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, isInitialized, router, redirectTo]);

  // Show loading until initialized
  return { 
    isAuthenticated, 
    isLoading: !isInitialized || isLoading 
  };
}

/**
 * Hook for guest-only pages (login, register).
 * Redirects to dashboard if already authenticated.
 * 
 * IMPORTANT: Only redirects after isInitialized is true to prevent loops.
 */
export function useGuestOnly(redirectTo: string = '/dashboard') {
  const { isAuthenticated, isLoading, isInitialized, fetchUser } = useAuthStore();
  const router = useRouter();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // Only fetch user once on mount
    if (!hasCheckedAuth.current && !isInitialized) {
      hasCheckedAuth.current = true;
      fetchUser();
    }
  }, [fetchUser, isInitialized]);

  useEffect(() => {
    // Only redirect after initialization completes and we know auth state
    if (isInitialized && !isLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, isInitialized, router, redirectTo]);

  // Show loading until initialized
  return { 
    isAuthenticated, 
    isLoading: !isInitialized || isLoading 
  };
}

export default useAuth;
