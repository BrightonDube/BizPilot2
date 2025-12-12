/**
 * useAuth hook for authentication.
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
 */
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Check if we have tokens but no user data
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token && !isAuthenticated) {
        fetchUser();
      }
    }
  }, [fetchUser, isAuthenticated]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push(redirectTo);
        }
      }
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook for guest-only pages (login, register).
 * Redirects to dashboard if already authenticated.
 */
export function useGuestOnly(redirectTo: string = '/dashboard') {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}

export default useAuth;
