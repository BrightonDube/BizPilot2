import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Mic, MicOff, Loader2, Lightbulb, TrendingUp, Package, DollarSign, Plus, Trash2 } from 'lucide-react'
import { useAIChat } from '../../hooks/useAIChat'
import { formatPercentage } from '../../utils/calculations'
import { markdownToPlainText } from '../../utils/markdown'

interface QuickQuestion {
  id: string
  text: string
  icon: React.ElementType
  prompt: string
}

export function AIChat() {
  const { 
    conversations, 
    currentConversation, 
    messages, 
    loading, 
    error,
    createNewConversation,
    sendMessage,
    deleteConversation,
    setCurrentConversation,
    getBusinessContext
  } = useAIChat()
  
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const [businessContext, setBusinessContext] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const quickQuestions: QuickQuestion[] = [
    {
      id: '1',
      text: 'What\'s my most profitable product?',
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

  useEffect(() => {
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript
        setInputValue(transcript)
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      setRecognition(recognition)
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Load business context when component mounts
    loadBusinessContext()
  }, [])

  const loadBusinessContext = async () => {
    const context = await getBusinessContext()
    setBusinessContext(context)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const message = inputValue.trim()
    setInputValue('')
    await sendMessage(message)
  }

  const handleQuickQuestion = async (question: QuickQuestion) => {
    if (loading) return
    await sendMessage(question.prompt)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleVoiceInput = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser')
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      recognition.start()
      setIsListening(true)
    }
  }

  const handleNewConversation = async () => {
    await createNewConversation()
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      await deleteConversation(conversationId)
    }
  }

  if (error && !currentConversation) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-100 mb-2">Error Loading Chat</h3>
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={handleNewConversation} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden relative">
      {/* Sidebar - Conversation List */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-dark-700 flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="p-4 border-b border-dark-700 lg:sticky lg:top-0 bg-dark-900 z-10">
          <button
            onClick={handleNewConversation}
            className="btn-primary w-full flex items-center justify-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 border-b border-dark-700 cursor-pointer hover:bg-dark-800 transition-colors ${
                currentConversation?.id === conversation.id ? 'bg-dark-800 border-l-2 border-l-primary-500' : ''
              }`}
              onClick={() => setCurrentConversation(conversation)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">
                    {conversation.title || 'Untitled Conversation'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(conversation.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteConversation(conversation.id)
                  }}
                  className="text-gray-500 hover:text-red-400 ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="p-4 border-b border-dark-700">
          <h1 className="text-xl font-bold text-gray-100">AI Business Assistant</h1>
          <p className="text-sm text-gray-400">
            Get insights about your products, pricing, and inventory with AI-powered analysis
          </p>
          
          {businessContext && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{businessContext.totalProducts} products</span>
              <span>{businessContext.totalInventoryItems} inventory items</span>
              <span>{formatPercentage(businessContext.avgMargin)} avg margin</span>
              {businessContext.lowStockItems > 0 && (
                <span className="text-red-400">{businessContext.lowStockItems} low stock</span>
              )}
            </div>
          )}
        </div>

        {/* Quick Questions */}
        <div className="p-4 border-b border-dark-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Questions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickQuestions.map((question) => (
              <button
                key={question.id}
                onClick={() => handleQuickQuestion(question)}
                disabled={loading}
                className="text-left p-2 rounded border border-dark-600 hover:border-primary-600/50 hover:bg-dark-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center">
                  <question.icon className="h-3 w-3 text-primary-400 mr-2" />
                  <span className="text-xs text-gray-200">{question.text}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.is_user
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-100 border border-dark-600'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{markdownToPlainText(message.content)}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.is_user ? 'text-primary-200' : 'text-gray-500'
                  }`}
                >
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-dark-800 border border-dark-600 p-3 rounded-lg flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary-400" />
                <span className="text-sm text-gray-400">AI is thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-dark-700">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your business..."
                className="input-field pr-12"
                disabled={loading}
              />
              {recognition && (
                <button
                  onClick={toggleVoiceInput}
                  disabled={loading}
                  className={`absolute right-3 top-2 p-1 rounded-md transition-colors ${
                    isListening
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-gray-500 hover:text-gray-400'
                  }`}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || loading}
              className="btn-primary flex items-center justify-center sm:w-auto"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Notice */}
          <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-200">
            💡 This AI assistant analyzes your real business data to provide personalized insights and recommendations.
          </div>
        </div>
        
        {/* Floating New Conversation Button - Small Screens Only */}
        <button
          onClick={handleNewConversation}
          className="lg:hidden fixed bottom-20 right-4 z-50 bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Start new conversation"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}