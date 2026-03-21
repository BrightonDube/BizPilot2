/**
 * useAIConversation.ts
 * 
 * Single shared hook for AI chat functionality.
 * Used by BOTH the AI widget and the /ai page so they share
 * the same conversation state, history, and backend connection.
 * 
 * Conversation ID is stored in sessionStorage so the same conversation
 * persists between the widget and the /ai page within the same browser session.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'

export type AIMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const CONVERSATION_ID_KEY = 'bizpilot_ai_conversation_id'

export function useAIConversation() {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  // Initialize conversation ID from sessionStorage
  useEffect(() => {
    const storedId = sessionStorage.getItem(CONVERSATION_ID_KEY)
    if (storedId) {
      setConversationId(storedId)
    } else {
      // Generate new conversation ID
      const newId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem(CONVERSATION_ID_KEY, newId)
      setConversationId(newId)
    }
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !conversationId) return

      const trimmed = content.trim()

      try {
        setError(null)
        setIsLoading(true)

        // Add user message optimistically
        const userMessage: AIMessage = {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: trimmed,
        }
        setMessages((prev) => [...prev, userMessage])

        // Send to backend via /agents/chat endpoint
        const response = await apiClient.post('/agents/chat', {
          message: trimmed,
          conversation_id: conversationId,
          session_id: null,
        })

        // Add assistant response
        const assistantMessage: AIMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: response.data.message || '',
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as Error).message ||
          'Failed to send message'
        setError(errorMessage)
        
        // Remove the optimistic user message on error
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId, isLoading]
  )

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    conversationId,
  }
}
