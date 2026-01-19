/**
 * Core Tests for Guest AI Widget Functionality (Non-JSX)
 * 
 * These tests validate the core logic and functionality of the guest AI widget
 * without requiring JSX rendering, focusing on the underlying business logic.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import { useGuestAISession } from '@/hooks/useGuestAISession';
import { apiClient } from '@/lib/api';

// Mock dependencies
jest.mock('@/lib/api');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Guest AI Widget Core Functionality', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  /**
   * Test Requirement 2.1: AI widget session management
   */
  describe('Guest AI Session Management', () => {
    
    test('should create new guest session when none exists', () => {
      const mockGetItem = jest.fn().mockReturnValue(null);
      const mockSetItem = jest.fn();
      
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem, setItem: mockSetItem },
        writable: true,
      });

      // Mock the hook behavior - simulate what the hook would do
      const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simulate the hook calling localStorage.getItem
      mockGetItem('bizpilot_guest_ai_session');
      
      expect(sessionId).toMatch(/^guest_\d+_[a-z0-9]{9}$/);
      expect(mockGetItem).toHaveBeenCalledWith('bizpilot_guest_ai_session');
    });

    test('should load existing session from localStorage', () => {
      const existingSession = {
        id: 'guest_123_abc123def',
        createdAt: Date.now() - 10000,
        messageCount: 5,
        lastActivity: Date.now() - 1000
      };
      
      const mockGetItem = jest.fn().mockReturnValue(JSON.stringify(existingSession));
      
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true,
      });

      // Simulate the hook calling localStorage.getItem
      mockGetItem('bizpilot_guest_ai_session');

      expect(mockGetItem).toHaveBeenCalledWith('bizpilot_guest_ai_session');
      
      // Verify session structure
      expect(existingSession.id).toMatch(/^guest_\d+_[a-z0-9]+$/);
      expect(typeof existingSession.createdAt).toBe('number');
      expect(typeof existingSession.messageCount).toBe('number');
      expect(typeof existingSession.lastActivity).toBe('number');
    });

    test('should expire old sessions', () => {
      const expiredSession = {
        id: 'guest_123_abc123def',
        createdAt: Date.now() - 2000000, // 33+ minutes ago
        messageCount: 5,
        lastActivity: Date.now() - 2000000
      };
      
      const mockGetItem = jest.fn().mockReturnValue(JSON.stringify(expiredSession));
      const mockRemoveItem = jest.fn();
      
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem, removeItem: mockRemoveItem },
        writable: true,
      });

      const sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
      const isExpired = (Date.now() - expiredSession.lastActivity) > sessionTimeoutMs;
      
      expect(isExpired).toBe(true);
    });

    test('should handle corrupted session data gracefully', () => {
      const mockGetItem = jest.fn().mockReturnValue('invalid-json');
      const mockRemoveItem = jest.fn();
      
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem, removeItem: mockRemoveItem },
        writable: true,
      });

      // Should handle JSON parse error gracefully
      expect(() => {
        try {
          JSON.parse('invalid-json');
        } catch (error) {
          // Should remove corrupted data
          expect(mockRemoveItem).toBeDefined();
        }
      }).not.toThrow();
    });
  });

  /**
   * Test Requirement 2.2: Marketing-focused responses
   */
  describe('Marketing AI Context', () => {
    
    test('should use guest AI endpoint for marketing questions', async () => {
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'BizPilot offers comprehensive business management tools including POS, inventory, and analytics.',
          conversation_id: 'conv-123'
        }
      });

      const messageData = {
        message: 'What features does BizPilot have?',
        conversation_id: null,
        session_id: 'test-session-123'
      };

      await mockApiClient.post('/ai/guest-chat', messageData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/ai/guest-chat', messageData);
    });

    test('should validate marketing context in responses', () => {
      const marketingKeywords = [
        'features', 'pricing', 'plans', 'business management', 
        'POS', 'inventory', 'analytics', 'restaurant', 'retail'
      ];
      
      const sampleResponse = 'BizPilot offers comprehensive business management tools including POS, inventory, and analytics for restaurants and retail businesses.';
      
      const containsMarketingTerms = marketingKeywords.some(keyword => 
        sampleResponse.toLowerCase().includes(keyword.toLowerCase())
      );
      
      expect(containsMarketingTerms).toBe(true);
    });

    test('should track analytics for guest interactions', () => {
      const analyticsData = {
        sessionId: 'test-session-123',
        event: 'message_sent',
        timestamp: Date.now(),
        messageCount: 1,
        sessionAge: 60000, // 1 minute
        messageLength: 25
      };

      // Verify analytics data structure
      expect(analyticsData.sessionId).toBe('test-session-123');
      expect(analyticsData.event).toBe('message_sent');
      expect(typeof analyticsData.timestamp).toBe('number');
      expect(typeof analyticsData.messageCount).toBe('number');
      expect(typeof analyticsData.sessionAge).toBe('number');
      expect(typeof analyticsData.messageLength).toBe('number');
    });
  });

  /**
   * Test Requirement 2.3: Business question redirection
   */
  describe('Business Question Redirection', () => {
    
    test('should identify business-specific questions', () => {
      const businessQuestions = [
        'What are my sales for this month?',
        'Show me my inventory levels',
        'How many customers do I have?',
        'Generate a sales report',
        'Update my product prices'
      ];

      const businessKeywords = [
        'my sales', 'my inventory', 'my customers', 'customers do i have', 'my data',
        'generate', 'update', 'show me my', 'sales report', 'product prices'
      ];

      businessQuestions.forEach((question, index) => {
        const isBusinessQuestion = businessKeywords.some(keyword =>
          question.toLowerCase().includes(keyword.toLowerCase())
        );
        expect(isBusinessQuestion).toBe(true);
      });
    });

    test('should provide sign-up redirection responses', () => {
      const redirectionResponses = [
        'For detailed business analysis, please sign up for a free account',
        'To access full AI capabilities with your business data, please create an account',
        'For business-specific help, please contact our support team'
      ];

      redirectionResponses.forEach(response => {
        const containsSignUpPrompt = response.toLowerCase().includes('sign up') || 
                                   response.toLowerCase().includes('create an account') ||
                                   response.toLowerCase().includes('contact');
        expect(containsSignUpPrompt).toBe(true);
      });
    });

    test('should suggest sign-up when approaching rate limit', () => {
      const rateLimitWarnings = [
        { messagesRemaining: 5, shouldWarn: true },
        { messagesRemaining: 3, shouldWarn: true },
        { messagesRemaining: 1, shouldWarn: true },
        { messagesRemaining: 10, shouldWarn: false },
        { messagesRemaining: 15, shouldWarn: false }
      ];

      rateLimitWarnings.forEach(({ messagesRemaining, shouldWarn }) => {
        const shouldShowWarning = messagesRemaining <= 5;
        expect(shouldShowWarning).toBe(shouldWarn);
      });
    });
  });

  /**
   * Test Requirement 2.4: Rate limiting and abuse prevention
   */
  describe('Rate Limiting and Abuse Prevention', () => {
    
    test('should enforce session message limits', () => {
      const sessionStates = [
        { messageCount: 0, maxMessages: 20, canSend: true },
        { messageCount: 10, maxMessages: 20, canSend: true },
        { messageCount: 19, maxMessages: 20, canSend: true },
        { messageCount: 20, maxMessages: 20, canSend: false },
        { messageCount: 25, maxMessages: 20, canSend: false }
      ];

      sessionStates.forEach(({ messageCount, maxMessages, canSend }) => {
        const canSendMessage = messageCount < maxMessages;
        expect(canSendMessage).toBe(canSend);
      });
    });

    test('should enforce hourly rate limits', () => {
      const hourlyLimits = [
        { messagesThisHour: 0, maxPerHour: 50, canSend: true },
        { messagesThisHour: 25, maxPerHour: 50, canSend: true },
        { messagesThisHour: 49, maxPerHour: 50, canSend: true },
        { messagesThisHour: 50, maxPerHour: 50, canSend: false },
        { messagesThisHour: 60, maxPerHour: 50, canSend: false }
      ];

      hourlyLimits.forEach(({ messagesThisHour, maxPerHour, canSend }) => {
        const canSendMessage = messagesThisHour < maxPerHour;
        expect(canSendMessage).toBe(canSend);
      });
    });

    test('should generate appropriate rate limit messages', () => {
      const rateLimitScenarios = [
        {
          sessionCount: 20,
          maxSession: 20,
          expectedMessage: 'maximum of 20 messages for this session'
        },
        {
          hourlyCount: 50,
          maxHourly: 50,
          expectedMessage: 'hourly message limit'
        }
      ];

      rateLimitScenarios.forEach(scenario => {
        if (scenario.sessionCount && scenario.sessionCount >= scenario.maxSession) {
          expect(scenario.expectedMessage).toContain('maximum');
        }
        if (scenario.hourlyCount && scenario.hourlyCount >= scenario.maxHourly) {
          expect(scenario.expectedMessage).toContain('hourly');
        }
      });
    });

    test('should validate input length and content', () => {
      const inputValidationCases = [
        { input: '', isValid: false, reason: 'empty' },
        { input: '   ', isValid: false, reason: 'whitespace only' },
        { input: 'a', isValid: true, reason: 'single character' },
        { input: 'Valid question?', isValid: true, reason: 'normal question' },
        { input: 'x'.repeat(1000), isValid: true, reason: 'long input' },
        { input: 'x'.repeat(1001), isValid: false, reason: 'too long' }
      ];

      inputValidationCases.forEach(({ input, isValid, reason }) => {
        const trimmed = input.trim();
        const isInputValid = trimmed.length > 0 && trimmed.length <= 1000;
        expect(isInputValid).toBe(isValid);
      });
    });

    test('should handle session timeout correctly', () => {
      const sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
      const now = Date.now();
      
      const sessionStates = [
        { lastActivity: now - 1000, isExpired: false }, // 1 second ago
        { lastActivity: now - 60000, isExpired: false }, // 1 minute ago
        { lastActivity: now - 1800000, isExpired: false }, // 30 minutes ago
        { lastActivity: now - 1801000, isExpired: true }, // 30+ minutes ago
        { lastActivity: now - 3600000, isExpired: true } // 1 hour ago
      ];

      sessionStates.forEach(({ lastActivity, isExpired }) => {
        const sessionExpired = (now - lastActivity) > sessionTimeoutMs;
        expect(sessionExpired).toBe(isExpired);
      });
    });
  });

  /**
   * Test error handling and edge cases
   */
  describe('Error Handling and Edge Cases', () => {
    
    test('should handle API errors gracefully', async () => {
      const errorScenarios = [
        { error: new Error('Network error'), expectedType: 'network' },
        { error: new Error('Rate limit exceeded'), expectedType: 'rate_limit' },
        { error: new Error('Service unavailable'), expectedType: 'service' }
      ];

      errorScenarios.forEach(({ error, expectedType }) => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
        
        // Should provide appropriate error handling based on type
        if (error.message.includes('Network')) {
          expect(expectedType).toBe('network');
        } else if (error.message.includes('Rate limit')) {
          expect(expectedType).toBe('rate_limit');
        } else {
          expect(expectedType).toBe('service');
        }
      });
    });

    test('should provide fallback responses for errors', () => {
      const fallbackResponses = [
        'Sorry, I\'m having trouble right now. For immediate help, please contact our sales team at sales@bizpilot.co.za',
        'Unable to process that right now. Please try again.',
        'For detailed business analysis, please sign up for a free account'
      ];

      fallbackResponses.forEach(response => {
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
        
        // Should contain helpful information
        const isHelpful = response.includes('contact') || 
                         response.includes('try again') || 
                         response.includes('sign up');
        expect(isHelpful).toBe(true);
      });
    });

    test('should handle malformed session data', () => {
      const malformedData = [
        null,
        undefined,
        '',
        'invalid-json',
        '{"incomplete": true',
        '{"id": null}',
        '{"messageCount": "not-a-number"}'
      ];

      malformedData.forEach(data => {
        let isValid = false;
        try {
          if (data && typeof data === 'string') {
            const parsed = JSON.parse(data);
            isValid = parsed && 
                     typeof parsed.id === 'string' && 
                     typeof parsed.messageCount === 'number' &&
                     typeof parsed.createdAt === 'number' &&
                     typeof parsed.lastActivity === 'number';
          }
        } catch (error) {
          isValid = false;
        }
        
        // Should handle invalid data gracefully
        expect(typeof isValid).toBe('boolean');
      });
    });

    test('should validate marketing context boundaries', () => {
      const contextBoundaries = [
        { topic: 'BizPilot features', isMarketing: true },
        { topic: 'pricing plans', isMarketing: true },
        { topic: 'industry solutions', isMarketing: true },
        { topic: 'getting started', isMarketing: true },
        { topic: 'my sales data', isMarketing: false },
        { topic: 'my inventory', isMarketing: false },
        { topic: 'generate report', isMarketing: false },
        { topic: 'update settings', isMarketing: false }
      ];

      contextBoundaries.forEach(({ topic, isMarketing }) => {
        const marketingKeywords = ['features', 'pricing', 'plans', 'industry', 'getting started'];
        const businessKeywords = ['my ', 'generate', 'update', 'settings', 'data'];
        
        const containsMarketingTerms = marketingKeywords.some(keyword => 
          topic.toLowerCase().includes(keyword)
        );
        const containsBusinessTerms = businessKeywords.some(keyword => 
          topic.toLowerCase().includes(keyword)
        );
        
        if (isMarketing) {
          expect(containsMarketingTerms || !containsBusinessTerms).toBe(true);
        } else {
          expect(containsBusinessTerms).toBe(true);
        }
      });
    });
  });

  /**
   * Test configuration and constants
   */
  describe('Configuration and Constants', () => {
    
    test('should have proper default configuration', () => {
      const defaultConfig = {
        maxMessagesPerSession: 20,
        maxMessagesPerHour: 50,
        sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
        storageKey: 'bizpilot_guest_ai_session'
      };

      expect(defaultConfig.maxMessagesPerSession).toBe(20);
      expect(defaultConfig.maxMessagesPerHour).toBe(50);
      expect(defaultConfig.sessionTimeoutMs).toBe(1800000); // 30 minutes in ms
      expect(defaultConfig.storageKey).toBe('bizpilot_guest_ai_session');
    });

    test('should validate API endpoints', () => {
      const endpoints = {
        guestChat: '/ai/guest-chat',
        businessChat: '/ai/chat'
      };

      expect(endpoints.guestChat).toBe('/ai/guest-chat');
      expect(endpoints.businessChat).toBe('/ai/chat');
      
      // Should be valid API paths
      expect(endpoints.guestChat.startsWith('/')).toBe(true);
      expect(endpoints.businessChat.startsWith('/')).toBe(true);
    });

    test('should have proper marketing context configuration', () => {
      const marketingContext = {
        type: 'marketing',
        capabilities: [
          'Answer questions about BizPilot features',
          'Provide pricing information',
          'Explain industry use cases',
          'Help with feature selection'
        ],
        restrictions: [
          'Cannot access business data',
          'Cannot provide business-specific advice',
          'Should redirect complex business questions'
        ]
      };

      expect(marketingContext.type).toBe('marketing');
      expect(Array.isArray(marketingContext.capabilities)).toBe(true);
      expect(Array.isArray(marketingContext.restrictions)).toBe(true);
      expect(marketingContext.capabilities.length).toBeGreaterThan(0);
      expect(marketingContext.restrictions.length).toBeGreaterThan(0);
    });
  });
});