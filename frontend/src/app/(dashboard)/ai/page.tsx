'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  User, 
  Bot, 
  Loader2, 
  MessageSquare,
  Plus,
  Trash2,
  TrendingUp,
  Package,
  DollarSign,
  Lightbulb,
  Mic,
  MicOff
} from 'lucide-react'
import { Button, Input, Card, CardContent } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface QuickQuestion {
  id: string
  text: string
  icon: React.ElementType
  prompt: string
}

const quickQuestions: QuickQuestion[] = [
  {
    id: '1',
    text: "What's my most profitable product?",
    icon: TrendingUp,
    prompt: 'Analyze my products and tell me which one has the highest profit margin and total profit potential.'
  },
  {
    id: '2',
    text: 'How should I price a new product?',
    icon: DollarSign,
    prompt: 'Give me guidance on pricing strategy for a new product, considering my current margins and market positioning.'
  },
  {
    id: '3',
    text: 'What inventory should I restock?',
    icon: Package,
    prompt: 'Review my inventory levels and recommend what items I should reorder based on stock levels and usage patterns.'
  },
  {
    id: '4',
    text: 'How can I reduce costs?',
    icon: Lightbulb,
    prompt: 'Analyze my product costs and suggest ways to reduce expenses while maintaining quality.'
  }
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your BizPilot AI assistant. I can help you with business insights, answer questions about your data, and provide recommendations. How can I assist you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showQuickQuestions, setShowQuickQuestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    await sendMessage(input.trim())
  }

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowQuickQuestions(false)

    try {
      const response = await apiClient.post('/ai/chat', {
        message: content,
        conversation_id: null,
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I'm currently unable to process your request. The AI service may not be configured. Please try again later or contact support.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, fallbackMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickQuestion = (question: QuickQuestion) => {
    if (isLoading) return
    sendMessage(question.prompt)
  }

  const handleNewConversation = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your BizPilot AI assistant. I can help you with business insights, answer questions about your data, and provide recommendations. How can I assist you today?",
        timestamp: new Date(),
      },
    ])
    setShowQuickQuestions(true)
  }

  return (
    <motion.div 
      className="h-[calc(100vh-8rem)] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">AI Business Assistant</h1>
            <p className="text-gray-400">Get insights about your products, pricing, and inventory with AI-powered analysis</p>
          </div>
          <Button
            onClick={handleNewConversation}
            variant="outline"
            className="border-gray-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </motion.div>

      {/* Chat Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex-1 flex flex-col bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
      >
        {/* Quick Questions */}
        <AnimatePresence>
          {showQuickQuestions && (
            <motion.div 
              className="p-4 border-b border-gray-700"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Questions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickQuestions.map((question, index) => (
                  <motion.button
                    key={question.id}
                    onClick={() => handleQuickQuestion(question)}
                    disabled={isLoading}
                    className="text-left p-3 rounded-lg border border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center">
                      <question.icon className="h-4 w-4 text-purple-400 mr-2 group-hover:text-purple-300 transition-colors" />
                      <span className="text-sm text-gray-200 group-hover:text-white transition-colors">{question.text}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <motion.div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-600'
                      : 'bg-gradient-to-br from-purple-600 to-pink-600'
                  }`}
                  whileHover={{ scale: 1.1 }}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </motion.div>
                <motion.div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-900/50 border border-gray-700 text-gray-100'
                  }`}
                  whileHover={{ scale: 1.01 }}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs opacity-60 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div 
              className="flex items-start gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-4 h-4 text-purple-400" />
                  </motion.div>
                  <span className="text-sm text-gray-400">AI is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="p-4 border-t border-gray-700 flex gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your business..."
              className="pr-12 bg-gray-900/50 border-gray-600"
              disabled={isLoading}
            />
            <motion.div
              className="absolute right-3 top-1/2 -translate-y-1/2"
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
            </motion.div>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </motion.div>
        </motion.form>

        {/* Notice */}
        <motion.div 
          className="px-4 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-200 flex items-center">
            <Lightbulb className="h-4 w-4 mr-2 text-blue-400" />
            This AI assistant analyzes your real business data to provide personalized insights and recommendations.
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
