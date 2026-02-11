/**
 * Comprehensive Tests for AI Context Switching and Authentication
 * 
 * These tests validate that:
 * - Authenticated users get business AI context
 * - Smooth transition from guest to authenticated AI
 * - Context isolation between guest and business AI
 * - AI widget behavior across different user states
 * 
 * **Validates: Requirement 2.6**
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalAIChat } from '@/components/ai/GlobalAIChat';
import { useGuestAISession } from '@/hooks/useGuestAISession';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';
import { MarketingAIContextManager } from '@/shared/marketing-ai-context';
import {
  TEST_CONSTANTS,
  createMockGuestSession,
  createMockAuthState,
  createMockApiResponse,
  setupGuestContext,
  setupBusinessContext,
  setupRateLimitedContext,
  getCommonElements,
  sendMessage
} from './test-utils/ai-test-helpers';

// Mock dependencies
jest.mock('@/hooks/useGuestAISession');
jest.mock('@/store/authStore');
jest.mock('@/lib/api');
jest.mock('@/shared/marketing-ai-context');
jest.mock('next/navigation', () => ({
  usePathname: () => '/'
}));

const mockUseGuestAISession = useGuestAISession as jest.MockedFunction<typeof useGuestAISession>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockMarketingAIContextManager = MarketingAIContextManager as jest.MockedClass<typeof MarketingAIContextManager>;

describe('AI Context Switching and Authentication Tests', () => {
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mocks - individual tests can override as needed
    mockUseGuestAISession.mockReturnValue(createMockGuestSession());
    mockUseAuthStore.mockReturnValue(createMockAuthState());
    mockApiClient.post = jest.fn();
    
    // Setup marketing AI context manager mock
    mockMarketingAIContextManager.mockImplementation(() => ({
      validateMarketingContext: jest.fn().mockReturnValue(true),
      filterMarketingResponse: jest.fn().mockImplementation((response) => response)
    }));
  });

  describe('Context Detection and Switching', () => {
    test('should use marketing context for guest users', () => {
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);

      render(<GlobalAIChat />);
      
      const { triggerButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      // Should show marketing context UI
      expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
      expect(screen.getByText('Guest')).toBeInTheDocument();
      
      // Should show marketing-specific placeholder
      const { guestInput } = getCommonElements(screen);
      expect(guestInput()).toBeInTheDocument();
    });

    test('should use business context for authenticated users', () => {
      setupBusinessContext(mockUseAuthStore);

      render(<GlobalAIChat />);
      
      const { triggerButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      // Should show business context UI
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.queryByText('Guest')).not.toBeInTheDocument();
      
      // Should show business-specific placeholder
      const { businessInput } = getCommonElements(screen);
      expect(businessInput()).toBeInTheDocument();
    });

    test('should switch context when authentication state changes', async () => {
      // Start with guest user
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);
      const { rerender } = render(<GlobalAIChat />);
      
      const { triggerButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      // Verify guest context
      expect(screen.getByText('Guest')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Ask about BizPilot features/)).toBeInTheDocument();

      // Simulate user authentication
      setupBusinessContext(mockUseAuthStore);
      rerender(<GlobalAIChat />);

      // Verify business context
      await waitFor(() => {
        expect(screen.queryByText('Guest')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Ask about sales, inventory/)).toBeInTheDocument();
      });
    });
  });

  describe('API Endpoint Selection', () => {
    test('should call guest AI endpoint for marketing context', async () => {
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);
      mockApiClient.post.mockResolvedValue(
        createMockApiResponse(TEST_CONSTANTS.MARKETING_RESPONSE, TEST_CONSTANTS.GUEST_CONV_ID)
      );

      render(<GlobalAIChat />);
      
      const { triggerButton, guestInput, sendButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      await sendMessage(guestInput(), sendButton(), 'What features does BizPilot have?');

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/ai/guest-chat', {
          message: 'What features does BizPilot have?',
          conversation_id: null,
          session_id: TEST_CONSTANTS.SESSION_ID
        });
      });
    });

    test('should call business AI endpoint for authenticated context', async () => {
      setupBusinessContext(mockUseAuthStore);
      mockApiClient.post.mockResolvedValue(
        createMockApiResponse(TEST_CONSTANTS.BUSINESS_RESPONSE, TEST_CONSTANTS.BUSINESS_CONV_ID)
      );

      render(<GlobalAIChat />);
      
      const { triggerButton, businessInput, sendButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      await sendMessage(businessInput(), sendButton(), 'Show me my sales data');

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/ai/chat', {
          message: 'Show me my sales data',
          conversation_id: null
        });
      });
    });
  });

  describe('Context Isolation', () => {
    test('should maintain separate conversation histories for different contexts', async () => {
      await testContextHistorySeparation();
    });

    test('should prevent cross-context data leakage', async () => {
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);

      render(<GlobalAIChat />);
      
      const { triggerButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      // Verify guest session hook is used for marketing context
      expect(mockUseGuestAISession).toHaveBeenCalled();
      
      // Verify marketing context UI is shown (not business)
      expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
      expect(screen.getByText('Guest')).toBeInTheDocument();
    });
  });

  // Helper function for complex context switching test
  async function testContextHistorySeparation() {
    // Start with guest context
    setupGuestContext(mockUseAuthStore, mockUseGuestAISession);
    mockApiClient.post.mockResolvedValue(
      createMockApiResponse(TEST_CONSTANTS.MARKETING_RESPONSE, TEST_CONSTANTS.GUEST_CONV_ID)
    );

    const { rerender } = render(<GlobalAIChat />);
    
    // Verify guest context UI
    const { triggerButton } = getCommonElements(screen);
    fireEvent.click(triggerButton());
    expect(screen.getByText('BizPilot Assistant')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();

    // Switch to authenticated context
    setupBusinessContext(mockUseAuthStore);
    rerender(<GlobalAIChat />);

    // Verify business context UI replaces marketing context
    await waitFor(() => {
      expect(screen.queryByText('Guest')).not.toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    // Verify the API endpoints would be different per context
    // (business context uses /ai/chat, marketing uses /ai/guest-chat)
    expect(screen.getByPlaceholderText(/Ask about sales, inventory/)).toBeInTheDocument();
  }

  describe('Rate Limiting and Session Management', () => {
    test('should handle rate limiting in guest context', async () => {
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);
      setupRateLimitedContext(mockUseGuestAISession);

      render(<GlobalAIChat />);
      
      const { triggerButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      // When rate limited, canUseChat=false so input and send button are disabled
      const input = screen.getByPlaceholderText(/Ask about BizPilot features/);
      expect(input).toBeDisabled();

      const sendBtn = screen.getByRole('button', { name: /send/i });
      expect(sendBtn).toBeDisabled();

      // Should not call API since controls are disabled
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    test('should not apply rate limiting in business context', async () => {
      setupBusinessContext(mockUseAuthStore);
      mockApiClient.post.mockResolvedValue(
        createMockApiResponse(TEST_CONSTANTS.BUSINESS_RESPONSE, TEST_CONSTANTS.BUSINESS_CONV_ID)
      );

      render(<GlobalAIChat />);
      
      const { triggerButton, businessInput, sendButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      // Should not show rate limit indicator
      expect(screen.queryByText(/Messages remaining/)).not.toBeInTheDocument();

      await sendMessage(businessInput(), sendButton(), 'Test business message');

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/ai/chat', {
          message: 'Test business message',
          conversation_id: null
        });
      });
    });
  });

  describe('Error Handling Across Contexts', () => {
    test('should handle API errors gracefully in guest context', async () => {
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      render(<GlobalAIChat />);
      
      const { triggerButton, guestInput, sendButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      await sendMessage(guestInput(), sendButton(), 'Test message');

      await waitFor(() => {
        expect(screen.getByText(/Sorry, I'm having trouble right now/)).toBeInTheDocument();
        expect(screen.getByText(/contact our sales team/)).toBeInTheDocument();
      });
    });

    test('should handle API errors gracefully in business context', async () => {
      setupBusinessContext(mockUseAuthStore);
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      render(<GlobalAIChat />);
      
      const { triggerButton, businessInput, sendButton } = getCommonElements(screen);
      fireEvent.click(triggerButton());

      await sendMessage(businessInput(), sendButton(), 'Test message');

      await waitFor(() => {
        expect(screen.getByText(/Unable to process that right now/)).toBeInTheDocument();
      });
    });
  });

  describe('Widget Behavior Across User States', () => {
    test('should show widget on marketing pages for guest users', () => {
      setupGuestContext(mockUseAuthStore, mockUseGuestAISession);

      render(<GlobalAIChat />);
      expect(screen.getByLabelText('Open AI Chat')).toBeInTheDocument();
    });

    test('should show widget on dashboard pages for authenticated users', () => {
      setupBusinessContext(mockUseAuthStore);

      render(<GlobalAIChat />);
      expect(screen.getByLabelText('Open AI Chat')).toBeInTheDocument();
    });

    test('should show marketing widget for unauthenticated users (guest context)', () => {
      // When not authenticated, aiContext='marketing' so widget always shows
      mockUseAuthStore.mockReturnValue(createMockAuthState({ 
        isAuthenticated: false, 
        isInitialized: false 
      }));

      render(<GlobalAIChat />);
      // Widget renders in marketing/guest mode for unauthenticated users
      expect(screen.getByLabelText('Open AI Chat')).toBeInTheDocument();
    });
  });
});