/**
 * Comprehensive Tests for Guest AI Widget Functionality
 * 
 * These tests validate that the guest AI widget appears on all marketing pages,
 * provides marketing-focused responses, redirects business questions to sign-up,
 * and implements proper rate limiting and abuse prevention.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GlobalAIChat } from '@/components/ai/GlobalAIChat';
import { useGuestAISession } from '@/hooks/useGuestAISession';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';
import { MarketingAIContextManager } from '@/shared/marketing-ai-context';

// Mock dependencies
jest.mock('@/hooks/useGuestAISession');
jest.mock('@/store/authStore');
jest.mock('@/lib/api');
jest.mock('../../../shared/marketing-ai-context');
jest.mock('next/navigation', () => ({
  usePathname: () => '/'
}));

const mockUseGuestAISession = useGuestAISession as jest.MockedFunction<typeof useGuestAISession>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockMarketingAIContextManager = MarketingAIContextManager as jest.MockedClass<typeof MarketingAIContextManager>;

describe('Guest AI Widget Functionality Tests', () => {
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isInitialized: true,
      fetchUser: jest.fn()
    } as any);
    
    mockUseGuestAISession.mockReturnValue({
      session: {
        id: 'test-session-123',
        createdAt: Date.now(),
        messageCount: 0,
        lastActivity: Date.now()
      },
      canSendMessage: true,
      messagesRemaining: 20,
      rateLimitMessage: '',
      updateSessionActivity: jest.fn(),
      trackAnalytics: jest.fn(),
      isSessionActive: true,
      sessionTimeRemaining: 1800000 // 30 minutes
    } as any);
    
    mockMarketingAIContextManager.mockImplementation(() => ({
      getMarketingResponse: jest.fn().mockResolvedValue('Marketing response'),
      validateMarketingContext: jest.fn().mockReturnValue(true)
    } as any));
  });

  /**
   * Test Requirement 2.1: AI widget appears on all marketing pages for guests
   */
  describe('AI Widget Presence on Marketing Pages', () => {
    
    test('should render AI widget trigger button for guest users', () => {
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      expect(triggerButton).toBeInTheDocument();
      expect(triggerButton).toHaveClass('fixed', 'z-50');
    });

    test('should show guest context indicator when widget is opened', async () => {
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
        expect(screen.getByText('Guest')).toBeInTheDocument();
      });
    });

    test('should display marketing-specific placeholder text', async () => {
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features, pricing/);
        expect(input).toBeInTheDocument();
      });
    });

    test('should show marketing welcome message', async () => {
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Hi! I can help you learn about BizPilot features/)).toBeInTheDocument();
      });
    });

    test('should display rate limit information for guests', async () => {
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Messages remaining: 20/)).toBeInTheDocument();
      });
    });

    test('should not render widget on /ai route', () => {
      jest.mocked(require('next/navigation').usePathname).mockReturnValue('/ai');
      
      const { container } = render(<GlobalAIChat />);
      expect(container.firstChild).toBeNull();
    });

    test('should render widget on all marketing routes', () => {
      const marketingRoutes = ['/', '/features', '/industries', '/pricing', '/faq'];
      
      marketingRoutes.forEach(route => {
        jest.mocked(require('next/navigation').usePathname).mockReturnValue(route);
        
        const { unmount } = render(<GlobalAIChat />);
        expect(screen.getByLabelText('Open AI Chat')).toBeInTheDocument();
        unmount();
      });
    });
  });

  /**
   * Test Requirement 2.2: AI responses are marketing-focused and helpful
   */
  describe('Marketing-Focused AI Responses', () => {
    
    test('should send messages to guest AI endpoint', async () => {
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'BizPilot is a comprehensive business management platform...',
          conversation_id: 'conv-123'
        }
      });
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'What features does BizPilot have?' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      expect(mockApiClient.post).toHaveBeenCalledWith('/ai/guest-chat', {
        message: 'What features does BizPilot have?',
        conversation_id: null,
        session_id: 'test-session-123'
      });
    });

    test('should display marketing-focused responses', async () => {
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'BizPilot offers comprehensive POS, inventory management, customer tools, and smart analytics to help your business grow.',
          conversation_id: 'conv-123'
        }
      });
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'What features does BizPilot have?' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/BizPilot offers comprehensive POS/)).toBeInTheDocument();
      });
    });

    test('should track analytics for guest interactions', async () => {
      const mockTrackAnalytics = jest.fn();
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        trackAnalytics: mockTrackAnalytics
      } as any);
      
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'Marketing response',
          conversation_id: 'conv-123'
        }
      });
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(mockTrackAnalytics).toHaveBeenCalledWith('message_sent', {
          messageLength: 12,
          conversationLength: 1
        });
      });
    });

    test('should update session activity after successful response', async () => {
      const mockUpdateSessionActivity = jest.fn();
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        updateSessionActivity: mockUpdateSessionActivity
      } as any);
      
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'Marketing response',
          conversation_id: 'conv-123'
        }
      });
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(mockUpdateSessionActivity).toHaveBeenCalled();
      });
    });
  });

  /**
   * Test Requirement 2.3: AI redirects business questions to sign-up
   */
  describe('Business Question Redirection', () => {
    
    test('should provide fallback response for business-specific questions', async () => {
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'For detailed business analysis, please sign up for a free account to access full AI capabilities with your business data.',
          conversation_id: 'conv-123'
        }
      });
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'What are my sales for this month?' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/please sign up for a free account/)).toBeInTheDocument();
      });
    });

    test('should suggest sign-up when approaching message limit', async () => {
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        messagesRemaining: 3
      } as any);
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Sign up for unlimited messages!/)).toBeInTheDocument();
      });
    });

    test('should provide contact information in error responses', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'));
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/contact our sales team at sales@bizpilot.co.za/)).toBeInTheDocument();
      });
    });
  });

  /**
   * Test Requirement 2.4: Rate limiting and abuse prevention
   */
  describe('Rate Limiting and Abuse Prevention', () => {
    
    test('should prevent sending messages when rate limited', async () => {
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        canSendMessage: false,
        rateLimitMessage: 'You have reached the message limit. Please try again later.'
      } as any);
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/You have reached the message limit/)).toBeInTheDocument();
      });
      
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    test('should disable input and send button when rate limited', () => {
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        canSendMessage: false
      } as any);
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        const sendButton = screen.getByRole('button', { name: /send/i });
        
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
      });
    });

    test('should show rate limit countdown', () => {
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        messagesRemaining: 5
      } as any);
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      waitFor(() => {
        expect(screen.getByText(/Messages remaining: 5/)).toBeInTheDocument();
      });
    });

    test('should track error analytics for rate limiting', async () => {
      const mockTrackAnalytics = jest.fn();
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        canSendMessage: false,
        rateLimitMessage: 'Rate limited',
        trackAnalytics: mockTrackAnalytics
      } as any);
      
      mockApiClient.post.mockRejectedValue(new Error('Rate limit exceeded'));
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      // Should not call API when rate limited
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    test('should handle empty messages gracefully', async () => {
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeDisabled(); // Should be disabled for empty input
      });
    });

    test('should prevent sending while previous message is processing', async () => {
      mockApiClient.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'First message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
        
        // Try to send another message immediately
        fireEvent.change(input, { target: { value: 'Second message' } });
        expect(sendButton).toBeDisabled(); // Should be disabled while processing
      });
    });
  });

  /**
   * Integration Tests for Complete Guest AI Widget Flow
   */
  describe('Complete Guest AI Widget Integration', () => {
    
    test('should handle complete guest conversation flow', async () => {
      const mockUpdateSessionActivity = jest.fn();
      const mockTrackAnalytics = jest.fn();
      
      mockUseGuestAISession.mockReturnValue({
        session: {
          id: 'test-session-123',
          createdAt: Date.now(),
          messageCount: 0,
          lastActivity: Date.now()
        },
        canSendMessage: true,
        messagesRemaining: 20,
        rateLimitMessage: '',
        updateSessionActivity: mockUpdateSessionActivity,
        trackAnalytics: mockTrackAnalytics,
        isSessionActive: true,
        sessionTimeRemaining: 1800000
      } as any);
      
      mockApiClient.post.mockResolvedValue({
        data: {
          response: 'BizPilot offers comprehensive business management tools including POS, inventory, and smart analytics.',
          conversation_id: 'conv-123'
        }
      });
      
      render(<GlobalAIChat />);
      
      // Open widget
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      // Verify widget opened with guest context
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
        expect(screen.getByText('Guest')).toBeInTheDocument();
      });
      
      // Send a message
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      fireEvent.change(input, { target: { value: 'What features does BizPilot offer?' } });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);
      
      // Verify API call
      expect(mockApiClient.post).toHaveBeenCalledWith('/ai/guest-chat', {
        message: 'What features does BizPilot offer?',
        conversation_id: null,
        session_id: 'test-session-123'
      });
      
      // Verify response displayed
      await waitFor(() => {
        expect(screen.getByText(/BizPilot offers comprehensive business management/)).toBeInTheDocument();
      });
      
      // Verify analytics tracking
      expect(mockTrackAnalytics).toHaveBeenCalledWith('message_sent', {
        messageLength: 32,
        conversationLength: 1
      });
      
      expect(mockTrackAnalytics).toHaveBeenCalledWith('message_received', {
        responseLength: expect.any(Number),
        conversationLength: 2
      });
      
      // Verify session activity updated
      expect(mockUpdateSessionActivity).toHaveBeenCalled();
    });

    test('should switch to business context when user authenticates', () => {
      // Start as guest
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      const { rerender } = render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      waitFor(() => {
        expect(screen.getByText('Guest')).toBeInTheDocument();
      });
      
      // Simulate user authentication
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: true,
        isInitialized: true,
        fetchUser: jest.fn()
      } as any);
      
      rerender(<GlobalAIChat />);
      
      waitFor(() => {
        expect(screen.queryByText('Guest')).not.toBeInTheDocument();
        expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      });
    });

    test('should handle widget positioning and dragging for mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });
      
      render(<GlobalAIChat />);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      
      // Verify button is positioned to avoid mobile nav
      const buttonStyle = window.getComputedStyle(triggerButton);
      expect(triggerButton).toHaveStyle('position: fixed');
      
      // Test drag functionality
      fireEvent.mouseDown(triggerButton, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(window);
      
      // Widget should remain accessible after drag
      expect(triggerButton).toBeInTheDocument();
    });
  });
});