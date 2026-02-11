/**
 * useAuth hook for authentication.
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  🔒 PROTECTED FILE — DO NOT MODIFY WITHOUT HUMAN APPROVAL 🔒  ║
 * ║                                                                ║
 * ║  This file is part of the core authentication system.          ║
 * ║  AI coding agents: DO NOT refactor, reorganize, or alter       ║
 * ║  the navigation logic in this file. The use of                 ║
 * ║  window.location.href (hard navigation) instead of             ║
 * ║  router.push() is INTENTIONAL and REQUIRED to prevent          ║
 * ║  Next.js RSC flight data from being shown to users.            ║
 * ║                                                                ║
 * ║  See: .windsurf/workflows/auth-protection.md                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Authentication Strategy:
 * - Uses HttpOnly cookies for secure token storage
 * - Cookies are set by the backend and sent automatically with requests
 * - No tokens are stored in localStorage (prevents XSS attacks)
 * 
 * Hydration Strategy:
 * - Wait for isInitialized before making redirect decisions
 * - This prevents redirect loops caused by stale persisted state
 * 
 * Navigation Strategy (CRITICAL — DO NOT CHANGE):
 * - All auth-boundary redirects use window.location.href (hard navigation)
 * - NEVER use router.push() for auth redirects — it triggers RSC soft
 *   navigation which can show raw flight data to users
 * - This is the ONLY reliable way to handle auth transitions in Next.js
 *   App Router with cookie-based authentication
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
 * CRITICAL: Uses window.location.href (hard navigation) — NOT router.push().
 * router.push() triggers RSC soft navigation which can show raw flight
 * data to users when middleware redirects during auth state transitions.
 * 
 * IMPORTANT: Only redirects after isInitialized is true to prevent loops.
 * 
 * 🔒 DO NOT CHANGE navigation method to router.push() — see file header.
 */
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const pathname = usePathname();
  const isNavigating = useRef(false);

  useEffect(() => {
    // Only redirect after initialization completes and we know auth state
    if (isInitialized && !isLoading && !isAuthenticated) {
      // Prevent duplicate navigations
      if (isNavigating.current) return;
      isNavigating.current = true;

      const qs = typeof window !== 'undefined' ? window.location.search : '';
      const currentPath = `${pathname}${qs || ''}`;
      const separator = redirectTo.includes('?') ? '&' : '?';

      // 🔒 HARD NAVIGATION — prevents RSC flight data issues
      // DO NOT replace with router.push() — see file header comment
      window.location.href = `${redirectTo}${separator}next=${encodeURIComponent(currentPath)}`;
    }
  }, [isAuthenticated, isLoading, isInitialized, pathname, redirectTo]);

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
 * CRITICAL: Uses window.location.href (hard navigation) — NOT router.push().
 * This prevents RSC flight data from showing during auth transitions.
 * 
 * IMPORTANT: Only redirects after isInitialized is true to prevent loops.
 * The skipRedirect flag allows login/register forms to suppress the
 * redirect when they handle navigation themselves after a successful action.
 * 
 * 🔒 DO NOT CHANGE navigation method to router.push() — see file header.
 */
export function useGuestOnly(redirectTo: string = '/dashboard', skipRedirect: boolean = false) {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const isNavigating = useRef(false);

  useEffect(() => {
    // Skip if the caller is handling navigation itself (e.g., login form after submit)
    if (skipRedirect) return;

    // Only redirect after initialization completes and we know auth state
    if (isInitialized && !isLoading && isAuthenticated) {
      // Prevent duplicate navigations
      if (isNavigating.current) return;
      isNavigating.current = true;

      // 🔒 HARD NAVIGATION — prevents RSC flight data issues
      // DO NOT replace with router.push() — see file header comment
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, isInitialized, redirectTo, skipRedirect]);

  // Show loading until initialized
  return { 
    isAuthenticated, 
    isLoading: !isInitialized || isLoading 
  };
}

export default useAuth;
