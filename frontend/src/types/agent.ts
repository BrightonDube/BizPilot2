// Agent system types for the new agentic AI

export type AgentChatRequest = {
  message: string
  session_id?: string
  conversation_id?: string
}

export type AgentConfirmRequest = {
  message: string
  session_id: string
  conversation_id?: string
}

export type AgentResponse = {
  type: 'plan' | 'response' | 'hitl_request' | 'stopped' | 'error'
  message: string
  session_id: string
  pending: boolean
  conversation_id?: string
}

export type HITLActionRequest = object

// For backward compatibility with existing AI chat
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
