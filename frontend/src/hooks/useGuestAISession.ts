/**
 * Guest AI Session Management Hook
 * 
 * Manages guest AI sessions without authentication, including session persistence,
 * rate limiting, and analytics tracking.
 * 
 * Requirements: 2.2, 2.4
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

interface GuestSession {
  id: string;
  createdAt: number;
  messageCount: number;
  lastActivity: number;
}

interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
}

interface AnalyticsAdapter {
  track: (event: string, data: Record<string, unknown>) => void;
}

interface GuestAISessionConfig {
  maxMessagesPerSession: number;
  maxMessagesPerHour: number;
  sessionTimeoutMs: number;
  storageKey: string;
  analyticsAdapter?: AnalyticsAdapter;
}

const TIME_CONSTANTS = {
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_MINUTE_MS: 60 * 1000,
  THIRTY_MINUTES_MS: 30 * 60 * 1000,
} as const;

const DEFAULT_CONFIG: GuestAISessionConfig = {
  maxMessagesPerSession: 20,
  maxMessagesPerHour: 50,
  sessionTimeoutMs: TIME_CONSTANTS.THIRTY_MINUTES_MS,
  storageKey: 'bizpilot_guest_ai_session'
};

export function useGuestAISession(config: Partial<GuestAISessionConfig> = {}) {
  // Validate and merge config with defaults
  const finalConfig: GuestAISessionConfig = {
    maxMessagesPerSession: Math.max(1, config.maxMessagesPerSession ?? DEFAULT_CONFIG.maxMessagesPerSession),
    maxMessagesPerHour: Math.max(1, config.maxMessagesPerHour ?? DEFAULT_CONFIG.maxMessagesPerHour),
    sessionTimeoutMs: Math.max(1000, config.sessionTimeoutMs ?? DEFAULT_CONFIG.sessionTimeoutMs),
    storageKey: config.storageKey || DEFAULT_CONFIG.storageKey,
    analyticsAdapter: config.analyticsAdapter
  };
  
  // Helper to load session from storage
  const loadSessionFromStorage = useCallback((): GuestSession | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(finalConfig.storageKey);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored) as GuestSession;
      
      // Check if session has expired
      const now = Date.now();
      if (now - parsed.lastActivity > finalConfig.sessionTimeoutMs) {
        localStorage.removeItem(finalConfig.storageKey);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Failed to load guest AI session:', error);
      localStorage.removeItem(finalConfig.storageKey);
      return null;
    }
  }, [finalConfig.storageKey, finalConfig.sessionTimeoutMs]);

  // Generate a unique session ID
  const generateSessionId = useCallback((): string => {
    return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Initialize session state with lazy initialization
  const [session, setSession] = useState<GuestSession | null>(() => {
    const existing = loadSessionFromStorage();
    if (existing) return existing;
    
    // Create new session using the generateSessionId function
    const newSession: GuestSession = {
      id: generateSessionId(),
      createdAt: Date.now(),
      messageCount: 0,
      lastActivity: Date.now()
    };
    
    // Save to storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(finalConfig.storageKey, JSON.stringify(newSession));
      } catch (error) {
        console.warn('Failed to save guest AI session:', error);
      }
    }
    
    return newSession;
  });
  
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>(() => ({
    remaining: finalConfig.maxMessagesPerHour,
    resetTime: Date.now() + TIME_CONSTANTS.ONE_HOUR_MS,
    isLimited: false
  }));

  // Save session to localStorage with enhanced error handling
  const saveSession = useCallback((sessionData: GuestSession) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(finalConfig.storageKey, JSON.stringify(sessionData));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Clearing old session data.');
        // Clear old data and retry
        localStorage.removeItem(finalConfig.storageKey);
        try {
          localStorage.setItem(finalConfig.storageKey, JSON.stringify(sessionData));
        } catch (retryError) {
          console.error('Failed to save session after clearing:', retryError);
        }
      } else {
        console.warn('Failed to save guest AI session:', error);
      }
    }
  }, [finalConfig.storageKey]);

  // Update session activity
  const updateSessionActivity = useCallback(() => {
    if (!session) return;
    
    const updatedSession = {
      ...session,
      lastActivity: Date.now(),
      messageCount: session.messageCount + 1
    };
    
    setSession(updatedSession);
    saveSession(updatedSession);
    
    // Update rate limit info
    setRateLimitInfo(prev => ({
      ...prev,
      remaining: Math.max(0, prev.remaining - 1),
      isLimited: prev.remaining <= 1
    }));
  }, [session, saveSession]);

  // Check rate limits (memoized for performance)
  const canSendMessage = useMemo((): boolean => {
    if (!session) return true;
    
    const now = Date.now();
    
    // Check session message limit
    if (session.messageCount >= finalConfig.maxMessagesPerSession) {
      return false;
    }
    
    // Check hourly rate limit
    if (rateLimitInfo.isLimited && now < rateLimitInfo.resetTime) {
      return false;
    }
    
    return true;
  }, [session, rateLimitInfo, finalConfig.maxMessagesPerSession]);

  // Get rate limit status message (memoized for performance)
  const rateLimitMessage = useMemo((): string => {
    if (!session) return '';
    
    const now = Date.now();
    
    if (session.messageCount >= finalConfig.maxMessagesPerSession) {
      return `You've reached the maximum of ${finalConfig.maxMessagesPerSession} messages for this session. Please start a new session or sign up for unlimited access.`;
    }
    
    if (rateLimitInfo.isLimited && now < rateLimitInfo.resetTime) {
      const minutesLeft = Math.ceil((rateLimitInfo.resetTime - now) / TIME_CONSTANTS.ONE_MINUTE_MS);
      return `You've reached the hourly message limit. Please try again in ${minutesLeft} minutes or sign up for unlimited access.`;
    }
    
    return '';
  }, [session, rateLimitInfo, finalConfig.maxMessagesPerSession]);

  // Clear session (for testing or reset)
  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(finalConfig.storageKey);
    }
    setSession(null);
    setRateLimitInfo({
      remaining: finalConfig.maxMessagesPerHour,
      resetTime: Date.now() + TIME_CONSTANTS.ONE_HOUR_MS,
      isLimited: false
    });
  }, [finalConfig.storageKey, finalConfig.maxMessagesPerHour]);

  // Track analytics event with optional adapter
  const trackAnalytics = useCallback((event: string, data?: Record<string, unknown>) => {
    if (!session) return;
    
    const analyticsData = {
      sessionId: session.id,
      event,
      timestamp: Date.now(),
      messageCount: session.messageCount,
      sessionAge: Date.now() - session.createdAt,
      ...data
    };
    
    // Use adapter if provided, otherwise log to console
    if (finalConfig.analyticsAdapter) {
      finalConfig.analyticsAdapter.track(`guest_ai_${event}`, analyticsData);
    } else {
      console.log('Guest AI Analytics:', analyticsData);
    }
  }, [session, finalConfig.analyticsAdapter]);

  // Effect to reset hourly rate limit when time expires
  useEffect(() => {
    if (!rateLimitInfo.isLimited) return;
    
    const now = Date.now();
    const timeUntilReset = rateLimitInfo.resetTime - now;
    
    if (timeUntilReset <= 0) {
      // Reset immediately if already expired
      setRateLimitInfo({
        remaining: finalConfig.maxMessagesPerHour,
        resetTime: now + TIME_CONSTANTS.ONE_HOUR_MS,
        isLimited: false
      });
      return;
    }
    
    // Set timeout to reset when time expires
    const timeoutId = setTimeout(() => {
      setRateLimitInfo({
        remaining: finalConfig.maxMessagesPerHour,
        resetTime: Date.now() + TIME_CONSTANTS.ONE_HOUR_MS,
        isLimited: false
      });
    }, timeUntilReset);
    
    return () => clearTimeout(timeoutId);
  }, [rateLimitInfo.isLimited, rateLimitInfo.resetTime, finalConfig.maxMessagesPerHour]);

  // Cleanup effect: save session on unmount
  useEffect(() => {
    return () => {
      if (session) {
        saveSession(session);
      }
    };
  }, [session, saveSession]);

  // Session time remaining should be calculated by the consumer when needed
  // to avoid calling Date.now() during render (violates React purity rules)
  const getSessionTimeRemaining = useCallback(() => {
    if (!session) return 0;
    return Math.max(0, finalConfig.sessionTimeoutMs - (Date.now() - session.lastActivity));
  }, [session, finalConfig.sessionTimeoutMs]);

  return {
    session,
    rateLimitInfo,
    canSendMessage,
    rateLimitMessage,
    updateSessionActivity,
    clearSession,
    trackAnalytics,
    isSessionActive: session !== null,
    messagesRemaining: session ? finalConfig.maxMessagesPerSession - session.messageCount : 0,
    getSessionTimeRemaining
  };
}