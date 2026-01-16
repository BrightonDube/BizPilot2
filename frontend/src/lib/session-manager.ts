/**
 * Session Management Utility
 * 
 * Handles automatic session expiration with activity tracking:
 * - Decodes JWT to check expiry time
 * - Tracks user activity (mouse, keyboard, API calls)
 * - Automatically refreshes token before expiry when user is active
 * - Logs out user on idle timeout (no activity + token near expiry)
 * - Emits events for session state changes
 * 
 * Best Practices (2025):
 * - Proactive token refresh (refresh before expiry, not after)
 * - Activity-based session management (don't logout active users)
 * - Graceful degradation (handle edge cases like tab visibility)
 * - Event-driven architecture (decouple from UI components)
 */

import { apiClient } from './api';

/**
 * Decode JWT token to extract expiry time.
 * Returns null if token is invalid or expired.
 */
function decodeJWT(token: string): { exp: number; sub: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract access token from cookies.
 * Returns null if not found.
 */
function getAccessTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'access_token') {
      return value;
    }
  }
  return null;
}

/**
 * Session manager configuration.
 */
interface SessionConfig {
  /**
   * How often to check token expiry (milliseconds).
   * Default: 60000 (1 minute)
   */
  checkInterval?: number;
  
  /**
   * How long before token expiry to refresh (milliseconds).
   * Default: 300000 (5 minutes)
   */
  refreshBeforeExpiry?: number;
  
  /**
   * Idle timeout - logout if no activity for this long (milliseconds).
   * Default: 1800000 (30 minutes)
   */
  idleTimeout?: number;
  
  /**
   * Activity events to track.
   * Default: ['mousedown', 'keydown', 'scroll', 'touchstart']
   */
  activityEvents?: string[];
}

/**
 * Session event types.
 */
export type SessionEventType = 
  | 'session:activity'
  | 'session:idle'
  | 'session:refreshed'
  | 'session:expired'
  | 'session:logout';

/**
 * Session manager class.
 * Handles automatic token refresh and idle timeout.
 */
export class SessionManager {
  private config: Required<SessionConfig>;
  private lastActivity: number = Date.now();
  private checkIntervalId: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private activityListeners: Array<{ event: string; handler: () => void }> = [];
  
  constructor(config: SessionConfig = {}) {
    this.config = {
      checkInterval: config.checkInterval ?? 60000, // 1 minute
      refreshBeforeExpiry: config.refreshBeforeExpiry ?? 300000, // 5 minutes
      idleTimeout: config.idleTimeout ?? 1800000, // 30 minutes
      activityEvents: config.activityEvents ?? ['mousedown', 'keydown', 'scroll', 'touchstart'],
    };
  }
  
  /**
   * Start session monitoring.
   */
  start(): void {
    if (this.checkIntervalId) {
      return; // Already started
    }
    
    // Set up activity tracking
    this.setupActivityTracking();
    
    // Start periodic token check
    this.checkIntervalId = setInterval(() => {
      this.checkSession();
    }, this.config.checkInterval);
    
    // Initial check
    this.checkSession();
  }
  
  /**
   * Stop session monitoring.
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    // Remove activity listeners
    this.removeActivityTracking();
  }
  
  /**
   * Set up activity tracking.
   */
  private setupActivityTracking(): void {
    if (typeof window === 'undefined') return;
    
    this.config.activityEvents.forEach(event => {
      const handler = () => this.recordActivity();
      window.addEventListener(event, handler, { passive: true });
      this.activityListeners.push({ event, handler });
    });
  }
  
  /**
   * Remove activity tracking.
   */
  private removeActivityTracking(): void {
    if (typeof window === 'undefined') return;
    
    this.activityListeners.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
    this.activityListeners = [];
  }
  
  /**
   * Record user activity.
   */
  private recordActivity(): void {
    const now = Date.now();
    const wasIdle = now - this.lastActivity > this.config.idleTimeout;
    
    this.lastActivity = now;
    
    if (wasIdle) {
      this.dispatchEvent('session:activity');
    }
  }
  
  /**
   * Check if user is idle.
   */
  private isIdle(): boolean {
    return Date.now() - this.lastActivity > this.config.idleTimeout;
  }
  
  /**
   * Check session state and take action if needed.
   */
  private async checkSession(): Promise<void> {
    const token = getAccessTokenFromCookie();
    
    if (!token) {
      // No token - user is not authenticated
      return;
    }
    
    const decoded = decodeJWT(token);
    if (!decoded) {
      // Invalid token - trigger logout
      this.dispatchEvent('session:expired', { reason: 'invalid_token' });
      return;
    }
    
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const expiresAt = decoded.exp;
    const timeUntilExpiry = (expiresAt - now) * 1000; // Convert to milliseconds
    
    // Check if token is expired
    if (timeUntilExpiry <= 0) {
      this.dispatchEvent('session:expired', { reason: 'token_expired' });
      return;
    }
    
    // Check if user is idle
    if (this.isIdle()) {
      // User is idle - check if token is close to expiry
      if (timeUntilExpiry < this.config.refreshBeforeExpiry) {
        // Token is close to expiry and user is idle - logout
        this.dispatchEvent('session:idle', { 
          idleTime: Date.now() - this.lastActivity,
          timeUntilExpiry 
        });
        return;
      }
    } else {
      // User is active - refresh token if close to expiry
      if (timeUntilExpiry < this.config.refreshBeforeExpiry && !this.isRefreshing) {
        await this.refreshToken();
      }
    }
  }
  
  /**
   * Refresh the access token.
   */
  private async refreshToken(): Promise<void> {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      await apiClient.post('/auth/refresh', {});
      this.dispatchEvent('session:refreshed');
    } catch {
      // Refresh failed - session expired
      this.dispatchEvent('session:expired', { reason: 'refresh_failed' });
    } finally {
      this.isRefreshing = false;
    }
  }
  
  /**
   * Dispatch a session event.
   */
  private dispatchEvent(type: SessionEventType, detail?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
  
  /**
   * Get time until token expiry (milliseconds).
   * Returns null if no token or invalid token.
   */
  getTimeUntilExpiry(): number | null {
    const token = getAccessTokenFromCookie();
    if (!token) return null;
    
    const decoded = decodeJWT(token);
    if (!decoded) return null;
    
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = (decoded.exp - now) * 1000;
    
    return timeUntilExpiry > 0 ? timeUntilExpiry : 0;
  }
  
  /**
   * Get time since last activity (milliseconds).
   */
  getTimeSinceActivity(): number {
    return Date.now() - this.lastActivity;
  }
}

/**
 * Subscribe to session events.
 * Returns an unsubscribe function.
 */
export function subscribeToSessionEvent(
  type: SessionEventType,
  handler: (event: CustomEvent) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  
  window.addEventListener(type, handler as EventListener);
  return () => window.removeEventListener(type, handler as EventListener);
}

/**
 * Global session manager instance.
 */
let globalSessionManager: SessionManager | null = null;

/**
 * Get or create the global session manager.
 */
export function getSessionManager(config?: SessionConfig): SessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager(config);
  }
  return globalSessionManager;
}

/**
 * Start the global session manager.
 */
export function startSessionManager(config?: SessionConfig): void {
  const manager = getSessionManager(config);
  manager.start();
}

/**
 * Stop the global session manager.
 */
export function stopSessionManager(): void {
  if (globalSessionManager) {
    globalSessionManager.stop();
  }
}
