/**
 * React hook for session management.
 * 
 * Integrates the SessionManager with the auth store to provide:
 * - Automatic token refresh on activity
 * - Automatic logout on idle timeout
 * - Session expiration notifications
 * - Activity tracking
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useSessionManager(); // Start session management
 *   return <YourApp />;
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  getSessionManager,
  subscribeToSessionEvent,
} from '@/lib/session-manager';

/**
 * Session manager configuration options.
 */
interface UseSessionManagerOptions {
  /**
   * Whether to enable session management.
   * Default: true
   */
  enabled?: boolean;
  
  /**
   * Redirect path on session expiry.
   * Default: '/auth/login'
   */
  redirectTo?: string;
  
  /**
   * Show notification on session expiry.
   * Default: true
   */
  showNotification?: boolean;
  
  /**
   * Custom notification message.
   * Default: 'Your session has expired. Please log in again.'
   */
  notificationMessage?: string;
  
  /**
   * Idle timeout in milliseconds.
   * Default: 1800000 (30 minutes)
   */
  idleTimeout?: number;
  
  /**
   * How long before token expiry to refresh (milliseconds).
   * Default: 300000 (5 minutes)
   */
  refreshBeforeExpiry?: number;
}

/**
 * Hook to manage user session with automatic logout on expiry/idle.
 */
export function useSessionManager(options: UseSessionManagerOptions = {}) {
  const {
    enabled = true,
    redirectTo = '/auth/login',
    showNotification = true,
    notificationMessage = 'Your session has expired. Please log in again.',
    idleTimeout = 1800000, // 30 minutes
    refreshBeforeExpiry = 300000, // 5 minutes
  } = options;
  
  const { isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const hasLoggedOut = useRef(false);
  
  useEffect(() => {
    // Only run on client side and when authenticated
    if (typeof window === 'undefined' || !enabled || !isAuthenticated) {
      return;
    }
    
    // Reset logout flag when authenticated
    hasLoggedOut.current = false;
    
    // Get session manager instance
    const sessionManager = getSessionManager({
      idleTimeout,
      refreshBeforeExpiry,
    });
    
    // Start session monitoring
    sessionManager.start();
    
    // Handle session events
    const unsubscribers: Array<() => void> = [];
    
    // Session expired - logout and redirect
    const handleSessionExpired = async (event: CustomEvent) => {
      if (hasLoggedOut.current) return;
      hasLoggedOut.current = true;
      
      const detail = event.detail as { reason?: string } | undefined;
      const reason = detail?.reason || 'unknown';
      
      console.log('[Session] Session expired:', reason);
      
      // Logout user
      await logout();
      
      // Show notification if enabled
      if (showNotification && typeof window !== 'undefined') {
        // Store message in sessionStorage for login page to display
        sessionStorage.setItem('session_expired_message', notificationMessage);
      }
      
      // Redirect to login
      const currentPath = window.location.pathname + window.location.search;
      const separator = redirectTo.includes('?') ? '&' : '?';
      router.push(`${redirectTo}${separator}next=${encodeURIComponent(currentPath)}&expired=true`);
    };
    
    // Session idle - logout and redirect
    const handleSessionIdle = async (event: CustomEvent) => {
      if (hasLoggedOut.current) return;
      hasLoggedOut.current = true;
      
      const detail = event.detail as { idleTime?: number } | undefined;
      const idleMinutes = detail?.idleTime ? Math.floor(detail.idleTime / 60000) : 0;
      
      console.log('[Session] Session idle timeout:', idleMinutes, 'minutes');
      
      // Logout user
      await logout();
      
      // Show notification if enabled
      if (showNotification && typeof window !== 'undefined') {
        const message = `You were logged out due to inactivity (${idleMinutes} minutes).`;
        sessionStorage.setItem('session_expired_message', message);
      }
      
      // Redirect to login
      const currentPath = window.location.pathname + window.location.search;
      const separator = redirectTo.includes('?') ? '&' : '?';
      router.push(`${redirectTo}${separator}next=${encodeURIComponent(currentPath)}&idle=true`);
    };
    
    // Session refreshed - log for debugging
    const handleSessionRefreshed = () => {
      console.log('[Session] Token refreshed successfully');
    };
    
    // Subscribe to events
    unsubscribers.push(
      subscribeToSessionEvent('session:expired', handleSessionExpired),
      subscribeToSessionEvent('session:idle', handleSessionIdle),
      subscribeToSessionEvent('session:refreshed', handleSessionRefreshed)
    );
    
    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub());
      sessionManager.stop();
    };
  }, [
    enabled,
    isAuthenticated,
    logout,
    router,
    redirectTo,
    showNotification,
    notificationMessage,
    idleTimeout,
    refreshBeforeExpiry,
  ]);
  
  return {
    isAuthenticated,
  };
}

export default useSessionManager;
