/**
 * useAuth hook for authentication.
 * 
 * Authentication Strategy:
 * - Uses HttpOnly cookies for secure token storage
 * - Cookies are set by the backend and sent automatically with requests
 * - No tokens are stored in localStorage (prevents XSS attacks)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
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
 */
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Try to fetch user on mount (cookies will be sent automatically)
    if (!isAuthenticated && !isLoading) {
      fetchUser();
    }
  }, [fetchUser, isAuthenticated, isLoading]);

  useEffect(() => {
    // After loading completes, if not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook for guest-only pages (login, register).
 * Redirects to dashboard if already authenticated.
 */
export function useGuestOnly(redirectTo: string = '/dashboard') {
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Try to fetch user on mount to check if already authenticated
    if (!isAuthenticated && !isLoading) {
      fetchUser();
    }
  }, [fetchUser, isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}

export default useAuth;
