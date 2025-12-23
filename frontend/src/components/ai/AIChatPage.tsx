'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Loader2, Plus, Send, Trash2, User } from 'lucide-react'

import { Button, Card, CardContent, Input } from '@/components/ui'
import { useAIChat } from '@/hooks/useAIChat'

type QuickQuestion = {
  id: string
  text: string
  prompt: string
}

const quickQuestions: QuickQuestion[] = [
  {
    id: '1',
    text: "What's my most profitable product?",
    prompt: 'Analyze my products and tell me which one has the highest profit margin and total profit potential.'
  },
  {
    id: '2',
    text: 'How should I price a new product?',
    prompt: 'Give me guidance on pricing strategy for a new product, considering my current margins and market positioning.'
  },
  {
    id: '3',
    text: 'What inventory should I restock?',
    prompt: 'Review my inventory levels and recommend what items I should reorder based on stock levels and usage patterns.'
  },
  {
    id: '4',
    text: 'How do I create an invoice?',
    prompt: 'Explain step-by-step how to create an invoice in BizPilot.'
  }
]

export function AIChatPage() {
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    messages,
    loading,
    error,
    businessSummary,
    createNewConversation,
    deleteConversation,
    sendMessage,
  } = useAIChat()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const showQuickQuestions = messages.length <= 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    await sendMessage(input)
    setInput('')
  }

  return (
    <motion.div
      className="flex flex-col lg:flex-row gap-6 resize-y overflow-auto"
      style={{ minHeight: '720px', maxHeight: 'calc(100vh - 4rem)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-full lg:w-80 flex-shrink-0">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-3">
            <Button
              onClick={() => createNewConversation()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </CardContent>
        </Card>

        <div className="mt-4 space-y-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between p-3 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                currentConversation?.id === c.id ? 'bg-gray-800/50 border-purple-500/50' : ''
              }`}
              onClick={() => setCurrentConversation(c)}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{c.title || 'Untitled Conversation'}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteConversation(c.id)
                }}
                className="text-gray-500 hover:text-red-400 ml-3"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-100">AI Assistant</h1>
          <p className="text-gray-400">Ask about the app or your business.</p>

          {businessSummary && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              {typeof businessSummary.totalProducts !== 'undefined' && (
                <span className="px-2 py-1 rounded bg-gray-900/50 border border-gray-700">{businessSummary.totalProducts} products</span>
              )}
              {typeof businessSummary.totalInventoryItems !== 'undefined' && (
                <span className="px-2 py-1 rounded bg-gray-900/50 border border-gray-700">{businessSummary.totalInventoryItems} inventory items</span>
              )}
              {typeof businessSummary.lowStockItems !== 'undefined' && businessSummary.lowStockItems > 0 && (
                <span className="px-2 py-1 rounded bg-red-900/20 border border-red-500/30 text-red-300">{businessSummary.lowStockItems} low stock</span>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden min-h-[560px]">
          {showQuickQuestions && (
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Questions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => sendMessage(q.prompt)}
                    disabled={loading}
                    className="text-left p-3 rounded-lg border border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-sm text-gray-200">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((m, idx) => (
                <motion.div
                  key={m.id}
                  className={`flex items-start gap-3 ${m.is_user ? 'flex-row-reverse' : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      m.is_user ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-600 to-pink-600'
                    }`}
                  >
                    {m.is_user ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                  </div>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      m.is_user ? 'bg-blue-600 text-white' : 'bg-gray-900/50 border border-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="text-sm text-gray-400">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 flex gap-3">
            <div className="flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="bg-gray-900/50 border-gray-600"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  )
}
