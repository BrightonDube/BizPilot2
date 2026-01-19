/**
 * Guest AI Session Management Hook
 * 
 * Manages guest AI sessions without authentication, including session persistence,
 * rate limiting, and analytics tracking.
 * 
 * Requirements: 2.2, 2.4
 */

import { useState, useEffect, useCallback } from 'react';

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

interface GuestAISessionConfig {
  maxMessagesPerSession: number;
  maxMessagesPerHour: number;
  sessionTimeoutMs: number;
  storageKey: string;
}

const DEFAULT_CONFIG: GuestAISessionConfig = {
  maxMessagesPerSession: 20,
  maxMessagesPerHour: 50,
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  storageKey: 'bizpilot_guest_ai_session'
};

export function useGuestAISession(config: Partial<GuestAISessionConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
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
    
    // Create new session
    const newSession: GuestSession = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    resetTime: Date.now() + 60 * 60 * 1000, // 1 hour from now
    isLimited: false
  }));

  // Save session to localStorage
  const saveSession = useCallback((sessionData: GuestSession) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(finalConfig.storageKey, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save guest AI session:', error);
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

  // Check rate limits
  const checkRateLimit = useCallback((): boolean => {
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
    
    // Reset hourly limit if time has passed
    if (now >= rateLimitInfo.resetTime) {
      setRateLimitInfo({
        remaining: finalConfig.maxMessagesPerHour,
        resetTime: now + 60 * 60 * 1000,
        isLimited: false
      });
    }
    
    return true;
  }, [session, rateLimitInfo, finalConfig.maxMessagesPerSession, finalConfig.maxMessagesPerHour]);

  // Get rate limit status message
  const getRateLimitMessage = useCallback((): string => {
    if (!session) return '';
    
    const now = Date.now();
    
    if (session.messageCount >= finalConfig.maxMessagesPerSession) {
      return `You've reached the maximum of ${finalConfig.maxMessagesPerSession} messages for this session. Please start a new session or sign up for unlimited access.`;
    }
    
    if (rateLimitInfo.isLimited && now < rateLimitInfo.resetTime) {
      const minutesLeft = Math.ceil((rateLimitInfo.resetTime - now) / (60 * 1000));
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
      resetTime: Date.now() + 60 * 60 * 1000,
      isLimited: false
    });
  }, [finalConfig.storageKey, finalConfig.maxMessagesPerHour]);

  // Track analytics event
  const trackAnalytics = useCallback((event: string, data?: Record<string, unknown>) => {
    if (!session) return;
    
    // Basic analytics tracking - can be enhanced with actual analytics service
    const analyticsData = {
      sessionId: session.id,
      event,
      timestamp: Date.now(),
      messageCount: session.messageCount,
      sessionAge: Date.now() - session.createdAt,
      ...data
    };
    
    // Log to console for now - replace with actual analytics service
    console.log('Guest AI Analytics:', analyticsData);
    
    // Could send to analytics service here
    // analytics.track('guest_ai_' + event, analyticsData);
  }, [session]);

  // Session time remaining should be calculated by the consumer when needed
  // to avoid calling Date.now() during render (violates React purity rules)
  const getSessionTimeRemaining = useCallback(() => {
    if (!session) return 0;
    return Math.max(0, finalConfig.sessionTimeoutMs - (Date.now() - session.lastActivity));
  }, [session, finalConfig.sessionTimeoutMs]);

  return {
    session,
    rateLimitInfo,
    canSendMessage: checkRateLimit(),
    rateLimitMessage: getRateLimitMessage(),
    updateSessionActivity,
    clearSession,
    trackAnalytics,
    isSessionActive: session !== null,
    messagesRemaining: session ? finalConfig.maxMessagesPerSession - session.messageCount : 0,
    getSessionTimeRemaining
  };
}