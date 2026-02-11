/**
 * Integration Tests for Guest AI Widget Across Marketing Pages
 * 
 * These tests validate that the guest AI widget works correctly across all
 * marketing pages with proper marketing context, rate limiting, and user experience.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarketingLayoutClient } from '@/components/layout/MarketingLayoutClient';
import { GlobalAIChat } from '@/components/ai/GlobalAIChat';
import { useGuestAISession } from '@/hooks/useGuestAISession';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';

// Mock dependencies
jest.mock('@/hooks/useGuestAISession');
jest.mock('@/store/authStore');
jest.mock('@/lib/api');
jest.mock('@/shared/marketing-ai-context');
jest.mock('next/navigation');

const mockUseGuestAISession = useGuestAISession as jest.MockedFunction<typeof useGuestAISession>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock marketing page components (MarketingLayoutClient already includes GlobalAIChat)
const MockMarketingPage = ({ children }: { children: React.ReactNode }) => (
  <MarketingLayoutClient>
    <div data-testid="marketing-page">
      {children}
    </div>
  </MarketingLayoutClient>
);

describe('Guest AI Widget Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock pathname to marketing route by default
    jest.mocked(require('next/navigation').usePathname).mockReturnValue('/');
    
    // Default mock setup for guest user
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
      rateLimitMessage: jest.fn().mockReturnValue(''),
      updateSessionActivity: jest.fn(),
      trackAnalytics: jest.fn(),
      isSessionActive: true,
      sessionTimeRemaining: 1800000
    } as any);
    
    // Mock successful API response
    mockApiClient.post.mockResolvedValue({
      data: {
        response: 'BizPilot is a comprehensive business management platform with POS, inventory, and analytics features.',
        conversation_id: 'conv-123'
      }
    });
  });

  /**
   * Test AI widget presence across all marketing pages
   */
  describe('AI Widget Presence Across Marketing Pages', () => {
    
    const marketingPages = [
      { route: '/', name: 'Home Page' },
      { route: '/features', name: 'Features Page' },
      { route: '/industries', name: 'Industries Page' },
      { route: '/pricing', name: 'Pricing Page' },
      { route: '/faq', name: 'FAQ Page' }
    ];

    marketingPages.forEach(({ route, name }) => {
      test(`should render AI widget on ${name}`, () => {
        jest.mocked(require('next/navigation').usePathname).mockReturnValue(route);
        
        render(
          <MockMarketingPage>
            <h1>{name}</h1>
          </MockMarketingPage>
        );
        
        expect(screen.getByText(name)).toBeInTheDocument();
        expect(screen.getByLabelText('Open AI Chat')).toBeInTheDocument();
        
        const triggerButton = screen.getByLabelText('Open AI Chat');
        expect(triggerButton).toHaveClass('fixed', 'z-50');
      });

      test(`should open AI widget with guest context on ${name}`, async () => {
        jest.mocked(require('next/navigation').usePathname).mockReturnValue(route);
        
        render(
          <MockMarketingPage>
            <h1>{name}</h1>
          </MockMarketingPage>
        );
        
        const triggerButton = screen.getByLabelText('Open AI Chat');
        fireEvent.click(triggerButton);
        
        await waitFor(() => {
          expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
          expect(screen.getByText('Guest')).toBeInTheDocument();
          expect(screen.getByPlaceholderText(/Ask about BizPilot features, pricing/)).toBeInTheDocument();
        });
      });
    });

    test('should not render AI widget on /ai route', () => {
      jest.mocked(require('next/navigation').usePathname).mockReturnValue('/ai');
      
      render(
        <MockMarketingPage>
          <h1>AI Page</h1>
        </MockMarketingPage>
      );
      
      expect(screen.queryByLabelText('Open AI Chat')).not.toBeInTheDocument();
    });
  });

  /**
   * Test marketing-focused responses
   */
  describe('Marketing-Focused AI Responses', () => {
    
    const marketingQuestions = [
      {
        question: 'What features does BizPilot have?',
        expectedKeywords: ['POS', 'inventory', 'management', 'features']
      },
      {
        question: 'How much does BizPilot cost?',
        expectedKeywords: ['pricing', 'plans', 'cost', 'subscription']
      },
      {
        question: 'What industries does BizPilot serve?',
        expectedKeywords: ['restaurant', 'retail', 'business', 'industries']
      },
      {
        question: 'How do I get started with BizPilot?',
        expectedKeywords: ['started', 'setup', 'trial', 'account']
      }
    ];

    marketingQuestions.forEach(({ question, expectedKeywords }) => {
      test(`should provide marketing response for: "${question}"`, async () => {
        mockApiClient.post.mockResolvedValue({
          data: {
            response: `BizPilot offers comprehensive business management tools including ${expectedKeywords.join(', ')} to help your business grow.`,
            conversation_id: 'conv-123'
          }
        });
        
        render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
        
        const triggerButton = screen.getByLabelText('Open AI Chat');
        fireEvent.click(triggerButton);
        
        await waitFor(() => {
          const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
          fireEvent.change(input, { target: { value: question } });
          
          const sendButton = screen.getByRole('button', { name: /send/i });
          fireEvent.click(sendButton);
        });
        
        expect(mockApiClient.post).toHaveBeenCalledWith('/ai/guest-chat', {
          message: question,
          conversation_id: null,
          session_id: 'test-session-123'
        });
        
        await waitFor(() => {
          const responseText = screen.getByText(/BizPilot offers comprehensive business management/);
          expect(responseText).toBeInTheDocument();
          
          expectedKeywords.forEach(keyword => {
            expect(responseText.textContent).toMatch(new RegExp(keyword, 'i'));
          });
        });
      });
    });

    test('should track analytics for guest interactions', async () => {
      const mockTrackAnalytics = jest.fn();
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        trackAnalytics: mockTrackAnalytics
      } as any);
      
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test marketing question' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      expect(mockTrackAnalytics).toHaveBeenCalledWith('message_sent', {
        messageLength: 23,
        conversationLength: 1
      });
      
      await waitFor(() => {
        expect(mockTrackAnalytics).toHaveBeenCalledWith('message_received', {
          responseLength: expect.any(Number),
          conversationLength: 2
        });
      });
    });
  });

  /**
   * Test business question redirection
   */
  describe('Business Question Redirection', () => {
    
    const businessQuestions = [
      'What are my sales for this month?',
      'Show me my inventory levels',
      'How many customers do I have?',
      'What is my profit margin?',
      'Generate a sales report',
      'Update my product prices'
    ];

    businessQuestions.forEach(question => {
      test(`should redirect business question: "${question}"`, async () => {
        mockApiClient.post.mockResolvedValue({
          data: {
            response: 'For detailed business analysis and access to your data, please sign up for a free account to unlock full AI capabilities.',
            conversation_id: 'conv-123'
          }
        });
        
        render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
        
        const triggerButton = screen.getByLabelText('Open AI Chat');
        fireEvent.click(triggerButton);
        
        await waitFor(() => {
          const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
          fireEvent.change(input, { target: { value: question } });
          
          const sendButton = screen.getByRole('button', { name: /send/i });
          fireEvent.click(sendButton);
        });
        
        await waitFor(() => {
          expect(screen.getByText(/please sign up for a free account/)).toBeInTheDocument();
        });
      });
    });

    test('should suggest sign-up when approaching rate limit', async () => {
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        messagesRemaining: 3
      } as any);
      
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Sign up for unlimited messages!/)).toBeInTheDocument();
      });
    });
  });

  /**
   * Test rate limiting and abuse prevention
   */
  describe('Rate Limiting and Abuse Prevention', () => {
    
    test('should enforce message rate limits', () => {
      mockUseGuestAISession.mockReturnValue({
        session: {
          id: 'test-session-123',
          createdAt: Date.now(),
          messageCount: 20,
          lastActivity: Date.now()
        },
        canSendMessage: false,
        messagesRemaining: 0,
        rateLimitMessage: jest.fn().mockReturnValue('You have reached the maximum of 20 messages for this session.'),
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        isSessionActive: true,
        sessionTimeRemaining: 1800000
      } as any);
      
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
      expect(screen.getByText(/Messages remaining: 0/)).toBeInTheDocument();
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    test('should handle session timeout gracefully', () => {
      mockUseGuestAISession.mockReturnValue({
        session: null,
        canSendMessage: false,
        messagesRemaining: 0,
        rateLimitMessage: jest.fn().mockReturnValue('Session expired. Please refresh to start a new session.'),
        updateSessionActivity: jest.fn(),
        trackAnalytics: jest.fn(),
        isSessionActive: false,
        sessionTimeRemaining: 0
      } as any);
      
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    test('should prevent rapid message sending', async () => {
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      fireEvent.change(input, { target: { value: 'First message' } });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);
      
      fireEvent.change(input, { target: { value: 'Second message' } });
      expect(sendButton).toBeDisabled();
    });

    test('should validate message length', () => {
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      fireEvent.change(input, { target: { value: '' } });
      expect(sendButton).toBeDisabled();
      
      fireEvent.change(input, { target: { value: '   ' } });
      expect(sendButton).toBeDisabled();
      
      fireEvent.change(input, { target: { value: 'Valid message' } });
      expect(sendButton).not.toBeDisabled();
    });
  });

  /**
   * Test error handling
   */
  describe('Error Handling', () => {
    
    test('should handle API errors gracefully', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'));
      
      const mockTrackAnalytics = jest.fn();
      mockUseGuestAISession.mockReturnValue({
        ...mockUseGuestAISession(),
        trackAnalytics: mockTrackAnalytics
      } as any);
      
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
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
      
      expect(mockTrackAnalytics).toHaveBeenCalledWith('message_error', {
        error: 'Network error'
      });
    });

    test('should handle malformed API responses', async () => {
      mockApiClient.post.mockResolvedValue({
        data: null
      });
      
      render(<MockMarketingPage><div>Test Page</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        fireEvent.click(sendButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test responsive behavior
   */
  describe('Responsive Behavior', () => {
    
    test('should adapt to mobile viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });
      
      render(<MockMarketingPage><div>Mobile Test</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      expect(triggerButton).toBeInTheDocument();
      expect(triggerButton.className).toMatch(/fixed/);
      
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
      });
    });

    test('should handle tablet viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });
      
      render(<MockMarketingPage><div>Tablet Test</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
      });
    });

    test('should handle desktop viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
      
      render(<MockMarketingPage><div>Desktop Test</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test accessibility
   */
  describe('Accessibility', () => {
    
    test('should have proper ARIA labels and roles', async () => {
      render(<MockMarketingPage><div>Accessibility Test</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      expect(triggerButton).toHaveAttribute('aria-label', 'Open AI Chat');
      
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close');
        expect(closeButton).toHaveAttribute('aria-label', 'Close');
        
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        expect(input).toBeInTheDocument();
        
        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeInTheDocument();
      });
    });

    test('should support keyboard navigation', async () => {
      render(<MockMarketingPage><div>Keyboard Test</div></MockMarketingPage>);
      
      const triggerButton = screen.getByLabelText('Open AI Chat');
      
      triggerButton.focus();
      expect(document.activeElement).toBe(triggerButton);
      
      fireEvent.click(triggerButton);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
        expect(input).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalled();
      });
    });
  });
});
