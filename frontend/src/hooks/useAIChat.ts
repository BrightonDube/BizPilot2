'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api'

export type AIDataSharingLevel =
  | 'none'
  | 'app_only'
  | 'metrics_only'
  | 'full_business'
  | 'full_business_with_customers'

export type AIConversation = {
  id: string
  title: string
}

export type AIMessage = {
  id: string
  conversation_id: string
  is_user: boolean
  content: string
}

export type AIContext = {
  ai_data_sharing_level: AIDataSharingLevel
  app_context: Record<string, unknown>
  business_context: Record<string, unknown>
}

export function useAIChat() {
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<AIContext | null>(null)

  const fetchContext = useCallback(async () => {
    try {
      const resp = await apiClient.get<AIContext>('/ai/context')
      setContext(resp.data)
    } catch {
      // ignore
    }
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      setError(null)
      const resp = await apiClient.get<AIConversation[]>('/ai/conversations')
      setConversations(resp.data)
      if (!currentConversation && resp.data.length > 0) {
        setCurrentConversation(resp.data[0])
      }
    } catch {
      setError('Failed to load conversations')
    }
  }, [currentConversation])

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      setError(null)
      const resp = await apiClient.get<AIMessage[]>(`/ai/conversations/${conversationId}/messages`)
      setMessages(resp.data)
    } catch {
      setError('Failed to load messages')
      setMessages([])
    }
  }, [])

  const createNewConversation = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const resp = await apiClient.post<AIConversation>('/ai/conversations', { title: 'New Conversation' })
      const convo = resp.data
      setConversations((prev) => [convo, ...prev])
      setCurrentConversation(convo)
      await fetchMessages(convo.id)
      return convo
    } catch {
      setError('Failed to create conversation')
      return null
    } finally {
      setLoading(false)
    }
  }, [fetchMessages])

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        setError(null)
        await apiClient.delete(`/ai/conversations/${conversationId}`)
        setConversations((prev) => prev.filter((c) => c.id !== conversationId))
        if (currentConversation?.id === conversationId) {
          const remaining = conversations.filter((c) => c.id !== conversationId)
          setCurrentConversation(remaining.length > 0 ? remaining[0] : null)
        }
      } catch {
        setError('Failed to delete conversation')
      }
    },
    [conversations, currentConversation]
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      try {
        setError(null)
        setLoading(true)

        let convo = currentConversation
        if (!convo) {
          convo = await createNewConversation()
        }
        if (!convo) return

        // optimistic user message
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-user`,
            conversation_id: convo!.id,
            is_user: true,
            content: trimmed,
          }
        ])

        const resp = await apiClient.post<{ response: string; conversation_id?: string }>(
          `/ai/conversations/${convo.id}/messages`,
          { message: trimmed, conversation_id: convo.id }
        )

        const assistantText = String(resp.data?.response ?? '')
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            conversation_id: convo!.id,
            is_user: false,
            content: assistantText,
          }
        ])

        // refresh the conversation list (title/updated_at changes)
        void fetchConversations()
      } catch {
        setError('Failed to send message')
      } finally {
        setLoading(false)
      }
    },
    [createNewConversation, currentConversation, fetchConversations]
  )

  useEffect(() => {
    fetchContext()
    fetchConversations()
  }, [fetchConversations, fetchContext])

  useEffect(() => {
    if (currentConversation?.id) {
      fetchMessages(currentConversation.id)
    }
  }, [currentConversation?.id, fetchMessages])

  const businessSummary = useMemo(() => {
    const biz = context?.business_context
    if (!biz) return null
    return {
      totalProducts: typeof biz.totalProducts === 'number' ? biz.totalProducts : undefined,
      totalInventoryItems: typeof biz.totalInventoryItems === 'number' ? biz.totalInventoryItems : undefined,
      lowStockItems: typeof biz.lowStockItems === 'number' ? biz.lowStockItems : undefined,
      avgMargin: typeof biz.avgMargin === 'number' ? biz.avgMargin : undefined,
      businessName: typeof biz.businessName === 'string' ? biz.businessName : undefined,
    }
  }, [context])

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    messages,
    loading,
    error,
    context,
    businessSummary,
    fetchConversations,
    createNewConversation,
    deleteConversation,
    sendMessage,
  }
}
