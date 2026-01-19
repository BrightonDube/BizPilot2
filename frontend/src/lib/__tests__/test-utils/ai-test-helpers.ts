/**
 * Test utilities for AI context switching tests
 */

export const TEST_CONSTANTS = {
  SESSION_ID: 'test-session-123',
  GUEST_CONV_ID: 'guest-conv-123',
  BUSINESS_CONV_ID: 'business-conv-456',
  RATE_LIMIT_MESSAGE: 'Rate limit exceeded. Please try again later.',
  MARKETING_RESPONSE: 'Marketing response',
  BUSINESS_RESPONSE: 'Business response'
} as const;

export const createMockGuestSession = (overrides = {}) => ({
  session: {
    id: TEST_CONSTANTS.SESSION_ID,
    createdAt: Date.now(),
    messageCount: 0,
    lastActivity: Date.now()
  },
  canSendMessage: true,
  messagesRemaining: 20,
  rateLimitMessage: '',
  updateSessionActivity: jest.fn(),
  trackAnalytics: jest.fn(),
  ...overrides
});

export const createMockAuthState = (overrides = {}) => ({
  isAuthenticated: false,
  isInitialized: true,
  fetchUser: jest.fn(),
  ...overrides
});

export const createMockApiResponse = (response: string, conversationId: string) => ({
  data: { response, conversation_id: conversationId }
});

export const setupGuestContext = (mockUseAuthStore: jest.Mock, mockUseGuestAISession: jest.Mock) => {
  mockUseAuthStore.mockReturnValue(createMockAuthState({ isAuthenticated: false }));
  mockUseGuestAISession.mockReturnValue(createMockGuestSession());
};

export const setupBusinessContext = (mockUseAuthStore: jest.Mock) => {
  mockUseAuthStore.mockReturnValue(createMockAuthState({ isAuthenticated: true }));
};

export const setupRateLimitedContext = (mockUseGuestAISession: jest.Mock) => {
  mockUseGuestAISession.mockReturnValue(
    createMockGuestSession({
      canSendMessage: false,
      messagesRemaining: 0,
      rateLimitMessage: TEST_CONSTANTS.RATE_LIMIT_MESSAGE,
      session: {
        id: TEST_CONSTANTS.SESSION_ID,
        createdAt: Date.now(),
        messageCount: 20,
        lastActivity: Date.now()
      }
    })
  );
};

export const getCommonElements = (screen: any) => ({
  triggerButton: () => screen.getByLabelText('Open AI Chat'),
  sendButton: () => screen.getByRole('button', { name: /send/i }),
  guestInput: () => screen.getByPlaceholderText(/Ask about BizPilot features/),
  businessInput: () => screen.getByPlaceholderText(/Ask about sales, inventory/)
});

export const sendMessage = async (input: HTMLElement, sendButton: HTMLElement, message: string) => {
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(input, { target: { value: message } });
  fireEvent.click(sendButton);
};