/**
 * Property-Based Tests for Guest AI Widget Functionality
 * 
 * These tests validate universal properties that should hold true for
 * guest AI widget functionality across all marketing pages using property-based testing.
 * 
 * **Feature: pricing-consistency-and-guest-ai-widget, Property 2: Guest AI Widget Functionality**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalAIChat } from '@/components/ai/GlobalAIChat';
import { useGuestAISession } from '@/hooks/useGuestAISession';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';

// Mock dependencies
jest.mock('@/hooks/useGuestAISession');
jest.mock('@/store/authStore');
jest.mock('@/lib/api');
jest.mock('../../../shared/marketing-ai-context');
jest.mock('next/navigation');

const mockUseGuestAISession = useGuestAISession as jest.MockedFunction<typeof useGuestAISession>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

/**
 * Property 2: Guest AI Widget Functionality
 * 
 * For any guest user on any marketing page, the AI widget should be accessible,
 * provide marketing-focused responses, redirect business questions appropriately,
 * and implement proper rate limiting.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */
describe('Property 2: Guest AI Widget Functionality', () => {

  // Marketing routes where AI widget should be available
  const MARKETING_ROUTES = [
    '/',
    '/features',
    '/industries',
    '/pricing',
    '/faq'
  ];

  // Generate test cases for AI widget functionality
  const generateAIWidgetTestCases = () => {
    const testCases: Array<{
      route: string;
      isAuthenticated: boolean;
      sessionState: any;
      messageContent: string;
      expectedBehavior: string;
      description: string;
    }> = [];

    // Test each marketing route with various user states
    MARKETING_ROUTES.forEach(route => {
      // Guest user with active session
      testCases.push({
        route,
        isAuthenticated: false,
        sessionState: {
          session: {
            id: `session-${Date.now()}`,
            createdAt: Date.now(),
            messageCount: 0,
            lastActivity: Date.now()
          },
          canSendMessage: true,
          messagesRemaining: 20,
          rateLimitMessage: '',
          isSessionActive: true
        },
        messageContent: 'What features does BizPilot have?',
        expectedBehavior: 'marketing_response',
        description: `Guest user with active session on ${route}`
      });

      // Guest user approaching rate limit
      testCases.push({
        route,
        isAuthenticated: false,
        sessionState: {
          session: {
            id: `session-${Date.now()}`,
            createdAt: Date.now(),
            messageCount: 18,
            lastActivity: Date.now()
          },
          canSendMessage: true,
          messagesRemaining: 2,
          rateLimitMessage: '',
          isSessionActive: true
        },
        messageContent: 'How much does BizPilot cost?',
        expectedBehavior: 'marketing_response_with_signup_prompt',
        description: `Guest user approaching rate limit on ${route}`
      });

      // Guest user rate limited
      testCases.push({
        route,
        isAuthenticated: false,
        sessionState: {
          session: {
            id: `session-${Date.now()}`,
            createdAt: Date.now(),
            messageCount: 20,
            lastActivity: Date.now()
          },
          canSendMessage: false,
          messagesRemaining: 0,
          rateLimitMessage: 'You have reached the message limit. Please try again later.',
          isSessionActive: true
        },
        messageContent: 'Any message',
        expectedBehavior: 'rate_limit_message',
        description: `Rate limited guest user on ${route}`
      });

      // Business-specific question
      testCases.push({
        route,
        isAuthenticated: false,
        sessionState: {
          session: {
            id: `session-${Date.now()}`,
            createdAt: Date.now(),
            messageCount: 5,
            lastActivity: Date.now()
          },
          canSendMessage: true,
          messagesRemaining: 15,
          rateLimitMessage: '',
          isSessionActive: true
        },
        messageContent: 'What are my sales for this month?',
        expectedBehavior: 'business_redirect_response',
        description: `Business question from guest on ${route}`
      });
    });

    return testCases;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock navigation
    jest.mocked(require('next/navigation').usePathname).mockReturnValue('/');
  });

  // Property test: AI widget should be accessible on all marketing pages for guests
  test('should render AI widget on all marketing pages for guest users', async () => {
    const testCases = generateAIWidgetTestCases();
    
    // Run property test with minimum 100 iterations
    for (let iteration = 0; iteration < Math.max(100, testCases.length * 2); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Setup mocks for this test case
      jest.mocked(require('next/navigation').usePathname).mockReturnValue(testCase.route);
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: testCase.isAuthenticated,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      mockUseGuestAISession.mockReturnValue({
        ...testCase.sessionState,
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      // Property: AI widget trigger should be present for guest users on marketing pages
      if (!testCase.route.startsWith('/ai')) {
        const triggerButton = screen.getByLabelText('Open AI Chat');
        expect(triggerButton).toBeInTheDocument();
        expect(triggerButton).toHaveClass('fixed');
        
        // Property: Widget should be positioned correctly
        expect(triggerButton).toHaveStyle('position: fixed');
        
        // Property: Widget should have proper z-index for overlay
        expect(triggerButton).toHaveClass('z-50');
      }
      
      unmount();
    }
  });

  // Property test: AI widget should provide marketing context for guest users
  test('should provide marketing context and appropriate responses for guests', async () => {
    const testCases = generateAIWidgetTestCases();
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Setup mocks
      jest.mocked(require('next/navigation').usePathname).mockReturnValue(testCase.route);
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      mockUseGuestAISession.mockReturnValue({
        ...testCase.sessionState,
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      // Open widget
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        // Property: Widget should show guest context indicator
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
        expect(screen.getByText('Guest')).toBeInTheDocument();
        
        // Property: Should show marketing-specific placeholder
        const input = screen.getByPlaceholderText(/Ask about BizPilot features, pricing/);
        expect(input).toBeInTheDocument();
        
        // Property: Should show marketing welcome message
        expect(screen.getByText(/Hi! I can help you learn about BizPilot features/)).toBeInTheDocument();
        
        // Property: Should show rate limit information
        expect(screen.getByText(/Messages remaining:/)).toBeInTheDocument();
      });
      
      unmount();
    }
  });

  // Property test: AI widget should handle rate limiting consistently
  test('should implement consistent rate limiting behavior', async () => {
    const testCases = generateAIWidgetTestCases();
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Only test rate limiting scenarios
      if (!testCase.sessionState.canSendMessage) {
        mockUseAuthStore.mockReturnValue({
          isAuthenticated: false,
          isInitialized: true,
          fetchUser: jest.fn()
        } as any);
        
        mockUseGuestAISession.mockReturnValue({
          ...testCase.sessionState,
          updateSessionActivity: jest.fn(),
          trackAnalytics: jest.fn(),
          sessionTimeRemaining: 1800000
        } as any);

        const { unmount } = render(<GlobalAIChat />);
        
        const triggerButton = screen.getByLabelText('Open AI Chat');
        fireEvent.click(triggerButton);
        
        await waitFor(() => {
          const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
          const sendButton = screen.getByRole('button', { name: /send/i });
          
          // Property: Input and send button should be disabled when rate limited
          expect(input).toBeDisabled();
          expect(sendButton).toBeDisabled();
          
          // Property: Rate limit message should be displayed
          expect(screen.getByText(/Messages remaining: 0/)).toBeInTheDocument();
        });
        
        unmount();
      }
    }
  });

  // Property test: AI widget should handle message sending consistently
  test('should handle message sending with proper validation and API calls', async () => {
    const testCases = generateAIWidgetTestCases().filter(tc => tc.sessionState.canSendMessage);
    
    for (let iteration = 0; iteration < Math.min(50, testCases.length); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Setup API mock based on expected behavior
      if (testCase.expectedBehavior === 'marketing_response') {
        mockApiClient.post.mockResolvedValue({
          data: {
            response: 'BizPilot offers comprehensive business management tools including POS, inventory, and analytics.',
            conversation_id: 'conv-123'
          }
        });
      } else if (testCase.expectedBehavior === 'business_redirect_response') {
        mockApiClient.post.mockResolvedValue({
          data: {
            response: 'For detailed business analysis, please sign up for a free account to access full AI capabilities.',
            conversation_id: 'conv-123'
          }
        });
      }
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      const mockTrackAnalytics = jest.fn();
      const mockUpdateSessionActivity = jest.fn();
      
      mockUseGuestAISession.mockReturnValue({
        ...testCase.sessionState,
        updateSessionActivity: mockUpdateSessionActivity,
        trackAnalytics: mockTrackAnalytics,
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: testCase.messageContent } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      // Property: Should call guest AI endpoint with correct parameters
      expect(mockApiClient.post).toHaveBeenCalledWith('/ai/guest-chat', {
        message: testCase.messageContent,
        conversation_id: null,
        session_id: testCase.sessionState.session.id
      });
      
      // Property: Should track analytics for message sending
      expect(mockTrackAnalytics).toHaveBeenCalledWith('message_sent', {
        messageLength: testCase.messageContent.length,
        conversationLength: 1
      });
      
      await waitFor(() => {
        // Property: Should update session activity after successful response
        expect(mockUpdateSessionActivity).toHaveBeenCalled();
        
        // Property: Should track analytics for message received
        expect(mockTrackAnalytics).toHaveBeenCalledWith('message_received', expect.any(Object));
      });
      
      unmount();
      jest.clearAllMocks();
    }
  });

  // Property test: AI widget should handle errors gracefully
  test('should handle API errors gracefully with appropriate fallback messages', async () => {
    const testCases = generateAIWidgetTestCases().filter(tc => tc.sessionState.canSendMessage);
    
    for (let iteration = 0; iteration < 50; iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Mock API error
      mockApiClient.post.mockRejectedValue(new Error('Network error'));
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      const mockTrackAnalytics = jest.fn();
      
      mockUseGuestAISession.mockReturnValue({
        ...testCase.sessionState,
        updateSessionActivity: jest.fn(),
        trackAnalytics: mockTrackAnalytics,
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: testCase.messageContent } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        // Property: Should display marketing-specific error message with contact info
        expect(screen.getByText(/contact our sales team at sales@bizpilot.co.za/)).toBeInTheDocument();
        
        // Property: Should track error analytics
        expect(mockTrackAnalytics).toHaveBeenCalledWith('message_error', {
          error: 'Network error'
        });
      });
      
      unmount();
      jest.clearAllMocks();
    }
  });

  // Property test: AI widget should handle input validation consistently
  test('should validate user input consistently across all scenarios', async () => {
    const inputTestCases = [
      { input: '', shouldBeDisabled: true, description: 'Empty input' },
      { input: '   ', shouldBeDisabled: true, description: 'Whitespace only' },
      { input: 'a', shouldBeDisabled: false, description: 'Single character' },
      { input: 'Valid question about BizPilot?', shouldBeDisabled: false, description: 'Valid question' },
      { input: 'x'.repeat(1000), shouldBeDisabled: false, description: 'Long input' },
      { input: 'Special chars: !@#$%^&*()', shouldBeDisabled: false, description: 'Special characters' }
    ];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const inputCase = inputTestCases[iteration % inputTestCases.length];
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      mockUseGuestAISession.mockReturnValue({
        session: { id: 'test-session', createdAt: Date.now(), messageCount: 0, lastActivity: Date.now() },
        canSendMessage: true,
        messagesRemaining: 20,
        rateLimitMessage: '',
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        isSessionActive: true,
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: inputCase.input } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        
        // Property: Send button should be disabled for empty/whitespace input
        if (inputCase.shouldBeDisabled) {
          expect(sendButton).toBeDisabled();
        } else {
          expect(sendButton).not.toBeDisabled();
        }
      });
      
      unmount();
    }
  });

  // Property test: AI widget should maintain consistent state across interactions
  test('should maintain consistent widget state across multiple interactions', async () => {
    const conversationStates = [
      { messageCount: 0, messagesRemaining: 20 },
      { messageCount: 5, messagesRemaining: 15 },
      { messageCount: 15, messagesRemaining: 5 },
      { messageCount: 19, messagesRemaining: 1 }
    ];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const state = conversationStates[iteration % conversationStates.length];
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      mockUseGuestAISession.mockReturnValue({
        session: {
          id: 'test-session',
          createdAt: Date.now(),
          messageCount: state.messageCount,
          lastActivity: Date.now()
        },
        canSendMessage: state.messagesRemaining > 0,
        messagesRemaining: state.messagesRemaining,
        rateLimitMessage: state.messagesRemaining === 0 ? 'Rate limited' : '',
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        isSessionActive: true,
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        // Property: Rate limit display should be consistent with session state
        expect(screen.getByText(`Messages remaining: ${state.messagesRemaining}`)).toBeInTheDocument();
        
        // Property: Warning should appear when approaching limit
        if (state.messagesRemaining <= 5 && state.messagesRemaining > 0) {
          expect(screen.getByText(/Sign up for unlimited messages!/)).toBeInTheDocument();
        }
        
        // Property: Input should be disabled when rate limited
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        const sendButton = screen.getByRole('button', { name: /send/i });
        
        if (state.messagesRemaining === 0) {
          expect(input).toBeDisabled();
          expect(sendButton).toBeDisabled();
        } else {
          expect(input).not.toBeDisabled();
        }
      });
      
      unmount();
    }
  });

  // Property test: AI widget should handle context switching correctly
  test('should handle authentication context switching correctly', async () => {
    const authStates = [
      { isAuthenticated: false, isInitialized: true },
      { isAuthenticated: true, isInitialized: true },
      { isAuthenticated: false, isInitialized: false }
    ];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const authState = authStates[iteration % authStates.length];
      
      mockUseAuthStore.mockReturnValue({
        ...authState,
        fetchUser: jest.fn()
      } as any);
      
      mockUseGuestAISession.mockReturnValue({
        session: { id: 'test-session', createdAt: Date.now(), messageCount: 0, lastActivity: Date.now() },
        canSendMessage: true,
        messagesRemaining: 20,
        rateLimitMessage: '',
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        isSessionActive: true,
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      // Property: Widget should render for guests and authenticated users
      if (authState.isInitialized) {
        const triggerButton = screen.getByLabelText('Open AI Chat');
        expect(triggerButton).toBeInTheDocument();
        
        fireEvent.click(triggerButton);
        
        await waitFor(() => {
          if (authState.isAuthenticated) {
            // Property: Authenticated users should see business context
            expect(screen.getByText('AI Assistant')).toBeInTheDocument();
            expect(screen.queryByText('Guest')).not.toBeInTheDocument();
            expect(screen.getByPlaceholderText(/Ask about sales, inventory, pricing/)).toBeInTheDocument();
          } else {
            // Property: Guest users should see marketing context
            expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
            expect(screen.getByText('Guest')).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/Ask about BizPilot features, pricing/)).toBeInTheDocument();
          }
        });
      }
      
      unmount();
    }
  });

  // Property test: AI widget should handle viewport changes gracefully
  test('should handle different viewport sizes and orientations', async () => {
    const viewportSizes = [
      { width: 375, height: 667, description: 'Mobile portrait' },
      { width: 667, height: 375, description: 'Mobile landscape' },
      { width: 768, height: 1024, description: 'Tablet portrait' },
      { width: 1024, height: 768, description: 'Tablet landscape' },
      { width: 1920, height: 1080, description: 'Desktop' }
    ];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const viewport = viewportSizes[iteration % viewportSizes.length];
      
      // Mock viewport size
      Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true });
      
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      mockUseGuestAISession.mockReturnValue({
        session: { id: 'test-session', createdAt: Date.now(), messageCount: 0, lastActivity: Date.now() },
        canSendMessage: true,
        messagesRemaining: 20,
        rateLimitMessage: '',
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        isSessionActive: true,
        sessionTimeRemaining: 1800000
      } as any);

      const { unmount } = render(<GlobalAIChat />);
      
      // Property: Widget should be accessible on all viewport sizes
      const triggerButton = screen.getByLabelText('Open AI Chat');
      expect(triggerButton).toBeInTheDocument();
      expect(triggerButton).toHaveClass('fixed');
      
      // Property: Widget should open and be usable on all viewport sizes
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
        
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        expect(input).toBeInTheDocument();
        expect(input).not.toBeDisabled();
      });
      
      unmount();
    }
  });
});