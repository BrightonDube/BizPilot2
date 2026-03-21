/**
 * useAIConversation.test.ts
 * Unit tests for the useAIConversation hook
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIConversation } from '../useAIConversation'
import { apiClient } from '@/lib/api'

// Mock apiClient
jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}))

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
})

describe('useAIConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionStorage.clear()
  })

  it('should initialize with empty messages and loading false', () => {
    const { result } = renderHook(() => useAIConversation())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should retrieve conversationId from sessionStorage if it exists', () => {
    const existingId = 'conv_existing_123'
    mockSessionStorage.setItem('bizpilot_ai_conversation_id', existingId)

    const { result } = renderHook(() => useAIConversation())

    waitFor(() => {
      expect(result.current.conversationId).toBe(existingId)
    })
  })

  it('should create and store conversationId in sessionStorage if none exists', () => {
    const { result } = renderHook(() => useAIConversation())

    waitFor(() => {
      expect(result.current.conversationId).toBeTruthy()
      expect(mockSessionStorage.getItem('bizpilot_ai_conversation_id')).toBe(
        result.current.conversationId
      )
    })
  })

  it('should call correct endpoint with conversationId when sending message', async () => {
    const mockResponse = {
      data: {
        message: 'Hello! How can I help you?',
        type: 'response',
      },
    }
    ;(apiClient.post as jest.Mock).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIConversation())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/agents/chat', {
        message: 'hello',
        conversation_id: expect.any(String),
        session_id: null,
      })
    })
  })

  it('should add user message to messages array immediately (optimistic)', async () => {
    const mockResponse = {
      data: {
        message: 'Response',
        type: 'response',
      },
    }
    ;(apiClient.post as jest.Mock).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIConversation())

    await act(async () => {
      await result.current.sendMessage('test message')
    })

    await waitFor(() => {
      const userMessage = result.current.messages.find((m) => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage?.content).toBe('test message')
    })
  })

  it('should add assistant response after API call', async () => {
    const mockResponse = {
      data: {
        message: 'This is the AI response',
        type: 'response',
      },
    }
    ;(apiClient.post as jest.Mock).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useAIConversation())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      const assistantMessage = result.current.messages.find((m) => m.role === 'assistant')
      expect(assistantMessage).toBeDefined()
      expect(assistantMessage?.content).toBe('This is the AI response')
    })
  })

  it('should set error state on API failure', async () => {
    const errorResponse = {
      response: {
        data: {
          detail: 'AI service unavailable',
        },
      },
    }
    ;(apiClient.post as jest.Mock).mockRejectedValue(errorResponse)

    const { result } = renderHook(() => useAIConversation())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(result.current.error).toBe('AI service unavailable')
    })
  })

  it('should remove optimistic user message on error', async () => {
    ;(apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAIConversation())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(result.current.messages).toEqual([])
      expect(result.current.error).toBeTruthy()
    })
  })

  it('should not send message if content is empty', async () => {
    const { result } = renderHook(() => useAIConversation())

    await act(async () => {
      await result.current.sendMessage('')
    })

    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('should not send message if already loading', async () => {
    const mockResponse = {
      data: {
        message: 'Response',
        type: 'response',
      },
    }
    ;(apiClient.post as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100))
    )

    const { result } = renderHook(() => useAIConversation())

    act(() => {
      result.current.sendMessage('first message')
    })

    act(() => {
      result.current.sendMessage('second message')
    })

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(1)
    })
  })
})
