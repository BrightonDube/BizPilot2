'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api'
import type { AgentChatRequest, AgentResponse } from '@/types/agent'

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
  type?: 'plan' | 'response' | 'hitl_request' | 'tool_result' | 'error' | 'stopped'
  session_id?: string
  pending?: boolean
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
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{session_id: string; description: string} | null>(null)

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
        const userMessage: AIMessage = {
          id: `${Date.now()}-user`,
          conversation_id: convo!.id,
          is_user: true,
          content: trimmed,
        }
        setMessages((prev) => [...prev, userMessage])

        // Use session_id from state or generate new one
        const currentSessionId = sessionId || `session_${Date.now()}`
        if (!sessionId) {
          setSessionId(currentSessionId)
        }

        const request: AgentChatRequest = {
          message: trimmed,
          session_id: currentSessionId,
          conversation_id: convo.id,
        }

        const resp = await apiClient.post<AgentResponse>('/agents/chat', request)
        const agentData = resp.data

        // Update session_id from response
        if (agentData.session_id && agentData.session_id !== currentSessionId) {
          setSessionId(agentData.session_id)
        }

        const assistantMessage: AIMessage = {
          id: `${Date.now()}-assistant`,
          conversation_id: convo!.id,
          is_user: false,
          content: agentData.message,
          type: agentData.type,
          session_id: agentData.session_id,
          pending: agentData.pending,
        }

        setMessages((prev) => [...prev, assistantMessage])

        // Handle HITL request
        if (agentData.type === 'hitl_request' || agentData.pending) {
          setPendingAction({
            session_id: agentData.session_id,
            description: agentData.message,
          })
        }

        // refresh the conversation list (title/updated_at changes)
        void fetchConversations()
      } catch (err: unknown) {
        console.error('Failed to send message:', err)
        const errorMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (err as Error).message || 'Failed to send message'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [createNewConversation, currentConversation, fetchConversations, sessionId]
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

  const confirmAction = useCallback(
    async (approve: boolean) => {
      if (!pendingAction) return

      try {
        setError(null)
        setLoading(true)

        const endpoint = approve 
          ? `/agents/hitl/${pendingAction.session_id}/approve`
          : `/agents/hitl/${pendingAction.session_id}/reject`

        const resp = await apiClient.post<AgentResponse>(endpoint, {})
        const agentData = resp.data

        const resultMessage: AIMessage = {
          id: `${Date.now()}-result`,
          conversation_id: currentConversation?.id || '',
          is_user: false,
          content: agentData.message,
          type: agentData.type,
          session_id: agentData.session_id,
          pending: false,
        }

        setMessages((prev) => [...prev, resultMessage])
        setPendingAction(null)
      } catch (err: unknown) {
        console.error('Failed to confirm action:', err)
        const errorMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (err as Error).message || 'Failed to confirm action'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [pendingAction, currentConversation]
  )

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
    sessionId,
    pendingAction,
    fetchConversations,
    createNewConversation,
    deleteConversation,
    sendMessage,
    confirmAction,
  }
}
