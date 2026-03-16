import { AxiosInstance } from 'axios';

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  type: 'message' | 'hitl_confirmation' | 'response' | 'error' | 'stopped'
  message: string
  confirmation_id?: string
  action_summary?: string
  conversation_id?: string
}

export async function sendMessage(
  message: string,
  conversationId: string | null,
  history: ChatMessage[],
  apiClient: AxiosInstance
): Promise<ChatResponse> {
  const response = await apiClient.post('/agents/chat', {
    message,
    conversation_id: conversationId,
    history
  })
  return response.data
}

export async function confirmAction(
  confirmationId: string,
  decision: 'approve' | 'reject',
  conversationId: string | null,
  apiClient: AxiosInstance
): Promise<ChatResponse> {
  const endpoint = decision === 'approve' ? `/agents/hitl/${confirmationId}/approve` : `/agents/hitl/${confirmationId}/reject`
  const response = await apiClient.post(endpoint, {
    conversation_id: conversationId
  })
  return response.data
}
